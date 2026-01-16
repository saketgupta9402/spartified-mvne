from dateutil.relativedelta import relativedelta
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
from fastapi.responses import StreamingResponse, PlainTextResponse
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import pandas as pd
from openai import OpenAI

# import google.generativeai as genai
# from google.cloud import aiplatform
# from google.cloud.aiplatform import TextEmbeddingModel
# import vertexai
# from vertexai.language_models import TextEmbeddingModel
import google.generativeai as genai
import re
import logging
import asyncio
import datetime
from textwrap import dedent
from typing import Optional, List
from functools import lru_cache
import hashlib
import json
from pathlib import Path
from pinecone import Pinecone, ServerlessSpec  # Updated import
import pdfplumber
from docx import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Add these imports after your existing imports
import traceback
from typing import Dict, Any, Optional, List
from functools import wraps


# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load environment variables
# Load environment variables with override to ensure corrected keys are picked up
load_dotenv(override=True)
openai_key = os.getenv('OPENAI_API_KEY')
gemini_key = os.getenv('GOOGLE_GEMINI_API_KEY')
logger.info(
    f"Loaded environment variables: OPENAI_API_KEY_PREFIX={openai_key[:7] if openai_key else 'NONE'}, GOOGLE_GEMINI_API_KEY_PREFIX={gemini_key[:7] if gemini_key else 'NONE'}"
)
# Force reload token: 1

app = FastAPI()

# Import and include routers
import mvne_router
import system_router
app.include_router(mvne_router.router)
app.include_router(system_router.router)


@app.get("/")
async def root():
    return {"message": "Service is running", "timestamp": datetime.datetime.now().isoformat()}

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import database components
from database import engine, fetch_data, execute_query, billing_data_cache

# Consolidate API clients after loading env vars
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")

client = None
if OPENAI_API_KEY:
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        logger.info("OpenAI client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {e}")

gemini_model = None
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model_to_use = "gemini-2.5-flash"  # Reliable alternative
    gemini_model = genai.GenerativeModel(model_to_use)
    logger.info(f"Gemini initialized with {model_to_use}")
pc = None
index = None
INDEX_NAME = "knowledge-base"
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        # Check if index exists - skip slow listing if possible or handle timeout
        logger.info("Pinecone client initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Pinecone client: {e}")
else:
    logger.warning("Pinecone client not initialized - PINECONE_API_KEY not set")

# Ensure the index exists (create if it doesn't)
# if INDEX_NAME not in pc.list_indexes().names():
#     logger.info(f"Creating Pinecone index '{INDEX_NAME}'")
#     pc.create_index(
#         name=INDEX_NAME,
#         dimension=1536,  # Matches OpenAI's text-embedding-ada-002
#         metric='euclidean',
#         spec=ServerlessSpec(
#             cloud='aws',  # Adjust based on your preference (e.g., 'aws', 'gcp', 'azure')
#             region='us-east-1'  # Adjust based on your PINECONE_ENV or desired region
#         )
#     )
# index = pc.Index(INDEX_NAME)

# Text splitter for document processing
text_splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=200)

# Persistent token usage storage
TOKEN_CACHE_FILE = Path("token_usage_cache.json")

DEFAULT_MONTHS_BACK = 6
DEFAULT_TOP_ACCOUNTS_LIMIT = 15
DEFAULT_TARGETS = {
    "net_profit_target": 1200000,
    "revenue_target": 4000000,
    "retention_target": 95.0,
    "cost_reduction_target": 12.0,
}


def load_token_cache():
    """Load token usage cache from file, or initialize if not exists."""
    if TOKEN_CACHE_FILE.exists():
        with open(TOKEN_CACHE_FILE, "r") as f:
            return json.load(f)
    return {}


def get_gemini_embeddings(chunks):
    """Get embeddings using Google's text-embedding-004 model"""
    if not gemini_model:
        raise ValueError("Gemini model not initialized. Please set GOOGLE_GEMINI_API_KEY.")
    try:
        # Note: genai.embed_content is the standard way for Gemini embeddings
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=chunks,
            task_type="retrieval_document"
        )
        return result['embedding']
    except Exception as e:
        logger.error(f"Error getting Gemini embeddings: {e}")
        raise

def get_openai_embeddings(chunks):
    """Fallback for OpenAI embeddings if needed, but primarily using Gemini now"""
    if not client:
        return get_gemini_embeddings(chunks)
    try:
        response = client.embeddings.create(
            model="text-embedding-3-small", input=chunks  # 1536 dimensions
        )
        return [embedding.embedding for embedding in response.data]
    except Exception as e:
        logger.error(f"Error getting OpenAI embeddings: {e}")
        raise


def save_token_cache(cache):
    """Save token usage cache to file."""
    with open(TOKEN_CACHE_FILE, "w") as f:
        json.dump(cache, f)


token_usage_cache = load_token_cache()


def update_token_usage(api_key: str, model: str, tokens_used: int):
    """Update token usage for the current day and save to persistent storage."""
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    if today not in token_usage_cache:
        token_usage_cache[today] = {}
    if api_key not in token_usage_cache[today]:
        token_usage_cache[today][api_key] = {"openai": 0, "gemini": 0}
    token_usage_cache[today][api_key][model] += tokens_used
    save_token_cache(token_usage_cache)


def get_lifetime_totals(api_key: str) -> dict:
    """Calculate lifetime token totals for an API key across all days."""
    lifetime = {"openai": 0, "gemini": 0}
    for day_data in token_usage_cache.values():
        if api_key in day_data:
            lifetime["openai"] += day_data[api_key].get("openai", 0)
            lifetime["gemini"] += day_data[api_key].get("gemini", 0)
    return lifetime


def handle_database_errors(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in {func.__name__}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")

            return {
                "error": True,
                "message": f"Failed to fetch {func.__name__.replace('get_', '').replace('_', ' ')}",
                "details": str(e),
                "data": None,
            }

    return wrapper


def safe_query_execute(query: str, fallback_data: Any = None) -> Dict[str, Any]:
    """Safely execute a query with fallback data"""
    try:
        result = fetch_data(query)
        if not result:
            logger.warning(f"Query returned empty result: {query[:100]}...")
            return {
                "error": False,
                "message": "No data available",
                "data": fallback_data or [],
            }

        return {"error": False, "message": "Success", "data": result}
    except Exception as e:
        logger.error(f"Query execution failed: {str(e)}")
        return {
            "error": True,
            "message": "Database query failed",
            "details": str(e),
            "data": fallback_data or [],
        }


# Caches are now in database.py
chat_cache: dict[str, tuple[str, int]] = {}  # Query -> (response, tokens_used)


# Pydantic Models
class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str
    history: List[Message] = []
    language: str = "en-US"


class RatePlan(BaseModel):
    rate_plan: str
    bundle_allowance: float
    bundle_fee: float
    home_rate: float
    row_rate: float


class WholesaleEntity(BaseModel):
    id: Optional[int]
    name: str
    type: Optional[str]
    country: Optional[str]
    currency: Optional[str] = "USD"
    status: Optional[str] = "active"

class WholesalePlan(BaseModel):
    id: Optional[int]
    entity_id: int
    plan_name: Optional[str]
    plan_type: Optional[str]
    start_date: Optional[datetime.date]
    end_date: Optional[datetime.date]
    revenue_share_pct: Optional[float]

class ServiceRate(BaseModel):
    id: Optional[int]
    plan_id: int
    service_type: Optional[str]
    rate_per_unit: Optional[float]
    unit: Optional[str]
    overage_rate: Optional[float]

class PlanAllowance(BaseModel):
    id: Optional[int]
    plan_id: int
    service_type: Optional[str]
    allowance_amount: Optional[float]
    allowance_unit: Optional[str]
    period: Optional[str] = "monthly"

class MonthlyConsumption(BaseModel):
    id: Optional[int]
    entity_id: int
    plan_id: int
    year_month: Optional[str]
    voice_minutes_used: Optional[int]
    sms_count: Optional[int]
    data_gb_used: Optional[float]

class WholesaleBillingCycle(BaseModel):
    id: Optional[int]
    entity_id: int
    cycle_start_date: Optional[datetime.date]
    cycle_end_date: Optional[datetime.date]
    billing_period: Optional[str]
    status: Optional[str]
    total_amount: Optional[float]

class WholesaleBillingRecord(BaseModel):
    id: Optional[int]
    entity_id: int
    plan_id: int
    billing_cycle_id: int
    year_month: Optional[str]
    service_type: Optional[str]
    allowance_amount: Optional[float]
    usage_amount: Optional[float]
    billable_amount: Optional[float]
    rate_applied: Optional[float]
    line_item_amount: Optional[float]

class WholesaleBillingSummary(BaseModel):
    id: Optional[int]
    entity_id: int
    year_month: Optional[str]
    total_base_cost: Optional[float]
    total_overage_cost: Optional[float]
    grand_total: Optional[float]
    invoice_status: Optional[str]

class DashboardMetrics(BaseModel):
    billing_cycle: str
    metric_date: datetime.date
    total_revenue: float
    gross_profit: float
    net_profit: float
    total_opex: float
    total_cogs: float
    active_accounts: int
    active_sims: int
    new_accounts: int
    lost_accounts: int
    total_usage_gb: float
    avg_cogs_per_account: float
    avg_opex_per_account: float
    accounts_receivable: float

class PerformanceAnalytics(BaseModel):
    billing_cycle: str
    metric_date: datetime.date
    account_name: str
    account_segment: str
    payment_performance_score: float
    churn_risk_score: float
    dispute_resolution_days: float
    avg_revenue_per_sim: float
    total_revenue: float
    profitability_score: int
    credit_utilization_percent: float
    discount_usage_percent: float
    avg_discount_rate: float
    discount_sensitivity: str
    optimal_discount_rate: float
    q3_forecast: float
    q4_forecast: float
    yoy_growth_forecast: float
    forecast_confidence_level: float
    total_sims: int
    total_usage_mb: int


class KnowledgeBaseRequest(BaseModel):
    query: str
    history: List[Message] = []


# File upload and processing
@app.post("/upload_knowledge_base")
async def upload_knowledge_base(file: UploadFile = File(...)):
    if not index:
        raise HTTPException(
            status_code=500, 
            detail="Pinecone index not initialized. Please set PINECONE_API_KEY environment variable."
        )
    try:
        # Extract text from file
        if file.filename.endswith(".pdf"):
            with pdfplumber.open(file.file) as pdf:
                text = "".join(
                    page.extract_text() for page in pdf.pages if page.extract_text()
                )
        elif file.filename.endswith(".docx"):
            doc = Document(file.file)
            text = "\n".join(para.text for para in doc.paragraphs)
        else:
            return PlainTextResponse("Unsupported file type", status_code=400)

        # Split text into chunks
        chunks = text_splitter.split_text(text)
        # New Text for Google based text embedding.
        vectors = get_openai_embeddings(chunks)
        metadata = [
            {"text": chunk, "section": f"Section {i + 1}", "source": file.filename}
            for i, chunk in enumerate(chunks)
        ]
        ids = [
            f"chunk_{hashlib.sha256(chunk.encode()).hexdigest()}" for chunk in chunks
        ]
        index.upsert(
            vectors=zip(ids, vectors, metadata)
        )  # Pinecone index must be 768 dims

        # Generate embeddings with OpenAI
        # embeddings_response = client.embeddings.create(model="text-embedding-ada-002", input=chunks)
        # vectors = [embedding.embedding for embedding in embeddings_response.data]

        # Store in Pinecone with metadata
        # metadata = [{"text": chunk, "section": f"Section {i+1}", "source": file.filename} for i, chunk in enumerate(chunks)]
        # ids = [f"chunk_{hashlib.sha256(chunk.encode()).hexdigest()}" for chunk in chunks]
        # index.upsert(vectors=zip(ids, vectors, metadata))

        logger.info(f"Uploaded and processed {file.filename} with {len(chunks)} chunks")
        return PlainTextResponse("Knowledge base updated successfully")
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


# Updated knowledge base endpoint with RAG
@app.post("/knowledge_base")
async def knowledge_base(request: KnowledgeBaseRequest):
    if not index:
        raise HTTPException(
            status_code=500, 
            detail="Pinecone index not initialized. Please set PINECONE_API_KEY environment variable."
        )
    if not gemini_model:
        raise HTTPException(
            status_code=500, 
            detail="Gemini model not initialized. Please set GOOGLE_GEMINI_API_KEY environment variable."
        )
    try:
        logger.info(f"Received query: {request.query}")

        # Embed query with Google Vertex AI
        query_embedding = get_openai_embeddings([request.query])[0]

        # Retrieve relevant chunks from Pinecone
        results = index.query(vector=query_embedding, top_k=3, include_metadata=True)
        contexts = [match["metadata"]["text"] for match in results["matches"]]
        sections = [match["metadata"]["section"] for match in results["matches"]]
        sources = [match["metadata"]["source"] for match in results["matches"]]

        # Construct prompt for Gemini Flash
        history_str = (
            "\n".join([f"{msg.role}: {msg.content}" for msg in request.history])
            if request.history
            else "No previous conversation."
        )
        context_str = "\n\n".join(
            [
                f"{section} (Source: {source}):\n{content}"
                for section, source, content in zip(sections, sources, contexts)
            ]
        )
        prompt = dedent(
            f"""
        You are an expert on the knowledge base derived from uploaded billing documents and FAQs.
        Use the following retrieved context to answer the query precisely, including section details where applicable.
        If the context is insufficient, indicate what additional information is needed.

        Conversation history:
        {history_str}

        Retrieved context:
        {context_str}

        Query: "{request.query}"
        Provide a concise response in markdown format, referencing sections (e.g., "Section 1") and sources (e.g., "billing_doc.pdf") where relevant.
        """
        )

        # Generate response with Gemini Flash
        response = gemini_model.generate_content(prompt)
        text = response.text.strip()

        # Update token usage (if applicable)
        approx_tokens = len(prompt.split()) + len(text.split())
        # update_token_usage(GEMINI_API_KEY, "gemini", approx_tokens)  # Uncomment if you have this function

        return StreamingResponse(stream_response(text), media_type="text/plain")
    except Exception as e:
        logger.error(f"Error in knowledge_base: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


def infer_operation_from_intent(intent: str, query: str) -> str:
    if intent == "modification":
        return "UPDATE" if "update" in query.lower() else "INSERT"
    return "SELECT"


def rewrite_subquery(sql_query: str) -> str:
    """Rewrite a SQL query to fix subquery cardinality issues."""
    try:
        pattern = r"ABS\((SELECT.*?FROM.*?)(?:\)|WHERE|GROUP BY|ORDER BY)"
        matches = re.finditer(pattern, sql_query, re.IGNORECASE)
        rewritten_query = sql_query
        for match in matches:
            subquery = match.group(1)
            if not (
                "SUM(" in subquery.upper()
                or "AVG(" in subquery.upper()
                or "LIMIT 1" in subquery.upper()
            ):
                if (
                    "total_usage" in subquery.lower()
                    or "total_bill" in subquery.lower()
                ):
                    rewritten_subquery = (
                        subquery.replace("SELECT", "SELECT SUM(", 1) + ")"
                    )
                else:
                    rewritten_subquery = subquery + " LIMIT 1"
                rewritten_query = rewritten_query.replace(subquery, rewritten_subquery)
        logger.info(f"Rewritten query for cardinality fix: {rewritten_query}")
        return rewritten_query
    except Exception as e:
        logger.error(f"Error rewriting subquery: {e}")
        return sql_query


# Utility Functions
def normalize_query(query: str) -> str:
    """Normalize query text for consistent caching."""
    query = query.lower().strip()
    if "cdr" in query:
        if "highest" in query or "max" in query:
            return "get_cdr_highest_usage"
        return "get_cdrs"
    return query


def resolve_time_period(query: str, current_date: datetime.datetime) -> str:
    """Resolve time period to a specific month for caching."""
    query = query.lower()
    if "last month" in query:
        last_month = current_date - relativedelta(months=1)
        return last_month.strftime("%Y-%m")
    elif "current month" in query:
        return current_date.strftime("%Y-%m")
    elif "next month" in query:
        return "next_month"
    elif "next quarter" in query:
        return "next_quarter"
    return "unknown"


@lru_cache(maxsize=100)
def classify_query_intent_cached(query: str) -> str:
    """Cached version of intent classification using Gemini."""
    if not gemini_model:
        logger.warning("Gemini model not available, defaulting to 'data' intent")
        return "data"
    
    prompt = dedent(
        f"""
    Determine the intent of the user's query:
    - **data**: Simple data retrieval or summary (e.g., "show me top 5 accounts", "total bill", "mvne details", "wholesale billing summary", "mvno records").
    - **modification**: Data changes (e.g., "update rate plan").
    - **analysis**: Complex analysis, prediction, or multi-step reasoning (e.g., "predict next month bill", "analyze usage trends").

    **CRITICAL**: If the query mentions MVNE, MVNO, Wholesale, Entities, or specific tables like 'wholesale_billing_summary', it is almost always a **data** intent unless it asks for a prediction.
    Return the intent as a single word: data, modification, or analysis
    """
    )
    try:
        if not gemini_model:
            raise ValueError("Gemini model not available")
            
        response = gemini_model.generate_content(prompt)
        intent = response.text.strip().lower()
        logger.info(f"Classified intent for query '{query}' via Gemini: {intent}")

        # Update token usage for Gemini
        tokens_used = response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else 0
        update_token_usage(GEMINI_API_KEY or "GEMINI_KEY", "gemini", tokens_used)

        return intent if intent in ["data", "modification", "analysis"] else "data"
    except Exception as e:
        logger.warning(f"Error classifying query intent with Gemini: {e}. Falling back to OpenAI.")
        if client:
            try:
                response = client.chat.completions.create(
                    model="gpt-4o-mini", # Use a small, efficient model for intent classification
                    messages=[{"role": "user", "content": prompt}]
                )
                intent = response.choices[0].message.content.strip().lower()
                logger.info(f"Classified intent for query '{query}' via OpenAI: {intent}")
                return intent if intent in ["data", "modification", "analysis"] else "data"
            except Exception as oe:
                logger.error(f"Error classifying query intent with OpenAI fallback: {oe}")
        return "data"


def get_latest_billing_cycle() -> str:
    try:
        with engine.connect() as conn:
            query = "SELECT MAX(billing_cycle) AS latest_cycle FROM billing_data;"
            result = conn.execute(text(query)).scalar()
            logger.info(f"Latest billing cycle fetched: {result}")
            return result if result else "2025-01"
    except Exception as e:
        logger.error(f"Error fetching latest billing cycle: {str(e)}")
        return "2025-01"


# execute_query is now in database.py
    except Exception as e:
        logger.error(f"Error executing query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# def generate_sql_query(user_message: str, history: list[Message], operation: str) -> str:
#     # Compute 'last month' based on current date (2026-01-15)
#     current_date = datetime.datetime(2026, 1, 15)
#     last_month = (current_date - relativedelta(months=1)).strftime('%Y-%m')  # '2025-12'

#     history_str = "\n".join([f"{msg.role}: {msg.content}" for msg in history[-5:]]) if history else "No history."

#     # Full schema string (extract from ai_module.py; ensure it's complete in your code)
#     schema = """
#     wholesale_entities (id, name, type, country, currency, status, created_at)
#     wholesale_plans (id, entity_id, plan_name, plan_type, start_date, end_date, revenue_share_pct, created_at)
#     service_rates (id, plan_id, service_type, rate_per_unit, unit, overage_rate)
#     plan_allowances (id, plan_id, service_type, allowance_amount, allowance_unit, period)
#     monthly_consumption (id, entity_id, plan_id, year_month, voice_minutes_used, sms_count, data_gb_used, created_at)
#     wholesale_billing_cycles (id, entity_id, cycle_start_date, cycle_end_date, billing_period, status, total_amount, created_at)
#     wholesale_billing_records (id, entity_id, plan_id, billing_cycle_id, year_month, service_type, allowance_amount, usage_amount, billable_amount, rate_applied, line_item_amount, created_at)
#     wholesale_billing_summary (id, entity_id, year_month, total_base_cost, total_overage_cost, grand_total, invoice_status, generated_at)
#     rate_plan (rate_plan, bundle_allowance, bundle_fee, home_rate, row_rate, created_at)
#     cdr_data (id, sim_id, data_usage, network, timestamp, country, created_at)
#     billing_data (id, sim_id, account_name, rate_plan, total_usage, usage_from_plan, bundle_allowance, bundle_fee, usage_out_of_bundle, charges_out_of_bundle, total_bill, billing_cycle, wholesale_plan_id, created_at)
#     account_info (id, account_name, sim_id, rate_plan, billing_cycle, created_at)
#     dashboard_metrics (id, billing_cycle, metric_date, total_revenue, gross_profit, net_profit, total_opex, total_cogs, active_accounts, active_sims, new_accounts, lost_accounts, total_usage_gb, avg_cogs_per_account, avg_opex_per_account, accounts_receivable, created_at)
#     performance_analytics (id, billing_cycle, metric_date, account_name, account_segment, payment_performance_score, churn_risk_score, dispute_resolution_days, avg_revenue_per_sim, total_revenue, profitability_score, credit_utilization_percent, discount_usage_percent, avg_discount_rate, discount_sensitivity, optimal_discount_rate, q3_forecast, q4_forecast, yoy_growth_forecast, forecast_confidence_level, total_sims, total_usage_mb)
#     """

#     prompt = dedent(f"""
#     You are an expert PostgreSQL SQL generator. Generate ONLY a single valid SQL query to answer the user's question. Do not include explanations, markdown, or multiple queries.

#     Database schema:
#     {schema}

#     Key rules:
#     - Current date is 2026-01-15. Use this for time filters.
#     - For 'last month': Filter year_month = '{last_month}' (e.g., '2025-12').
#     - For entity names (e.g., 'Gamma Telecom'): JOIN monthly_consumption mc ON wholesale_entities e.id = mc.entity_id and filter WHERE e.name ILIKE '%gamma telecom%'.
#     - Aggregate totals: Use SUM(voice_minutes_used), SUM(sms_count), SUM(data_gb_used) and GROUP BY e.name.
#     - Limit results: Use LIMIT 10 if no specific limit mentioned.
#     - Return only relevant data; avoid SELECT *.
#     - Use ILIKE for case-insensitive string matches.

#     Examples:
#     - User: "How much data, voice, and SMS did Gamma Telecom consume last month?"
#       SQL: SELECT e.name, SUM(mc.data_gb_used) AS total_data_gb, SUM(mc.voice_minutes_used) AS total_voice_minutes, SUM(mc.sms_count) AS total_sms FROM monthly_consumption mc JOIN wholesale_entities e ON mc.entity_id = e.id WHERE e.name ILIKE '%Gamma Telecom%' AND mc.year_month = '{last_month}' GROUP BY e.name;
#     - User: "Top 3 MVNOs by billing total"
#       SQL: SELECT e.name, SUM(s.grand_total) AS total FROM wholesale_billing_summary s JOIN wholesale_entities e ON s.entity_id = e.id WHERE e.type ILIKE '%MVNO%' GROUP BY e.name ORDER BY total DESC LIMIT 3;

#     History: {history_str}

#     User question: {user_message}
#     """)
#     # prompt = dedent(
#     #     f"""
#     # Generate a valid PostgreSQL SQL query for the {operation} operation. The user may ask follow-up or context-aware questions.

#     # You must:
#     # - Use the history below to understand what the user is referring to.
#     # - If the user's request is vague (e.g. "those sims" or "the ones under BMW"), resolve meaning based on history.
#     # - Only use the schema provided below.
#     # - Avoid assuming non-existent columns or structures.
#     # - Output only the SQL query.
    
#     # Only use tables: {tables_str}.

#     # **Database Schema:**
#     # - `cdr_data(sim_id, data_usage, network, timestamp, country)`
#     # - `billing_data(sim_id, account_name, rate_plan, total_usage, total_bill, billing_cycle, usage_from_plan, bundle_allowance, bundle_fee, usage_out_of_bundle, charges_out_of_bundle, wholesale_plan_id)`
#     # - `account_info(account_name, sim_id, rate_plan, billing_cycle)`
#     # - `rate_plan(rate_plan, bundle_allowance, bundle_fee, home_rate, row_rate)`
#     # - `dashboard_metrics(billing_cycle, metric_date, total_revenue, gross_profit, net_profit, total_opex, total_cogs, active_accounts, active_sims, new_accounts, lost_accounts, total_usage_gb, avg_cogs_per_account, avg_opex_per_account, accounts_receivable)`
#     # - `performance_analytics(billing_cycle, metric_date, account_name, account_segment, payment_performance_score, churn_risk_score, dispute_resolution_days, avg_revenue_per_sim, total_revenue, profitability_score, credit_utilization_percent, discount_usage_percent, avg_discount_rate, discount_sensitivity, optimal_discount_rate, q3_forecast, q4_forecast, yoy_growth_forecast, forecast_confidence_level, total_sims, total_usage_mb)`
#     # - `wholesale_entities(id, name, type, country, currency, status)`
#     # - `wholesale_plans(id, entity_id, plan_name, plan_type, start_date, end_date, revenue_share_pct)`
#     # - `service_rates(id, plan_id, service_type, rate_per_unit, unit, overage_rate)`
#     # - `plan_allowances(id, plan_id, service_type, allowance_amount, allowance_unit, period)`
#     # - `monthly_consumption(id, entity_id, plan_id, year_month, voice_minutes_used, sms_count, data_gb_used)`
#     # - `wholesale_billing_cycles(id, entity_id, cycle_start_date, cycle_end_date, billing_period, status, total_amount)`
#     # - `wholesale_billing_records(id, entity_id, plan_id, billing_cycle_id, year_month, service_type, allowance_amount, usage_amount, billable_amount, rate_applied, line_item_amount)`
#     # - `wholesale_billing_summary(id, entity_id, year_month, total_base_cost, total_overage_cost, grand_total, invoice_status)`

#     # **Rules:**
#     # - `billing_cycle` and `year_month` are `character varying` columns in 'YYYY-MM' format (e.g., '2025-01'). Compare them directly without TO_CHAR.
#     # - For CDR queries, use `timestamp` with `DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')` for last month.
#     # - For dashboard_metrics queries, use `metric_date` for date filtering.
#     # - For performance_analytics queries, filter by both `billing_cycle` and `account_name` when needed.
#     # - `account_segment` values are: 'Enterprise', 'Mid-Market', 'SMB', 'Startup'.
#     # - `discount_sensitivity` values are: 'High', 'Medium', 'Low'.
    
#     # **MVNE/Wholesale Rules:**
#     # - "MVNE", "MVNO", "Wholesale Provider", or "Operator" refers to the `wholesale_entities` table.
#     # - JOIN any `wholesale_` table with `wholesale_entities` e ON table.entity_id = e.id.
#     # - If user mentions "MVNO", "MNO", or "MVNA", filter `wholesale_entities.type` ILIKE that type.
#     # - **Service Types**: 'data_domestic' (Data), 'voice_domestic' (Voice), 'sms_mo' (SMS).
#     # - **Usage Columns**: In `monthly_consumption`, use `data_gb_used`, `voice_minutes_used`, `sms_count`.
#     # - **Plan Types**: 'Pool', 'PAYG' are common `plan_type` values in `wholesale_plans`.
#     # - **Date Consistency**: `year_month` (Wholesale) and `billing_cycle` (Retail) are both 'YYYY-MM'.
#     # - **Retail to Wholesale Link**: `billing_data.wholesale_plan_id` joins with `wholesale_plans.id`.
#     # - **IMPORTANT**: When returning results for MVNE/Wholesale queries, select ALL relevant informative columns (e.g., `year_month`, `grand_total`, `invoice_status`, `plan_name`, `usage_amount`) to provide a complete and precise table.

#     # **Few-Shot Examples:**
#     # - User: "Total cost trend for all MVNOs"
#     #   SQL: SELECT e.name AS "Entity Name", s.year_month, s.grand_total FROM wholesale_billing_summary s JOIN wholesale_entities e ON s.entity_id = e.id WHERE e.type ILIKE '%MVNO%' ORDER BY s.year_month ASC;
#     # - User: "Retail accounts linked to Transatel Wholesale Plan"
#     #   SQL: SELECT distinct b.account_name, p.plan_name FROM billing_data b JOIN wholesale_plans p ON b.wholesale_plan_id = p.id JOIN wholesale_entities e ON p.entity_id = e.id WHERE e.name ILIKE '%Transatel%';
#     # - User: "Top overage services for Vodafone last month"
#     #   SQL: SELECT service_type, SUM(billable_amount) as "Billable Overage" FROM wholesale_billing_records r JOIN wholesale_entities e ON r.entity_id = e.id WHERE e.name ILIKE '%Vodafone%' AND year_month = '2025-01' GROUP BY service_type ORDER BY "Billable Overage" DESC;

#     # History: {history_str}
#     # Request: "{user_message}"
#     # Output: Only the SQL query, no explanations or extra text.
#     # - Avoid joins unless specifically required OR if it's an MVNE table that needs the entity name.
#     # - Use clear column aliases (e.g. SELECT name AS "Entity Name", grand_total AS "Total Amount").
#     # - For financial data, format currency with CONCAT('$', ROUND(amount, 2)).
#     # - For percentages, format with CONCAT(ROUND(percentage, 1), '%').
#     # """
#     # )

#     try:
#         if not gemini_model:
#             raise ValueError("Gemini model not available")
            
#         response = gemini_model.generate_content(prompt)
#         sql_query = response.text.strip()
#         sql_query = re.sub(r"^```sql|```$", "", sql_query).strip()
        
#         valid_starts = ("select", "update", "insert into", "with")
#         if not any(sql_query.lower().startswith(start) for start in valid_starts):
#             logger.error(f"Invalid SQL query generated by Gemini: {sql_query}")
#             raise ValueError("Invalid SQL query generated")

#         approx_tokens = len(prompt.split()) + len(sql_query.split())
#         update_token_usage(GEMINI_API_KEY, "gemini", approx_tokens)
        
#         chat_cache[cache_key] = (sql_query, approx_tokens)
#         logger.info(f"Generated and cached SQL Query by Gemini: {sql_query}")
#         return sql_query
        
#     except Exception as e:
#         logger.warning(f"Error generating SQL with Gemini: {e}. Falling back to OpenAI.")
#         if client:
#             try:
#                 response = client.chat.completions.create(
#                     model="gpt-4o-mini",
#                     messages=[{"role": "user", "content": prompt}]
#                 )
#                 sql_query = response.choices[0].message.content.strip()
#                 sql_query = re.sub(r"^```sql|```$", "", sql_query).strip()
                
#                 chat_cache[cache_key] = (sql_query, 0)
#                 logger.info(f"Generated and cached SQL Query by OpenAI: {sql_query}")
#                 return sql_query
#             except Exception as oe:
#                 logger.error(f"Error generating SQL with OpenAI fallback: {oe}", exc_info=True)
#                 raise HTTPException(status_code=500, detail=f"Error generating SQL query with both Gemini and OpenAI. OpenAI Error: {str(oe)}")
        
#         raise HTTPException(status_code=500, detail=f"Error generating SQL query: {str(e)}")


# def generate_analysis(query: str, data: list, history: list[Message]) -> str:
#     cache_key = hashlib.sha256(
#         f"{query}:{str(data)}:{str(history)}".encode()
#     ).hexdigest()

#     if cache_key in chat_cache:
#         cached_response, cached_tokens = chat_cache[cache_key]
#         logger.info(
#             f"Cache hit for analysis: '{query}', Key: {cache_key[:16]}..., Tokens saved (Gemini): {cached_tokens}"
#         )
#         return cached_response

#     if not data:
#         return "No historical data available for analysis."
        
#     data_str = "\n".join([", ".join([f"{k}: {v}" for k, v in d.items()]) for d in data])
#     history_str = (
#         "\n".join([f"{msg.role}: {msg.content[:100]}" for msg in history[-5:]])
#         if history
#         else "No history."
#     )
#     prompt = dedent(
#           f"""
#     Generate a valid PostgreSQL SQL query for the {operation} operation. The user may ask follow-up or context-aware questions.
 
#     You must:
#     - Use the history below to understand what the user is referring to.
#     - If the user's request is vague (e.g. "those sims" or "the ones under BMW"), resolve meaning based on history.
#     - Only use the schema provided below.
#     - Avoid assuming non-existent columns or structures.
#     - Output only the SQL query (no explanation, no markdown).
#     Only use tables: {tables_str}.
 
#     **Database Schema (Retail & Wholesale):**
 
#     Retail Tables:
#     - `cdr_data(id, sim_id, data_usage, network, timestamp, country, created_at)`
#     - `billing_data(id, sim_id, account_name, rate_plan, total_usage, usage_from_plan, bundle_allowance, bundle_fee, usage_out_of_bundle, charges_out_of_bundle, total_bill, billing_cycle, wholesale_plan_id, created_at)`
#     - `account_info(id, account_name, sim_id, rate_plan, billing_cycle, created_at)`
#     - `rate_plan(rate_plan, bundle_allowance, bundle_fee, home_rate, row_rate, created_at)`
 
#     Analytics Tables:
#     - `dashboard_metrics(billing_cycle, metric_date, total_revenue, gross_profit, net_profit, total_opex, total_cogs, active_accounts, active_sims, new_accounts, lost_accounts, total_usage_gb, avg_cogs_per_account, avg_opex_per_account, accounts_receivable, ...)`
#     - `performance_analytics(billing_cycle, metric_date, account_name, account_segment, payment_performance_score, churn_risk_score, ..., total_revenue, total_sims, total_usage_mb, ...)`
 
#     Wholesale Tables (MVNE/MVNO Billing):
#     - `wholesale_entities(id, name, type, country, currency, status, created_at)` 
#       → e.g., 'Vodafone Wholesale', type='MNO'
#     - `wholesale_plans(id, entity_id, plan_name, plan_type, start_date, end_date, revenue_share_pct, created_at)`
#       → e.g., 'Vodafone Standard Pool 2025', plan_type='Capacity-Based'
#     - `service_rates(id, plan_id, service_type, rate_per_unit, unit, overage_rate)`
#       → service_type: 'data_domestic', 'voice_domestic', etc.
#     - `plan_allowances(id, plan_id, service_type, allowance_amount, allowance_unit, period)`
#     - `monthly_consumption(id, entity_id, plan_id, year_month, voice_minutes_used, sms_count, data_gb_used, created_at)`
#     - `wholesale_billing_cycles(id, entity_id, cycle_start_date, cycle_end_date, billing_period, status, total_amount, created_at)`
#     - `wholesale_billing_records(id, entity_id, plan_id, billing_cycle_id, year_month, service_type, allowance_amount, usage_amount, billable_amount, rate_applied, line_item_amount, created_at)`
#     - `wholesale_billing_summary(id, entity_id, year_month, total_base_cost, total_overage_cost, grand_total, invoice_status, generated_at)`
 
#     Common Queries Examples:
#     - "Show me wholesale billing for Vodafone" → join wholesale_billing_summary + wholesale_entities
#     - "What plans does EE have?" → wholesale_plans + wholesale_entities
#     - "How much did we bill Gamma Telecom last month?" → wholesale_billing_summary
#     - "Show overage charges for Transatel" → wholesale_billing_records where billable_amount > allowance
 
#     Conversation History:
#     {history_str}
 
#     User Query: "{user_message}"
 
#     Now generate only the SQL query.
#     """
        
#         # f"""
#     # Analyze or predict based on the query: "{query}"
#     # Data (historical billing/usage): {data_str}
#     # History: {history_str}
#     # Provide a detailed analysis or prediction in a maximum of 200 words using $ for currency.
#     # Base your prediction on historical trends from the provided data.
#     # Format the response with clear paragraphs and markdown for emphasis.
#     # - **First paragraph**: Introduce the query and summarize data.
#     # - **Second paragraph**: Analyze trends and make the prediction.
#     # - **Third paragraph**: Discuss limitations.
#     # """
#     )
    
#     if not gemini_model:
#         return "Gemini analysis is currently unavailable."
        
#     try:
#         response = gemini_model.generate_content(prompt)
#         analysis = response.text.strip()
        
#         # Update token usage for Gemini
#         tokens_used = response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else len(prompt) // 4
#         update_token_usage(GEMINI_API_KEY or "GEMINI_KEY", "gemini", tokens_used)
        
#         lifetime = get_lifetime_totals(GEMINI_API_KEY)
#         daily = token_usage_cache.get(
#             datetime.datetime.now().strftime("%Y-%m-%d"), {}
#         ).get(GEMINI_API_KEY, {"gemini": 0})["gemini"]
#         logger.info(
#             f"Gemini tokens used for query '{query}': {tokens_used}, Lifetime Gemini for key {GEMINI_API_KEY[:8]}...: {lifetime['gemini']}, Daily Gemini: {daily}"
#         )

#         chat_cache[cache_key] = (analysis, tokens_used)
#         logger.info(
#             f"Generated and cached analysis for query: '{query}', Cache Key: {cache_key[:16]}..."
#         )
#         return analysis
#     except Exception as e:
#         logger.error(f"Error generating analysis with ChatGPT: {e}")
#         return f"Analysis error: {str(data)}"

def generate_sql_query(user_message: str, history: List[Message], operation: str) -> str:
    # Extract context
    sim_id_match = re.search(r"sim\s*(\d+)", user_message, re.IGNORECASE)
    sim_id = sim_id_match.group(1) if sim_id_match else "all"
    time_period = resolve_time_period(user_message, datetime.datetime.now())
    normalized_query = normalize_query(user_message)

    # === CRITICAL: Define cache_key BEFORE using it ===
    cache_key = hashlib.sha256(
        f"sql:{normalized_query}:{sim_id}:{time_period}:{operation}".encode()
    ).hexdigest()

    if cache_key in chat_cache:
        cached_sql, tokens = chat_cache[cache_key]
        logger.info(f"SQL Cache hit: {user_message[:50]}...")
        return cached_sql

    logger.info(f"SQL Cache miss: generating for '{user_message}'")

    # Full schema prompt with EXACT columns for all tables
    schema_details = """
    EXACT Database Schema (use ONLY these tables and EXACT column names listed below. Do NOT invent or modify column names like adding 'total_' prefix):

    Retail Tables:
    - cdr_data: id SERIAL PRIMARY KEY, sim_id VARCHAR(255) NOT NULL, data_usage INT NOT NULL DEFAULT 0, network VARCHAR(255) NOT NULL, timestamp TIMESTAMP NOT NULL, country VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - billing_data: id SERIAL PRIMARY KEY, sim_id VARCHAR(255) NOT NULL, account_name VARCHAR(255) NOT NULL, rate_plan VARCHAR(255) NOT NULL, total_usage INT NOT NULL DEFAULT 0, usage_from_plan INT NOT NULL DEFAULT 0, bundle_allowance INT NOT NULL DEFAULT 0, bundle_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00, usage_out_of_bundle INT NOT NULL DEFAULT 0, charges_out_of_bundle DECIMAL(10, 2) NOT NULL DEFAULT 0.00, total_bill DECIMAL(10, 2) NOT NULL DEFAULT 0.00, billing_cycle VARCHAR(7) NOT NULL, wholesale_plan_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - account_info: id SERIAL PRIMARY KEY, account_name VARCHAR(255) NOT NULL, sim_id VARCHAR(255) NOT NULL, rate_plan VARCHAR(255) NOT NULL, billing_cycle VARCHAR(7) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - rate_plan: rate_plan VARCHAR(255) PRIMARY KEY, bundle_allowance INT NOT NULL DEFAULT 0, bundle_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00, home_rate DECIMAL(10, 4) NOT NULL DEFAULT 0.0000, row_rate DECIMAL(10, 4) NOT NULL DEFAULT 0.0000, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

    Analytics Tables:
    - dashboard_metrics: id SERIAL PRIMARY KEY, billing_cycle VARCHAR(7) NOT NULL UNIQUE, metric_date DATE NOT NULL, total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0.00, gross_profit DECIMAL(15,2) NOT NULL DEFAULT 0.00, net_profit DECIMAL(15,2) NOT NULL DEFAULT 0.00, total_opex DECIMAL(15,2) NOT NULL DEFAULT 0.00, total_cogs DECIMAL(15,2) NOT NULL DEFAULT 0.00, active_accounts INTEGER NOT NULL DEFAULT 0, active_sims INTEGER NOT NULL DEFAULT 0, new_accounts INTEGER NOT NULL DEFAULT 0, lost_accounts INTEGER NOT NULL DEFAULT 0, total_usage_gb DECIMAL(15,2) NOT NULL DEFAULT 0.00, avg_cogs_per_account DECIMAL(10,2) NOT NULL DEFAULT 0.00, avg_opex_per_account DECIMAL(10,2) NOT NULL DEFAULT 0.00, accounts_receivable DECIMAL(15,2) NOT NULL DEFAULT 0.00, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - performance_analytics: id SERIAL PRIMARY KEY, billing_cycle VARCHAR(7) NOT NULL, metric_date DATE NOT NULL, account_name VARCHAR(255) NOT NULL, account_segment VARCHAR(50) NOT NULL DEFAULT 'SMB', payment_performance_score DECIMAL(5,2) NOT NULL DEFAULT 0.00, churn_risk_score DECIMAL(5,2) NOT NULL DEFAULT 0.00, dispute_resolution_days DECIMAL(4,2) NOT NULL DEFAULT 0.00, avg_revenue_per_sim DECIMAL(10,2) NOT NULL DEFAULT 0.00, total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0.00, profitability_score INTEGER NOT NULL DEFAULT 0, credit_utilization_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00, discount_usage_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00, avg_discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00, discount_sensitivity VARCHAR(20) NOT NULL DEFAULT 'Medium', optimal_discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00, q3_forecast DECIMAL(15,2) NOT NULL DEFAULT 0.00, q4_forecast DECIMAL(15,2) NOT NULL DEFAULT 0.00, yoy_growth_forecast DECIMAL(5,2) NOT NULL DEFAULT 0.00, forecast_confidence_level DECIMAL(5,2) NOT NULL DEFAULT 0.00, total_sims INTEGER NOT NULL DEFAULT 0, total_usage_mb INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

    Wholesale Tables (MVNE/MVNO):
    - wholesale_entities: id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, type VARCHAR(50), country VARCHAR(100), currency VARCHAR(10) DEFAULT 'USD', status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - wholesale_plans: id SERIAL PRIMARY KEY, entity_id INT REFERENCES wholesale_entities(id), plan_name VARCHAR(255), plan_type VARCHAR(50), start_date DATE, end_date DATE, revenue_share_pct DECIMAL(5,2), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - service_rates: id SERIAL PRIMARY KEY, plan_id INT REFERENCES wholesale_plans(id), service_type VARCHAR(50), rate_per_unit DECIMAL(10, 6), unit VARCHAR(20), overage_rate DECIMAL(10, 6)
    - plan_allowances: id SERIAL PRIMARY KEY, plan_id INT REFERENCES wholesale_plans(id), service_type VARCHAR(50), allowance_amount DECIMAL(15, 2), allowance_unit VARCHAR(50), period VARCHAR(20) DEFAULT 'monthly'
    - monthly_consumption: id SERIAL PRIMARY KEY, entity_id INT REFERENCES wholesale_entities(id), plan_id INT REFERENCES wholesale_plans(id), year_month VARCHAR(7), voice_minutes_used BIGINT, sms_count BIGINT, data_gb_used DECIMAL(15, 2), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - wholesale_billing_cycles: id SERIAL PRIMARY KEY, entity_id INT REFERENCES wholesale_entities(id), cycle_start_date DATE, cycle_end_date DATE, billing_period VARCHAR(20), status VARCHAR(50), total_amount DECIMAL(15, 2), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - wholesale_billing_records: id SERIAL PRIMARY KEY, entity_id INT REFERENCES wholesale_entities(id), plan_id INT REFERENCES wholesale_plans(id), billing_cycle_id INT REFERENCES wholesale_billing_cycles(id), year_month VARCHAR(7), service_type VARCHAR(50), allowance_amount DECIMAL(15, 2), usage_amount DECIMAL(15, 2), billable_amount DECIMAL(15, 2), rate_applied DECIMAL(10, 6), line_item_amount DECIMAL(15, 2), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    - wholesale_billing_summary: id SERIAL PRIMARY KEY, entity_id INT REFERENCES wholesale_entities(id), year_month VARCHAR(7), total_base_cost DECIMAL(15, 2), total_overage_cost DECIMAL(15, 2), grand_total DECIMAL(15, 2), invoice_status VARCHAR(50), generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    """

    allowed_tables = [
        "cdr_data", "billing_data", "account_info", "rate_plan",
        "dashboard_metrics", "performance_analytics",
        "wholesale_entities", "wholesale_plans", "service_rates",
        "plan_allowances", "monthly_consumption",
        "wholesale_billing_cycles", "wholesale_billing_records",
        "wholesale_billing_summary"
    ]

    history_str = "\n".join([f"{m.role}: {m.content}" for m in history[-8:]]) if history else "None"

    prompt = dedent(f"""
    You are an expert PostgreSQL analyst for a telecom MVNO/MVNE platform.
    Generate ONLY a valid PostgreSQL SELECT query based on the user question.
    Do not explain, do not wrap in markdown. Output ONLY the SQL.

    {schema_details}

    Key rules:
    - Use ONLY the EXACT column names listed above. Do NOT invent, modify, or add prefixes like 'total_' to columns (e.g., use 'data_gb_used' NOT 'total_data_gb').
    - For aggregation like SUM, use SUM(column_name) where column_name is exact (e.g., SUM(data_gb_used) for data).
    - For "last month" or "latest": use year_month = (SELECT MAX(year_month) FROM table)
    - Always JOIN properly: e.g., wholesale_entities.id = wholesale_plans.entity_id
    - Filter by name using LOWER(we.name) = LOWER('entity name') for case-insensitivity if needed.
    - If summing across multiple rows/plans, use SUM() over the group.
    - Return aggregated results if asking for totals.

    Conversation history (for context):
    {history_str}

    User question: "{user_message}"

    Generate only the SQL query.
    """)

    try:
        response = gemini_model.generate_content(prompt)
        sql = response.text.strip().replace('```sql', '').replace('```', '').strip()
        if sql.upper().startswith("SELECT"):
            # Cache only valid SELECTs
            approx_tokens = len(prompt.split()) + len(sql.split())
            chat_cache[cache_key] = (sql, approx_tokens)
        return sql
    except Exception as e:
        logger.error(f"Gemini SQL generation failed: {e}")
        return "SELECT 'Error generating query' AS error;"
    
    
def generate_analysis(query: str, data: list, history: List[Message]) -> str:
    data_str = str(sorted(data)) if data else "no_data"
    history_str = str([(m.role, m.content) for m in history[-6:]])
    cache_key = hashlib.sha256(f"analysis:{query}:{data_str}:{history_str}".encode()).hexdigest()

    if cache_key in chat_cache:
        cached_resp, tokens = chat_cache[cache_key]
        logger.info("Analysis cache hit")
        return cached_resp

    prompt = dedent(f"""
    You are a senior telecom billing analyst.
    Answer the user's question using the provided data in clear, professional English.
    Use bullet points, highlight trends, risks, top performers.
    For wholesale queries, mention entity names clearly.

    Question: "{query}"
    Data ({len(data)} records): {str(data[:15])}
    History: {history_str[:500]}

    Respond in markdown.
    """)

    try:
        response = gemini_model.generate_content(prompt)
        text = response.text.strip()
        tokens = len(prompt.split()) + len(text.split())
        chat_cache[cache_key] = (text, tokens)
        return text
    except Exception as e:
        return f"Analysis failed: {str(e)}"


async def stream_response(text: str):
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    openai_usage = token_usage_cache.get(today, {}).get(
        OPENAI_API_KEY, {"openai": 0, "gemini": 0}
    )
    gemini_usage = token_usage_cache.get(today, {}).get(
        GEMINI_API_KEY, {"openai": 0, "gemini": 0}
    )
    usage_text = ""
    # usage_text = (
    #     f"\n\n**Token Usage Today ({today})**: "
    #     f"OpenAI (key {OPENAI_API_KEY[:8]}...): {openai_usage['openai']} tokens, "
    #     f"Gemini (key {GEMINI_API_KEY[:8]}...): {gemini_usage['gemini']} tokens"
    # )
    full_text = text + usage_text

    for line in full_text.split("\n"):
        if line.strip():
            for word in line.split():
                yield word + " "
                await asyncio.sleep(0.03)
            yield "\n"
        else:
            yield "\n"
        await asyncio.sleep(0.1)


async def format_analysis_response(text: str):
    for line in text.split("\n"):
        yield line + "\n"
        await asyncio.sleep(0.03)


def fetch_paginated_data(query: str, params=None, export_all: bool = False):
    try:
        with engine.connect() as conn:
            if export_all:
                result = pd.read_sql_query(text(query), conn, params=params)
                data = result.to_dict(orient="records")
                total = len(data)
            else:
                result = pd.read_sql_query(text(query), conn, params=params)
                data = result.to_dict(orient="records")
                count_query = (
                    "SELECT COUNT(*) as total FROM ("
                    + query.split("LIMIT")[0].split("OFFSET")[0]
                    + ") subquery"
                )
                total = conn.execute(text(count_query), params).scalar()
            logger.info(f"Fetched {len(data)} rows with total count: {total}")
            return {"data": data, "total": total}
    except Exception as e:
        logger.error(f"Error fetching paginated data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        engine.dispose()


# API Endpoints
@app.post("/chat/gemini")
async def chat_gemini(request: ChatRequest):
    logger.info(f"Received payload for /chat/gemini: {request.dict()}")
    try:
        intent = classify_query_intent_cached(request.query)
        operation = infer_operation_from_intent(intent, request.query)
        if operation != "SELECT":
            raise HTTPException(
                status_code=400,
                detail="Gemini only supports SELECT operations for data retrieval",
            )

        sql_query = generate_sql_query(request.query, request.history, operation)
        data = execute_query(sql_query)

        if not data:
            logger.warning("No data found for query")
            return StreamingResponse(
                stream_response("No relevant data found."), media_type="text/plain"
            )

        if isinstance(data, str):
            return StreamingResponse(stream_response(data), media_type="text/plain")
        return data
    except Exception as e:
        logger.error(f"Error in /chat/gemini: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/chat/openai")
async def chat_openai(request: ChatRequest):
    logger.info(f"Received payload for /chat/openai: {request.dict()}")
    try:
        intent = classify_query_intent_cached(request.query)
        operation = infer_operation_from_intent(intent, request.query)

        if operation == "SELECT" and intent != "analysis":
            raise HTTPException(
                status_code=400,
                detail="Simple SELECT queries must be sent to /chat/gemini. Use /chat/openai for modifications or predictions.",
            )

        sql_query = generate_sql_query(request.query, request.history, operation)
        data = execute_query(sql_query)

        if not data:
            logger.warning("No data found for query")
            return StreamingResponse(
                stream_response("No relevant data found."), media_type="text/plain"
            )

        if intent == "analysis":
            analysis = generate_analysis(request.query, data, request.history)
            return StreamingResponse(stream_response(analysis), media_type="text/plain")

        if isinstance(data, str):
            return StreamingResponse(stream_response(data), media_type="text/plain")
        return data
    except Exception as e:
        logger.error(f"Error in /chat/openai: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/chat")
async def chat(request: ChatRequest):
    logger.info(f"Received payload for /chat: {request.dict()}")
    try:
        intent = classify_query_intent_cached(request.query)
        operation = infer_operation_from_intent(intent, request.query)

        sql_query = generate_sql_query(request.query, request.history, operation)
        data = execute_query(sql_query)

        if not data:
            logger.warning("No data found for query")
            return StreamingResponse(
                stream_response("No relevant data found."), media_type="text/plain"
            )

        if intent == "data":
            logger.info(f"Returning raw data for intent 'data': {data}")
            return data
        elif intent == "analysis":
            logger.info(f"Generating analysis for intent 'analysis' with data: {data}")
            analysis = generate_analysis(request.query, data, request.history)
            return StreamingResponse(stream_response(analysis), media_type="text/plain")
        elif intent == "modification":
            logger.info(f"Returning modification result: {data}")
            if isinstance(data, str):
                return StreamingResponse(stream_response(data), media_type="text/plain")
            return data

    except Exception as e:
        logger.error(f"Error in /chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/top10_sims_by_bill")
async def top10_sims_by_bill():
    try:
        latest_cycle = get_latest_billing_cycle()
        query = """
            SELECT account_name, sim_id, rate_plan, total_usage, total_bill, billing_cycle
            FROM billing_data
            WHERE billing_cycle = :cycle
            ORDER BY total_bill DESC
            LIMIT 10;
        """
        params = {"cycle": latest_cycle}
        data = fetch_data(query, params)
        if not data:
            logger.warning(
                f"No data found for top 10 SIMs by bill in cycle {latest_cycle}"
            )
            return {"message": f"No data available for billing cycle {latest_cycle}"}
        return data
    except Exception as e:
        logger.error(f"Error in /top10_sims_by_bill: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching top 10 SIMs by bill: {str(e)}"
        )


@app.post("/create_rate_plan")
async def create_rate_plan(rate_plan: RatePlan):
    logger.info(f"Received payload for /create_rate_plan: {rate_plan.dict()}")
    try:
        query = """
            INSERT INTO rate_plan (rate_plan, bundle_allowance, bundle_fee, home_rate, row_rate)
            VALUES (:rate_plan, :bundle_allowance, :bundle_fee, :home_rate, :row_rate)
        """
        params = rate_plan.dict()
        result = execute_query(query, params)
        return StreamingResponse(stream_response(result), media_type="text/plain")
    except Exception as e:
        logger.error(f"Error in /create_rate_plan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/total-usage-per-plan")
async def total_usage_per_plan():
    try:
        latest_cycle = get_latest_billing_cycle()
        query = """
            SELECT bd.rate_plan, 
                   CAST(SUM(bd.total_usage) / 1024 AS DECIMAL(10,2)) AS total_usage_gb
            FROM billing_data bd
            WHERE bd.billing_cycle = :cycle
            GROUP BY bd.rate_plan
            ORDER BY SUM(bd.total_usage) DESC;
        """
        params = {"cycle": latest_cycle}
        data = fetch_data(query, params)
        if not data:
            logger.warning(
                f"No data found for total usage per plan in cycle {latest_cycle}"
            )
            return {"message": f"No data available for billing cycle {latest_cycle}"}
        return data
    except Exception as e:
        logger.error(f"Error in /total-usage-per-plan: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching total usage per plan: {str(e)}"
        )


@app.get("/top-accounts-by-bill")
async def top_accounts_by_bill():
    try:
        latest_cycle = get_latest_billing_cycle()
        query = """
            SELECT account_name, 
                   CAST(SUM(total_bill) AS DECIMAL(10,1)) AS total_bill_last_month
            FROM billing_data
            WHERE billing_cycle = :cycle
            GROUP BY account_name, billing_cycle
            ORDER BY SUM(total_bill) DESC
            LIMIT 10;
        """
        params = {"cycle": latest_cycle}
        data = fetch_data(query, params)
        if not data:
            logger.warning(
                f"No data found for top accounts by bill in cycle {latest_cycle}"
            )
            return {"message": f"No data available for billing cycle {latest_cycle}"}
        return data
    except Exception as e:
        logger.error(f"Error in /top-accounts-by-bill: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching top accounts by bill: {str(e)}"
        )


@app.get("/top-accounts-by-usage")
async def top_accounts_by_usage():
    try:
        latest_cycle = get_latest_billing_cycle()
        latest_date = datetime.datetime.strptime(latest_cycle, "%Y-%m")
        cycle_minus_1 = latest_cycle
        cycle_minus_2 = (latest_date - relativedelta(months=1)).strftime("%Y-%m")

        logger.info(
            f"Fetching top accounts by usage for cycles: {cycle_minus_1}, {cycle_minus_2}"
        )

        query = """
            WITH top_accounts AS (
                SELECT account_name
                FROM billing_data
                WHERE billing_cycle = :cycle_minus_1
                GROUP BY account_name
                ORDER BY SUM(total_usage) DESC
                LIMIT 5
            )
            SELECT bd.account_name, 
                   bd.billing_cycle,
                   CAST(SUM(bd.total_usage) / 1024 AS DECIMAL(10,2)) AS total_usage_gb
            FROM billing_data bd
            JOIN top_accounts ta ON bd.account_name = ta.account_name
            WHERE bd.billing_cycle IN (:cycle_minus_1, :cycle_minus_2)
            GROUP BY bd.account_name, bd.billing_cycle
            ORDER BY bd.account_name, bd.billing_cycle DESC;
        """
        params = {"cycle_minus_1": cycle_minus_1, "cycle_minus_2": cycle_minus_2}
        data = fetch_data(query, params)
        if not data:
            logger.warning(
                f"No data found for top accounts by usage in cycles {cycle_minus_1}, {cycle_minus_2}"
            )
            return {
                "message": f"No data available for billing cycles {cycle_minus_1} or {cycle_minus_2}"
            }
        return data
    except Exception as e:
        logger.error(f"Error in /top-accounts-by-usage: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching top accounts by usage: {str(e)}"
        )


@app.get("/accounts-by-sim-count")
async def accounts_by_sim_count():
    try:
        query = """
            SELECT account_name, COUNT(DISTINCT sim_id) AS number_of_sims
            FROM billing_data
            GROUP BY account_name
            ORDER BY number_of_sims DESC;
        """
        data = fetch_data(query)
        if not data:
            logger.warning("No data found for accounts by SIM count")
            return {"message": "No accounts or SIMs found in the database"}
        return data
    except Exception as e:
        logger.error(f"Error in /accounts-by-sim-count: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching accounts by SIM count: {str(e)}"
        )


@app.get("/top-charged-sims")
def top_charged_sims():
    query = """
        SELECT account_name, sim_id, rate_plan, total_usage, total_bill, billing_cycle
        FROM billing_data bd
        ORDER BY billing_cycle DESC, total_bill DESC
        LIMIT 10;
    """
    return fetch_data(query)


@app.get("/aggregate-usage")
def aggregate_usage():
    query = """
        SELECT network, CAST((SUM(data_usage) / 1024) AS DECIMAL(10,2)) AS total_usage
        FROM cdr_data
        GROUP BY network
        ORDER BY total_usage DESC
        LIMIT 10;
    """
    return fetch_data(query)


# Top Rate Plan by Usage: Converts usage from KB to GB for better readability
@app.get("/total-usage-per-plan")
def total_usage_per_plan():
    query = """
        SELECT bd.rate_plan, CONCAT(CAST((SUM(bd.usage_from_plan) / 1024) AS DECIMAL(10,2)), ' GB') AS total_usage
        FROM billing_data bd
        WHERE bd.billing_cycle = TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'), 'YYYY-MM')
        GROUP BY bd.rate_plan
        ORDER BY SUM(bd.usage_from_plan) DESC;
    """
    return fetch_data(query)


# Billing summary needs to include Account name as well as additional column, and it should be the first column.
@app.get("/billing-summary")
def billing_summary():
    query = """
        SELECT account_name, COUNT(DISTINCT sim_id) AS num_sims, CONCAT('$ ', SUM(total_bill)) AS total_bill, CONCAT(CAST((SUM(usage_out_of_bundle) / 1024) / 1024 AS DECIMAL(10,2)), ' GB') AS total_oob_usage
        FROM billing_data 
        GROUP BY account_name
        ORDER BY total_bill DESC;
    """
    return fetch_data(query)


@app.get("/billing-total")
def billing_total():
    query = "SELECT SUM(total_bill) AS bill_total FROM billing_data;"
    return fetch_data(query)


@app.get("/sim-total")
def sim_total():
    query = "SELECT COUNT(DISTINCT sim_id) AS total_sims FROM billing_data"
    return fetch_data(query)


@app.get("/top-accounts-usage")
def top_accounts_usage():
    query = """
    WITH last_month AS (SELECT TO_CHAR(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month', 'YYYY-MM') AS billing_month)
        SELECT account_name, CONCAT(CAST((SUM(total_usage) / 1024) AS DECIMAL(10,2)), ' GB') AS total_usage, COUNT(sim_id) AS number_of_sims 
        FROM billing_data 
        WHERE billing_cycle = (SELECT billing_month FROM last_month)
        GROUP BY account_name 
        ORDER BY total_usage DESC 
        LIMIT 3;
    """
    return fetch_data(query)


@app.get("/top-accounts-bill")
def top_accounts_bill():
    query = """
    WITH last_month AS (SELECT TO_CHAR(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month', 'YYYY-MM') AS billing_month)
        SELECT account_name, SUM(total_bill) AS total_bill
        FROM billing_data
        WHERE billing_cycle = (SELECT billing_month FROM last_month)
        GROUP BY account_name 
        ORDER BY total_bill DESC 
        LIMIT 3;
    """
    # SELECT account_name, CONCAT('£ ', SUM(total_bill)) AS total_bill, COUNT(sim_id) AS number_of_sims
    return fetch_data(query)


############################################################ Parameterised APIs ############################################################

# Top X Network by usage: Change this to show the usage converted into latest unit like MB vs GB vs TB, conversion logic needs to be written down, values in DB are in KB.

# NEEDS CORRECTION


@app.get("/aggregate-usage")
def aggregate_usage():
    query = """
    WITH val1 AS (SELECT 5 AS limit_value) 
        SELECT network, CAST((SUM(data_usage) /1024) /1024 AS DECIMAL(10,2)) AS total_usage
        FROM cdr_data
        GROUP BY network
        ORDER BY total_usage DESC
        LIMIT (SELECT limit_value FROM val1);
    """
    # SELECT network, CONCAT(CAST((SUM(data_usage) /1024) /1024 AS DECIMAL(10,2)), ' GB') AS total_usage
    return fetch_data(query)


# 2 - show top x SIMs per rate plan by usage - columns - Account, SIM, Rate plan, usage


@app.get("/topx-rateplan-oobusage")
def topx_rateplan_oobusage():
    query = """
    WITH val1 AS (SELECT 5 AS limit_value),
        last_month AS (SELECT TO_CHAR(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month', 'YYYY-MM') AS billing_month)
        SELECT DISTINCT ON (account_name) account_name, sim_id, rate_plan, usage_out_of_bundle || ' bytes' AS max_oob_usage
        FROM billing_data
        WHERE billing_cycle = (SELECT billing_month FROM last_month)
        ORDER BY account_name, usage_out_of_bundle DESC
        LIMIT (SELECT limit_value FROM val1);
    """
    return fetch_data(query)


@app.get("/topx-rateplan-bill")
def topx_rateplan_bill():
    query = """
    WITH val1 AS (SELECT 5 AS limit_value),
        last_month AS (SELECT TO_CHAR(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month', 'YYYY-MM') AS billing_month)
        SELECT DISTINCT ON (account_name) account_name, sim_id, rate_plan, charges_out_of_bundle AS max_oob_bill
        FROM billing_data
        WHERE billing_cycle = (SELECT billing_month FROM last_month)
        ORDER BY account_name, charges_out_of_bundle DESC
        LIMIT (SELECT limit_value FROM val1);
    """
    return fetch_data(query)


@app.get("/topx-sims-bill")
def topx_sims_bill():
    query = """
    WITH val1 AS (SELECT 5 AS limit_value),
        last_month AS (SELECT TO_CHAR(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month', 'YYYY-MM') AS billing_month)
        SELECT DISTINCT ON (account_name) account_name, sim_id, total_bill
        FROM billing_data
        WHERE billing_cycle = (SELECT billing_month FROM last_month)
        ORDER BY account_name, total_bill DESC
        LIMIT (SELECT limit_value FROM val1);
    """
    return fetch_data(query)


@app.get("/topx-sims-usage")
def topx_sims_usage():
    query = """
    WITH val1 AS (SELECT 5 AS limit_value),
        last_month AS (SELECT TO_CHAR(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month', 'YYYY-MM') AS billing_month)
        SELECT DISTINCT ON (account_name) account_name, sim_id, total_usage
        FROM billing_data
        WHERE billing_cycle = (SELECT billing_month FROM last_month)
        ORDER BY account_name, total_usage DESC
        LIMIT (SELECT limit_value FROM val1);
    """
    return fetch_data(query)


@app.get("/topx-accounts-usage")
def topx_accounts_usage():
    query = """
    WITH val1 AS (SELECT 5 AS limit_value),
        last_month AS (SELECT TO_CHAR(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month', 'YYYY-MM') AS billing_month)
        SELECT account_name, 
               CONCAT(CAST((SUM(total_usage) / 1024) / 1024 AS DECIMAL(10,2)), ' GB') AS total_usage, 
               COUNT(sim_id) AS number_of_sims 
        FROM billing_data 
        WHERE billing_cycle = (SELECT billing_month FROM last_month)
        GROUP BY account_name 
        ORDER BY total_usage DESC 
        LIMIT (SELECT limit_value FROM val1);
    """
    return fetch_data(query)


@app.get("/topx-accounts-bill")
def topx_accounts_bill():
    query = """
    WITH val1 AS (SELECT 5 AS limit_value), 
        last_month AS (SELECT TO_CHAR(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month', 'YYYY-MM') AS billing_month)
        SELECT account_name, SUM(total_bill) AS total_bill, COUNT(sim_id) AS number_of_sims
        FROM billing_data
        WHERE billing_cycle = (SELECT billing_month FROM last_month)
        GROUP BY account_name 
        ORDER BY total_bill DESC 
        LIMIT (SELECT limit_value FROM val1);
    """
    # SELECT account_name, CONCAT('£ ', SUM(total_bill)) AS total_bill, COUNT(sim_id) AS number_of_sims
    return fetch_data(query)


@app.get("/cdr-records-history")
def cdr_records_history():
    query = """
    WITH Monthly_CDRs AS (
        SELECT 
            TO_CHAR(timestamp, 'Mon YYYY') AS month_year,
            COUNT(*) AS total_cdrs
        FROM cdr_data
        WHERE timestamp >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months' 
        GROUP BY month_year 
        ORDER BY MIN(timestamp)
    )
    SELECT 
        (SELECT COUNT(*) 
         FROM cdr_data 
         WHERE DATE_TRUNC('month', timestamp) = DATE_TRUNC('month', CURRENT_DATE)) AS current_month_cdrs, 
        month_year AS month, 
        total_cdrs
    FROM Monthly_CDRs;
    """
    return fetch_data(query)


@app.get("/billing-history")
def billing_history():
    query = """
    WITH Monthly_Bills AS (
        SELECT 
            TO_CHAR(TO_DATE(billing_cycle, 'YYYY-MM'), 'Mon YYYY') AS month_year, 
            SUM(total_bill) AS total_bill
        FROM billing_data
        WHERE TO_DATE(billing_cycle, 'YYYY-MM') >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '6 months'
          AND TO_DATE(billing_cycle, 'YYYY-MM') < DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY month_year
        ORDER BY MIN(TO_DATE(billing_cycle, 'YYYY-MM'))
    )
    SELECT month_year AS month, total_bill FROM Monthly_Bills;
    """
    return fetch_data(query)


@app.get("/sim-total-history")
def sim_total_history():
    query = """
    WITH Monthly_Sims AS (
        SELECT 
            TO_CHAR(TO_DATE(billing_cycle, 'YYYY-MM'), 'Mon YYYY') AS month_year,
            COUNT(DISTINCT sim_id) AS total_sims
        FROM billing_data
        WHERE TO_DATE(billing_cycle, 'YYYY-MM') >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY billing_cycle
        ORDER BY MIN(TO_DATE(billing_cycle, 'YYYY-MM'))
    )
    SELECT 
        (SELECT COUNT(DISTINCT sim_id) 
         FROM billing_data 
         WHERE billing_cycle = (SELECT MAX(billing_cycle) FROM billing_data)) AS current_month_sims,
        month_year AS month,
        total_sims
    FROM Monthly_Sims;
    """
    return fetch_data(query)


@app.get("/account-total-history")
def account_total_history():
    query = """
    WITH Monthly_Accounts AS (
        SELECT 
            TO_CHAR(TO_DATE(billing_cycle, 'YYYY-MM'), 'Mon YYYY') AS month_year,
            COUNT(DISTINCT account_name) AS total_accounts
        FROM billing_data
        WHERE TO_DATE(billing_cycle, 'YYYY-MM') >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY month_year
        ORDER BY MIN(TO_DATE(billing_cycle, 'YYYY-MM'))
    )
    SELECT 
        month_year AS month,
        total_accounts
    FROM Monthly_Accounts;
    """
    return fetch_data(query)


# Bar chart on Dashboard: Shows top 10 accounts by last month's bill
@app.get("/top-accounts-by-bill")
def top_accounts_by_bill():
    query = """
        SELECT account_name, 
               CAST(SUM(total_bill) AS DECIMAL(10,1)) AS total_bill_last_month
        FROM billing_data
        WHERE billing_cycle = TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'), 'YYYY-MM')
        GROUP BY account_name, billing_cycle
        ORDER BY SUM(total_bill) DESC
        LIMIT 10;
    """
    return fetch_data(query)


# Top 5 accounts by previous 2 months usage
@app.get("/top-accounts-by-usage")
def top_accounts_by_usage():
    query = """
        WITH top_accounts AS (
            SELECT account_name
            FROM billing_data
            WHERE billing_cycle = TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'), 'YYYY-MM')
            GROUP BY account_name
            ORDER BY SUM(total_usage) DESC
            LIMIT 5
        )
        SELECT bd.account_name, 
               bd.billing_cycle,
               CAST(SUM(bd.total_usage) / 1024 AS DECIMAL(10,2)) AS total_usage_gb
        FROM billing_data bd
        JOIN top_accounts ta ON bd.account_name = ta.account_name
        WHERE bd.billing_cycle IN (
            TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'), 'YYYY-MM'),
            TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '2 month'), 'YYYY-MM')
        )
        GROUP BY bd.account_name, bd.billing_cycle
        ORDER BY bd.account_name, bd.billing_cycle DESC;
    """
    return fetch_data(query)


@app.get("/accounts-by-sim-count")
def accounts_by_sim_count():
    query = """
        SELECT account_name, COUNT(DISTINCT sim_id) AS number_of_sims
        FROM billing_data
        GROUP BY account_name
        ORDER BY number_of_sims DESC;
    """
    return fetch_data(query)


# New Functions/APIs added on 18th Feb
@app.get("/get_rate_plan_details")
def get_rate_plan_details():
    query = """
        SELECT * FROM rate_plan;
    """
    return fetch_data(query)


@app.get("/top10_sims_by_usage")
def top10_sims_by_usage():
    query = """
        SELECT account_name, sim_id, rate_plan, SUM(total_usage) AS total_usage
        FROM billing_data
        WHERE billing_cycle = TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'), 'YYYY-MM')
        GROUP BY account_name, sim_id, rate_plan
        ORDER BY total_usage DESC
        LIMIT 10;
    """
    return fetch_data(query)


@app.get("/top10_sims_by_bill")
def top10_sims_by_bill():
    query = """
        SELECT account_name, sim_id, rate_plan, total_bill, billing_cycle, SUM(total_usage) AS total_usage
        FROM billing_data
        WHERE billing_cycle = TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'), 'YYYY-MM')
        GROUP BY account_name, sim_id, rate_plan, billing_cycle, total_bill
        ORDER BY total_bill DESC
        LIMIT 10;
    """
    return fetch_data(query)


@app.get("/get_account_info")
async def get_account_info(
    page: int = 1,
    limit: int = 10,
    search: Optional[str] = None,
    search_field: Optional[str] = "account_name",
    filter_type: Optional[str] = "contains",
    sort_by: str = "sim_id",
    sort_order: str = "asc",
    export_all: bool = False,
):
    try:
        valid_columns = ["account_name", "sim_id", "rate_plan", "billing_cycle"]
        sort_by = sort_by if sort_by in valid_columns else "sim_id"
        sort_order = sort_order.lower() if sort_order in ["asc", "desc"] else "asc"
        valid_search_fields = ["account_name", "sim_id"]
        search_field = (
            search_field if search_field in valid_search_fields else "account_name"
        )
        valid_filter_types = ["exact", "contains"]
        filter_type = filter_type if filter_type in valid_filter_types else "contains"

        latest_cycle = get_latest_billing_cycle()
        query = """
            SELECT account_name, sim_id, rate_plan, billing_cycle
            FROM account_info
            WHERE billing_cycle = :cycle
        """
        params = {"cycle": latest_cycle}

        if search and search.strip():
            search_term = (
                search.lower() if filter_type == "exact" else f"%{search.lower()}%"
            )
            query += f" AND LOWER({search_field}) {'=' if filter_type == 'exact' else 'LIKE'} :search"
            params["search"] = search_term

        query += f" ORDER BY {sort_by} {sort_order.upper()}"
        if not export_all:
            offset = (page - 1) * limit
            query += " LIMIT :limit OFFSET :offset"
            params["limit"] = limit
            params["offset"] = offset

        print(f"Query: {query}, Params: {params}")

        result = fetch_paginated_data(query, params, export_all)
        if not result["data"]:
            logger.warning(f"No data found for account info in cycle {latest_cycle}")
            return {
                "data": [],
                "total": 0,
                "message": f"No data available for billing cycle {latest_cycle}",
            }
        return result
    except Exception as e:
        logger.error(f"Error in get_account_info: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching account info: {str(e)}"
        )


@app.get("/accounts_bill_past_six_months")
def accounts_bill_past_six_months():
    query = """
        SELECT billing_cycle, CAST(SUM(total_bill) AS DECIMAL(10,2)) AS total_bill
        FROM billing_data
        WHERE billing_cycle >= TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months'), 'YYYY-MM')
        GROUP BY billing_cycle
        ORDER BY billing_cycle ASC
        LIMIT 6;
    """
    return fetch_data(query)


@app.get("/accounts_usage_past_six_months")
def accounts_usage_past_six_months():
    query = """
        SELECT billing_cycle, CAST(SUM(total_usage) / 1024 AS DECIMAL(10,2)) AS total_usage
        FROM billing_data
        WHERE billing_cycle >= TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months'), 'YYYY-MM')
        GROUP BY billing_cycle
        ORDER BY billing_cycle ASC
        LIMIT 6;
    """
    return fetch_data(query)


@app.get("/rate_plan_usage_last_billing_cycle")
def rate_plan_usage_last_billing_cycle():
    query = """
        SELECT 
            bd.rate_plan, 
            CAST(SUM(bd.total_usage) / 1024 AS DECIMAL(10,2)) AS total_usage
        FROM billing_data bd
        WHERE bd.billing_cycle = (
            SELECT MAX(billing_cycle) FROM billing_data
        )
        GROUP BY bd.rate_plan
        ORDER BY bd.rate_plan;
    """
    return fetch_data(query)


@app.get("/health")
def health_check():
    logger.info("Health check requested")
    return {"status": "FastAPI server is running."}


CAPABILITY_SET = """
### Chatbot Capability Set

#### Overview
The Billing AI Chatbot interacts with billing, account, dashboard, and performance data stored in a PostgreSQL database. It uses OpenAI's GPT-4o-mini for intent classification and analysis, and Google Gemini for SQL generation, integrated with a FastAPI backend.

#### Data Retrieval
- **Predefined Queries**: Supports specific queries mapped to API endpoints:
  - `top 10 sims by bill`: Retrieves top 10 SIMs by bill from the latest billing month.
  - `total bill`: Shows total bill across all SIMs with currency ($).
  - `billing summary`: Summarizes billing by rate plan.
  - `dashboard summary`: Company-wide financial metrics for latest month.
  - `performance summary`: Top 10 accounts by performance metrics.
  - `high churn risk accounts`: Accounts with churn risk score > 20.
  - Full list includes: 
    - `top rate plan by usage`: Usage per rate plan in GB.
    - `top network by usage`: Aggregated usage by network in GB.
    - `total sims`: Counts unique SIMs.
    - `sim count per account`: SIMs per account.
    - `top accounts by usage/bill`: Top accounts by usage or bill for last month.
    - Trends: `account total trend`, `sim total trend`, `billing history`, `cdr records trend`.
    - `rate plan details`: Full rate plan information.
    - `top 10 sims by usage`: Top SIMs by usage for last month.

- **Dynamic Queries**: Generates SQL for custom retrieval using the database schema:
  - Example: "Show total usage for BMW" → `SELECT SUM(total_usage) FROM billing_data WHERE account_name = 'BMW';`.
  - Example: "Show dashboard metrics for last 3 months" → `SELECT * FROM dashboard_metrics WHERE billing_cycle >= '2024-10';`.
  - Example: "Which accounts have high payment scores?" → `SELECT account_name, payment_performance_score FROM performance_analytics WHERE payment_performance_score > 85;`.
  - Supports queries across `cdr_data`, `billing_data`, `account_info`, `rate_plan`, `dashboard_metrics`, and `performance_analytics` tables.

#### New Analytics Capabilities
- **Dashboard Metrics**: Company-wide financial analysis including revenue, profit, OPEX, COGS, account growth.
- **Performance Analytics**: Account-level performance including payment scores, churn risk, profitability, discount analysis.
- **Financial Forecasting**: Q3/Q4 forecasts, YoY growth predictions with confidence levels.
- **Risk Analysis**: Churn risk scoring, payment performance tracking, dispute resolution metrics.
- **Segment Analysis**: Enterprise, Mid-Market, SMB, and Startup customer segmentation.

#### Data Modification
- **Updates**: Modifies existing records in all tables.
- **Inserts**: Adds new records to all tables.
- Returns success messages (e.g., "Success, updated 1 row").

#### Data Analysis
- Provides insights for complex queries across all data sources.
- Uses conversation history for context-aware insights.
- Can correlate billing data with performance metrics.

#### User Features
- **Speech Recognition**: Supports voice input via Web Speech API.
- **Chat History**: Persistable in sessionStorage, exportable as text with ASCII-formatted tables.
- **Suggested Questions**: Predefined buttons for quick queries (e.g., "Top 10 SIMs by bill").
- **Real-time Responses**: Streams non-table responses word-by-word.
- **New Chat**: Clears history with an option to export first.

#### Account Page Features
- **Table Display**: Paginated, sortable, searchable table of `account_info` for the last month.
- **Filtering**: Supports `exact` or `contains` on `account_name` and `sim_id`.
- **Sorting**: Available on all columns (`account_name`, `sim_id`, `rate_plan`, `billing_cycle`).
- **Row Selection**: Checkboxes for selecting rows.
- **CSV Export**: Options for current page or all records (up to 135,245 rows tested).
- **Actions**: Placeholder for changing rate plans (e.g., "Change Rate Plan" button).

#### Additional Features
- **Multi-language Support**: Planned as a future enhancement (not currently implemented).
- **Error Handling**: Returns user-friendly messages (e.g., "No data found") for empty results or errors.

#### Limitations
- **No Deletion**: Does not support deleting records (e.g., "Delete SIM123" is not implemented).
- **Scope**: Limited to billing/account data within the specified PostgreSQL schema; cannot handle unrelated tasks (e.g., stock predictions).
- **Billing Summary**: Missing account name column (pending enhancement).
- **Real-time Data**: Does not fetch real-time data beyond the database snapshot.

#### Future Enhancements
- Add multi-language query support.
- Implement deletion capabilities.
- Enhance billing summary with account names.
- Stream large exports (e.g., CSV) for performance with 135,245+ records.
"""


@app.get("/knowledge-base-info")
async def get_knowledge_base_info():
    logger.info("Fetching static knowledge base info")
    return PlainTextResponse(CAPABILITY_SET)


@app.get("/get_rate_plans")
async def get_rate_plans(
    page: int = 1,
    limit: int = 10,
    search: str = "",
    search_field: str = "rate_plan",
    filter_type: str = "contains",
    sort_by: str = "rate_plan",
    sort_order: str = "asc",
):
    try:
        with engine.connect() as conn:
            query = "SELECT * FROM rate_plan WHERE 1=1"
            params = {}

            if search:
                if filter_type == "exact":
                    query += f" AND {search_field} = :search"
                else:
                    query += f" AND LOWER({search_field}) LIKE :search"
                    params["search"] = f"%{search.lower()}%"

            query += f" ORDER BY {sort_by} {sort_order}"
            query += " LIMIT :limit OFFSET :offset"
            params["limit"] = limit
            params["offset"] = (page - 1) * limit

            result = pd.read_sql_query(text(query), conn, params=params)
            data = result.to_dict(orient="records")

            count_query = "SELECT COUNT(*) as total FROM rate_plan WHERE 1=1"
            if search:
                if filter_type == "exact":
                    count_query += f" AND {search_field} = :search"
                else:
                    count_query += f" AND LOWER({search_field}) LIKE :search"
            total = conn.execute(text(count_query), params).scalar()

            return {"data": data, "total": total}
    except Exception as e:
        logger.error(f"Error fetching rate plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/create_rate_plan")
async def create_rate_plan(rate_plan: RatePlan):
    try:
        with engine.connect() as conn:
            with conn.begin():
                query = """
                    INSERT INTO rate_plan (rate_plan, bundle_allowance, bundle_fee, home_rate, row_rate)
                    VALUES (:rate_plan, :bundle_allowance, :bundle_fee, :home_rate, :row_rate)
                """
                conn.execute(
                    text(query),
                    {
                        "rate_plan": rate_plan.rate_plan,
                        "bundle_allowance": rate_plan.bundle_allowance,
                        "bundle_fee": rate_plan.bundle_fee,
                        "home_rate": rate_plan.home_rate,
                        "row_rate": rate_plan.row_rate,
                    },
                )
        return {"message": "Rate plan created successfully"}
    except Exception as e:
        logger.error(f"Error creating rate plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


from pydantic import BaseModel


class WholesalePlan(BaseModel):
    wholesale_plan_name: str
    allowance: int
    plan_type: str
    fee: float
    out_of_bundle_rate_home: float
    out_of_bundle_rate_roaming: float


@app.get("/get_wholesale_plans")
async def get_wholesale_plans(
    page: int = 1,
    limit: int = 10,
    search: str = "",
    search_field: str = "wholesale_plan_name",
    filter_type: str = "contains",
    sort_by: str = "wholesale_plan_name",
    sort_order: str = "asc",
):
    try:
        with engine.connect() as conn:
            # Query with subqueries to map new schema to legacy format
            query = """
                SELECT 
                    p.id,
                    p.plan_name as wholesale_plan_name, 
                    p.plan_type,
                    COALESCE((SELECT allowance_amount FROM plan_allowances pa WHERE pa.plan_id = p.id AND pa.service_type = 'data_domestic' LIMIT 1), 0) as allowance,
                    0.0 as fee,
                    COALESCE((SELECT overage_rate FROM service_rates sr WHERE sr.plan_id = p.id AND sr.service_type = 'data_domestic' LIMIT 1), 0.0) as out_of_bundle_rate_home,
                    0.0 as out_of_bundle_rate_roaming
                FROM wholesale_plans p 
                WHERE 1=1
            """
            params = {}

            # Map legacy column names to new schema
            db_search_field = search_field
            if search_field == "wholesale_plan_name":
                db_search_field = "plan_name"
            
            db_sort_by = sort_by
            if sort_by == "wholesale_plan_name":
                db_sort_by = "plan_name"

            if search:
                if filter_type == "exact":
                    query += f" AND {db_search_field} = :search"
                    params["search"] = search
                else:
                    query += f" AND LOWER({db_search_field}) LIKE :search"
                    params["search"] = f"%{search.lower()}%"

            query += f" ORDER BY {db_sort_by} {sort_order}"
            query += " LIMIT :limit OFFSET :offset"
            params["limit"] = limit
            params["offset"] = (page - 1) * limit

            result = pd.read_sql_query(text(query), conn, params=params)
            data = result.to_dict(orient="records")

            count_query = "SELECT COUNT(*) as total FROM wholesale_plans WHERE 1=1"
            if search:
                if filter_type == "exact":
                    count_query += f" AND {db_search_field} = :search"
                else:
                    count_query += f" AND LOWER({db_search_field}) LIKE :search"
            total = conn.execute(text(count_query), params).scalar()

            return {"data": data, "total": total}
    except Exception as e:
        logger.error(f"Error fetching wholesale plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/create_wholesale_plan")
async def create_wholesale_plan(plan: WholesalePlan):
    try:
        with engine.connect() as conn:
            with conn.begin():
                query = """
                    INSERT INTO wholesale_plan (wholesale_plan_name, allowance, plan_type, fee, out_of_bundle_rate_home, out_of_bundle_rate_roaming)
                    VALUES (:wholesale_plan_name, :allowance, :plan_type, :fee, :out_of_bundle_rate_home, :out_of_bundle_rate_roaming)
                """
                conn.execute(
                    text(query),
                    {
                        "wholesale_plan_name": plan.wholesale_plan_name,
                        "allowance": plan.allowance,
                        "plan_type": plan.plan_type,
                        "fee": plan.fee,
                        "out_of_bundle_rate_home": plan.out_of_bundle_rate_home,
                        "out_of_bundle_rate_roaming": plan.out_of_bundle_rate_roaming,
                    },
                )
        return {"message": "Wholesale plan created successfully"}
    except Exception as e:
        logger.error(f"Error creating wholesale plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# New Function: Fetch Account Details for the Latest Billing Cycle
@app.get("/account-details-latest-billing-cycle/{account_name}")
async def account_details_latest_billing_cycle(account_name: str):
    """
    Fetch account details (total SIMs, total bill, and usage) for the last billing cycle.
    Args:
        account_name (str): The name of the account (e.g., 'Coca-Cola', 'BMW').
    Returns:
        dict: Contains total_sims, total_bill, total_usage_gb, and billing_cycle.
    """
    try:
        latest_cycle = get_latest_billing_cycle()
        query = """
            SELECT
                COUNT(DISTINCT sim_id) AS total_sims,
                CAST(SUM(total_bill) AS DECIMAL(10,2)) AS total_bill,
                CAST(SUM(total_usage) / 1024 AS DECIMAL(10,2)) AS total_usage_gb,
                billing_cycle
            FROM billing_data
            WHERE account_name = :account_name
            AND billing_cycle = :billing_cycle
            GROUP BY billing_cycle;
        """
        params = {"account_name": account_name, "billing_cycle": latest_cycle}

        data = fetch_data(query, params)
        if not data:
            logger.warning(
                f"No data found for account '{account_name}' in cycle {latest_cycle}"
            )
            return {
                "total_sims": 0,
                "total_bill": 0.00,
                "total_usage_gb": 0.00,
                "billing_cycle": latest_cycle,
                "message": f"No data available for {account_name} in billing cycle {latest_cycle}",
            }

        result = data[0]  # Expecting one row since we're grouping by billing_cycle
        logger.info(f"Account details fetched for '{account_name}': {result}")
        return result
    except Exception as e:
        logger.error(f"Error fetching account details for '{account_name}': {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching account details: {str(e)}"
        )


@app.get("/get_sim_mapping")
async def get_sim_mapping(
    page: int = 1,
    limit: int = 10,
    search: str = "",
    search_field: str = "sim_id",
    filter_type: str = "contains",
    sort_by: str = "sim_id",
    sort_order: str = "asc",
):
    try:
        with engine.connect() as conn:
            query = """
                SELECT bd.account_name, bd.sim_id, bd.rate_plan as retail_plan, bd.total_usage, bd.billing_cycle, wp.plan_name as wholesale_plan
                FROM billing_data bd
                LEFT JOIN wholesale_plans wp ON bd.wholesale_plan_id = wp.id
                WHERE 1=1
            """
            params = {}

            if search:
                if filter_type == "exact":
                    query += f" AND {search_field} = :search"
                    params["search"] = search
                else:
                    query += f" AND LOWER({search_field}) LIKE :search"
                    params["search"] = f"%{search.lower()}%"

            query += f" ORDER BY {sort_by} {sort_order}"
            query += " LIMIT :limit OFFSET :offset"
            params["limit"] = limit
            params["offset"] = (page - 1) * limit

            print(f"Query: {query}, Params: {params}")

            result = pd.read_sql_query(text(query), conn, params=params)
            data = result.to_dict(orient="records")

            count_query = "SELECT COUNT(*) as total FROM billing_data WHERE 1=1"
            if search:
                if filter_type == "exact":
                    count_query += f" AND {search_field} = :search"
                else:
                    count_query += f" AND LOWER({search_field}) LIKE :search"
            total = conn.execute(text(count_query), params).scalar()

            return {"data": data, "total": total}
    except Exception as e:
        logger.error(f"Error fetching SIM mapping: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# New Function: Fetch Account Details for the Latest Billing Cycle
@app.get("/account-details-latest-billing-cycle/{account_name}")
async def account_details_latest_billing_cycle(account_name: str):
    """
    Fetch account details (total SIMs, total bill, and usage) for the last billing cycle.
    Args:
        account_name (str): The name of the account (e.g., 'Coca-Cola', 'BMW').
    Returns:
        dict: Contains total_sims, total_bill, total_usage_gb, and billing_cycle.
    """
    try:
        latest_cycle = get_latest_billing_cycle()
        query = """
            SELECT
                COUNT(DISTINCT sim_id) AS total_sims,
                CAST(SUM(total_bill) AS DECIMAL(10,2)) AS total_bill,
                CAST(SUM(total_usage) / 1024 AS DECIMAL(10,2)) AS total_usage_gb,
                billing_cycle
            FROM billing_data
            WHERE account_name = :account_name
            AND billing_cycle = :billing_cycle
            GROUP BY billing_cycle;
        """
        params = {"account_name": account_name, "billing_cycle": latest_cycle}

        data = fetch_data(query, params)
        if not data:
            logger.warning(
                f"No data found for account '{account_name}' in cycle {latest_cycle}"
            )
            return {
                "total_sims": 0,
                "total_bill": 0.00,
                "total_usage_gb": 0.00,
                "billing_cycle": latest_cycle,
                "message": f"No data available for {account_name} in billing cycle {latest_cycle}",
            }

        result = data[0]  # Expecting one row since we're grouping by billing_cycle
        logger.info(f"Account details fetched for '{account_name}': {result}")
        return result
    except Exception as e:
        logger.error(f"Error fetching account details for '{account_name}': {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching account details: {str(e)}"
        )


@app.get("/get_wholesale_analytics")
async def get_wholesale_analytics():
    """Fetch billing comparison for wholesale vs retail plans for the last 6 months."""
    try:
        with engine.connect() as conn:
            current_date = datetime.datetime.now()
            billing_cycles = []
            for i in range(6):
                month = current_date - relativedelta(months=i + 1)
                billing_cycles.append(month.strftime("%Y-%m"))
            billing_cycles.sort()

            retail_query = """
                SELECT billing_cycle, SUM(total_bill) as total_retail_cost
                FROM billing_data
                WHERE billing_cycle IN :cycles
                GROUP BY billing_cycle
                ORDER BY billing_cycle DESC
            """
            retail_result = pd.read_sql_query(
                text(retail_query), conn, params={"cycles": tuple(billing_cycles)}
            )

            # Query the NEW wholesale_billing_summary table directly
            wholesale_query = """
                SELECT year_month as billing_cycle, SUM(grand_total) as total_wholesale_cost
                FROM wholesale_billing_summary
                WHERE year_month IN :cycles
                GROUP BY year_month
                ORDER BY year_month DESC
            """
            
            wholesale_result = pd.read_sql_query(
                text(wholesale_query), conn, params={"cycles": tuple(billing_cycles)}
            )

            data = pd.merge(
                retail_result, wholesale_result, on="billing_cycle", how="outer"
            ).fillna(0)

            result_dict = {
                "billing_cycles": billing_cycles[::-1],
                "retail_costs": [0.0] * 6,
                "wholesale_costs": [0.0] * 6,
            }
            for _, row in data.iterrows():
                if row["billing_cycle"] in billing_cycles:
                    idx = billing_cycles.index(row["billing_cycle"])
                    result_dict["retail_costs"][idx] = float(row["total_retail_cost"])
                    result_dict["wholesale_costs"][idx] = float(
                        row["total_wholesale_cost"]
                    )

            logger.info(f"Returning wholesale analytics: {result_dict}")
            return result_dict
    except Exception as e:
        logger.error(f"Error fetching wholesale analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# BUSINESS OVERVIEW ENDPOINTS
# =============================================================================


@app.get("/financial-chart-data")
@handle_database_errors
def get_financial_chart_data():
    """Returns financial trend data for the FinancialChart component"""
    query = f"""
    SELECT 
        billing_cycle as month,
        COALESCE(ROUND(total_revenue, 0), 0) as revenue,
        COALESCE(ROUND(gross_profit, 0), 0) as grossprofit,
        COALESCE(ROUND(net_profit, 0), 0) as netprofit,
        COALESCE(ROUND(total_opex, 0), 0) as opex,
        COALESCE(ROUND(total_cogs, 0), 0) as cogs
    FROM dashboard_metrics
    WHERE metric_date >= CURRENT_DATE - INTERVAL '{DEFAULT_MONTHS_BACK} months'
    ORDER BY metric_date;
    """

    return safe_query_execute(query, [])


@app.get("/dashboard-overview-metrics")
@handle_database_errors
def get_dashboard_overview_metrics():
    """Returns key metrics for MetricCard components in the overview tab"""
    query = """
    WITH current_month AS (
        SELECT MAX(billing_cycle) as current_cycle FROM dashboard_metrics
    ),
    previous_month AS (
        SELECT billing_cycle as prev_cycle 
        FROM dashboard_metrics 
        WHERE billing_cycle < (SELECT current_cycle FROM current_month)
        ORDER BY billing_cycle DESC LIMIT 1
    ),
    ytd_data AS (
        SELECT 
            COALESCE(SUM(gross_profit), 0) as ytd_gross_profit,
            COALESCE(SUM(net_profit), 0) as ytd_net_profit,
            COALESCE(SUM(total_revenue), 0) as ytd_revenue,
            COALESCE(SUM(total_opex), 0) as ytd_opex
        FROM dashboard_metrics 
        WHERE EXTRACT(YEAR FROM metric_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    ),
    current_data AS (
        SELECT 
            COALESCE(active_accounts, 0) as active_accounts,
            COALESCE(avg_cogs_per_account, 0) as avg_cogs_per_account,
            COALESCE(avg_opex_per_account, 0) as avg_opex_per_account,
            COALESCE(total_revenue, 0) as total_revenue,
            COALESCE(gross_profit, 0) as gross_profit,
            COALESCE(net_profit, 0) as net_profit,
            COALESCE(total_opex, 0) as total_opex
        FROM dashboard_metrics dm
        JOIN current_month cm ON dm.billing_cycle = cm.current_cycle
    ),
    previous_data AS (
        SELECT 
            COALESCE(active_accounts, 0) as prev_active_accounts,
            COALESCE(avg_cogs_per_account, 0) as prev_avg_cogs,
            COALESCE(avg_opex_per_account, 0) as prev_avg_opex,
            COALESCE(total_revenue, 0) as prev_revenue,
            COALESCE(gross_profit, 0) as prev_gross_profit,
            COALESCE(net_profit, 0) as prev_net_profit,
            COALESCE(total_opex, 0) as prev_opex
        FROM dashboard_metrics dm
        JOIN previous_month pm ON dm.billing_cycle = pm.prev_cycle
    )
    SELECT 
        -- YTD Metrics with safe formatting
        CONCAT('$', ROUND(GREATEST(ytd.ytd_gross_profit, 0) / 1000000.0, 2), 'M') as ytd_gross_profit_display,
        COALESCE(ROUND((cd.gross_profit - pd.prev_gross_profit) / NULLIF(ABS(pd.prev_gross_profit), 0.0) * 100.0, 1), 0) as gross_profit_change,

        CONCAT('$', ROUND(GREATEST(ytd.ytd_net_profit, 0) / 1000.0, 0), 'K') as ytd_net_profit_display,
        COALESCE(ROUND((cd.net_profit - pd.prev_net_profit) / NULLIF(ABS(pd.prev_net_profit), 0.0) * 100.0, 1), 0) as net_profit_change,

        CONCAT('$', ROUND(GREATEST(ytd.ytd_revenue, 0) / 1000000.0, 2), 'M') as ytd_revenue_display,
        COALESCE(ROUND((cd.total_revenue - pd.prev_revenue) / NULLIF(ABS(pd.prev_revenue), 0.0) * 100.0, 1), 0) as revenue_change,

        CONCAT('$', ROUND(GREATEST(ytd.ytd_opex, 0) / 1000.0, 0), 'K') as ytd_opex_display,
        COALESCE(ROUND((cd.total_opex - pd.prev_opex) / NULLIF(ABS(pd.prev_opex), 0.0) * 100.0, 1), 0) as opex_change,

        -- Current Month Metrics
        cd.active_accounts::text as active_accounts_display,
        COALESCE(ROUND((cd.active_accounts::numeric - pd.prev_active_accounts::numeric) / NULLIF(ABS(pd.prev_active_accounts::numeric), 0.0) * 100.0, 1), 0) as active_accounts_change,

        CONCAT('$', ROUND(GREATEST(cd.avg_cogs_per_account, 0), 0)) as avg_cogs_display,
        COALESCE(ROUND((cd.avg_cogs_per_account - pd.prev_avg_cogs) / NULLIF(ABS(pd.prev_avg_cogs), 0.0) * 100.0, 1), 0) as cogs_change,

        CONCAT('$', ROUND(GREATEST(cd.avg_opex_per_account, 0), 0)) as avg_opex_display,
        COALESCE(ROUND((cd.avg_opex_per_account - pd.prev_avg_opex) / NULLIF(ABS(pd.prev_avg_opex), 0.0) * 100.0, 1), 0) as opex_per_account_change

    FROM ytd_data ytd
    CROSS JOIN current_data cd
    CROSS JOIN previous_data pd;
    """

    fallback_data = [
        {
            "ytd_gross_profit_display": "$0.00M",
            "gross_profit_change": 0,
            "ytd_net_profit_display": "$0K",
            "net_profit_change": 0,
            "ytd_revenue_display": "$0.00M",
            "revenue_change": 0,
            "ytd_opex_display": "$0K",
            "opex_change": 0,
            "active_accounts_display": "0",
            "active_accounts_change": 0,
            "avg_cogs_display": "$0",
            "cogs_change": 0,
            "avg_opex_display": "$0",
            "opex_per_account_change": 0,
        }
    ]

    return safe_query_execute(query, fallback_data)


@app.get("/account-growth-chart-data")
@handle_database_errors
def get_account_growth_chart_data():
    """Returns account growth data for the AccountGrowthChart component"""
    query = f"""
    SELECT 
        billing_cycle as month,
        COALESCE(GREATEST(new_accounts, 0), 0) as newaccounts,
        COALESCE(GREATEST(lost_accounts, 0), 0) as lostaccounts,
        COALESCE((new_accounts - lost_accounts), 0) as netgrowth
    FROM dashboard_metrics
    WHERE metric_date >= CURRENT_DATE - INTERVAL '{DEFAULT_MONTHS_BACK} months'
    ORDER BY metric_date;
    """

    return safe_query_execute(query, [])


@app.get("/sim-trends-chart-data")
@handle_database_errors
def get_sim_trends_chart_data():
    """Returns SIM trends data for the SIMTrendsChart component"""
    query = f"""
    SELECT 
        billing_cycle as month,
        COALESCE(active_sims, 0) as orders,
        COALESCE(ROUND((total_usage_gb / NULLIF(active_sims, 0) * 100), 1), 85.0) as usage
    FROM dashboard_metrics
    WHERE metric_date >= CURRENT_DATE - INTERVAL '{DEFAULT_MONTHS_BACK} months'
    ORDER BY metric_date;
    """

    return safe_query_execute(query, [])


@app.get("/goals-progress-data")
@handle_database_errors
def get_goals_progress_data():
    """Returns goals progress data for the GoalsProgress component"""
    query = f"""
    WITH ytd_totals AS (
        SELECT 
            COALESCE(SUM(net_profit), 0) as ytd_net_profit,
            COALESCE(SUM(total_revenue), 0) as ytd_revenue,
            COALESCE(AVG(active_accounts), 0) as avg_active_accounts
        FROM dashboard_metrics 
        WHERE EXTRACT(YEAR FROM metric_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    ),
    targets AS (
        SELECT 
            {DEFAULT_TARGETS['net_profit_target']} as net_profit_target,
            {DEFAULT_TARGETS['revenue_target']} as revenue_target,
            {DEFAULT_TARGETS['retention_target']} as retention_target,
            {DEFAULT_TARGETS['cost_reduction_target']} as cost_reduction_target
    )
    SELECT 
        'YTD Net Profit' as label,
        COALESCE(ROUND(yt.ytd_net_profit, 0), 0) as current,
        t.net_profit_target as target,
        COALESCE(ROUND((yt.ytd_net_profit / NULLIF(t.net_profit_target, 0) * 100), 1), 0) as percentage
    FROM ytd_totals yt, targets t
    
    UNION ALL
    
    SELECT 
        'Revenue Growth' as label,
        COALESCE(ROUND(((yt.ytd_revenue - 3000000) / NULLIF(3000000, 0) * 100), 1), 0) as current,
        20.0 as target,
        COALESCE(ROUND((((yt.ytd_revenue - 3000000) / NULLIF(3000000, 0) * 100) / NULLIF(20.0, 0) * 100), 1), 0) as percentage
    FROM ytd_totals yt
    
    UNION ALL
    
    SELECT 
        'Customer Retention' as label,
        94.3 as current,
        95.0 as target,
        99.3 as percentage
        
    UNION ALL
    
    SELECT 
        'Cost Reduction' as label,
        8.5 as current,
        12.0 as target,
        70.8 as percentage;
    """

    fallback_data = [
        {
            "label": "YTD Net Profit",
            "current": 0,
            "target": DEFAULT_TARGETS["net_profit_target"],
            "percentage": 0,
        },
        {"label": "Revenue Growth", "current": 0, "target": 20.0, "percentage": 0},
        {
            "label": "Customer Retention",
            "current": 94.3,
            "target": 95.0,
            "percentage": 99.3,
        },
        {"label": "Cost Reduction", "current": 8.5, "target": 12.0, "percentage": 70.8},
    ]

    return safe_query_execute(query, fallback_data)


@app.get("/accounts-receivable-data")
@handle_database_errors
def get_accounts_receivable_data():
    """Returns accounts receivable data for the AccountsReceivable component"""
    query = """
    WITH current_ar AS (
        SELECT 
            COALESCE(accounts_receivable, 0) as accounts_receivable,
            billing_cycle
        FROM dashboard_metrics 
        WHERE billing_cycle = (SELECT MAX(billing_cycle) FROM dashboard_metrics)
    ),
    ar_aging AS (
        SELECT 
            COALESCE(ROUND(accounts_receivable * 0.60, 0), 0) as current_ar,
            COALESCE(ROUND(accounts_receivable * 0.25, 0), 0) as ar_30_days,
            COALESCE(ROUND(accounts_receivable * 0.10, 0), 0) as ar_60_days,
            COALESCE(ROUND(accounts_receivable * 0.05, 0), 0) as ar_90_days,
            COALESCE(accounts_receivable, 0) as total_ar
        FROM current_ar
    )
    SELECT 
        'Current (0-30 days)' as category,
        current_ar as amount,
        CASE WHEN total_ar > 0 THEN ROUND((current_ar / total_ar * 100), 1) ELSE 0 END as percentage
    FROM ar_aging
    UNION ALL
    SELECT '31-60 days' as category, ar_30_days as amount,
        CASE WHEN total_ar > 0 THEN ROUND((ar_30_days / total_ar * 100), 1) ELSE 0 END as percentage
    FROM ar_aging
    UNION ALL
    SELECT '61-90 days' as category, ar_60_days as amount,
        CASE WHEN total_ar > 0 THEN ROUND((ar_60_days / total_ar * 100), 1) ELSE 0 END as percentage
    FROM ar_aging
    UNION ALL
    SELECT '90+ days' as category, ar_90_days as amount,
        CASE WHEN total_ar > 0 THEN ROUND((ar_90_days / total_ar * 100), 1) ELSE 0 END as percentage
    FROM ar_aging;
    """

    fallback_data = [
        {"category": "Current (0-30 days)", "amount": 0, "percentage": 0},
        {"category": "31-60 days", "amount": 0, "percentage": 0},
        {"category": "61-90 days", "amount": 0, "percentage": 0},
        {"category": "90+ days", "amount": 0, "percentage": 0},
    ]

    return safe_query_execute(query, fallback_data)


@app.get("/top-accounts-table-data")
@handle_database_errors
def get_top_accounts_table_data():
    """Returns top accounts data for the TopAccountsTable component"""
    query = f"""
    SELECT 
        COALESCE(b.account_name, 'Unknown') as account_name,
        COALESCE(COUNT(DISTINCT b.sim_id), 0) as total_sims,
        COALESCE(ROUND(SUM(b.total_usage)/1024.0, 2), 0) as total_usage_gb,
        COALESCE(ROUND(SUM(b.total_bill), 2), 0) as total_revenue,
        COALESCE(ROUND(AVG(b.total_bill), 2), 0) as avg_revenue_per_sim,
        COALESCE(ROUND(SUM(b.charges_out_of_bundle), 2), 0) as overage_charges,
        CASE 
            WHEN COALESCE(SUM(b.total_bill), 0) > 10000 THEN 'Enterprise'
            WHEN COALESCE(SUM(b.total_bill), 0) > 5000 THEN 'Mid-Market'
            WHEN COALESCE(SUM(b.total_bill), 0) > 1000 THEN 'SMB' 
            ELSE 'Startup'
        END as segment,
        CASE 
            WHEN COALESCE(AVG(b.total_usage), 0) > 1000 THEN 'High'
            WHEN COALESCE(AVG(b.total_usage), 0) > 500 THEN 'Medium'
            ELSE 'Low'
        END as usage_tier
    FROM billing_data b
    WHERE b.billing_cycle = (SELECT MAX(billing_cycle) FROM billing_data)
        AND b.account_name IS NOT NULL
    GROUP BY b.account_name
    ORDER BY total_revenue DESC
    LIMIT 10;
    """

    return safe_query_execute(query, [])


# =============================================================================
# PERFORMANCE METRICS ENDPOINTS
# =============================================================================


@app.get("/performance/performance-overview-metrics")
@handle_database_errors
def get_performance_overview_metrics():
    """Returns key performance metrics for MetricCard components in the performance tab"""
    query = """
    WITH current_month AS (
        SELECT MAX(billing_cycle) as current_cycle FROM performance_analytics
    ),
    previous_month AS (
        SELECT billing_cycle as prev_cycle 
        FROM performance_analytics 
        WHERE billing_cycle < (SELECT current_cycle FROM current_month)
        ORDER BY billing_cycle DESC LIMIT 1
    ),
    current_data AS (
        SELECT 
            COALESCE(AVG(payment_performance_score), 0) as current_payment_score,
            COALESCE(AVG(churn_risk_score), 0) as current_churn_risk,
            COALESCE(AVG(avg_revenue_per_sim), 0) as current_avg_revenue_per_sim,
            COALESCE(AVG(dispute_resolution_days), 0) as current_dispute_days
        FROM performance_analytics pa
        JOIN current_month cm ON pa.billing_cycle = cm.current_cycle
    ),
    previous_data AS (
        SELECT 
            COALESCE(AVG(payment_performance_score), 0) as prev_payment_score,
            COALESCE(AVG(churn_risk_score), 0) as prev_churn_risk,
            COALESCE(AVG(avg_revenue_per_sim), 0) as prev_avg_revenue_per_sim,
            COALESCE(AVG(dispute_resolution_days), 0) as prev_dispute_days
        FROM performance_analytics pa
        JOIN previous_month pm ON pa.billing_cycle = pm.prev_cycle
    )
    SELECT 
        -- Payment Performance Score
        COALESCE(ROUND(cd.current_payment_score, 1), 0) as payment_performance_value,
        COALESCE(ROUND(((cd.current_payment_score - pd.prev_payment_score) / NULLIF(ABS(pd.prev_payment_score), 0) * 100), 1), 0) as payment_performance_change,
        CASE WHEN cd.current_payment_score > pd.prev_payment_score THEN 'positive' ELSE 'negative' END as payment_performance_type,
        
        -- Churn Risk Score
        CONCAT(COALESCE(ROUND(cd.current_churn_risk, 1), 0), '%') as churn_risk_value,
        COALESCE(ROUND(((cd.current_churn_risk - pd.prev_churn_risk) / NULLIF(ABS(pd.prev_churn_risk), 0) * 100), 1), 0) as churn_risk_change,
        CASE WHEN cd.current_churn_risk < pd.prev_churn_risk THEN 'positive' ELSE 'negative' END as churn_risk_type,
        
        -- Avg Revenue per SIM
        CONCAT('$', COALESCE(ROUND(cd.current_avg_revenue_per_sim, 2), 0)) as avg_revenue_per_sim_value,
        COALESCE(ROUND(((cd.current_avg_revenue_per_sim - pd.prev_avg_revenue_per_sim) / NULLIF(ABS(pd.prev_avg_revenue_per_sim), 0) * 100), 1), 0) as avg_revenue_per_sim_change,
        CASE WHEN cd.current_avg_revenue_per_sim > pd.prev_avg_revenue_per_sim THEN 'positive' ELSE 'negative' END as avg_revenue_per_sim_type,
        
        -- Dispute Resolution Time
        CONCAT(COALESCE(ROUND(cd.current_dispute_days, 1), 0), ' days') as dispute_resolution_value,
        COALESCE(ROUND(((cd.current_dispute_days - pd.prev_dispute_days) / NULLIF(ABS(pd.prev_dispute_days), 0) * 100), 1), 0) as dispute_resolution_change,
        CASE WHEN cd.current_dispute_days < pd.prev_dispute_days THEN 'positive' ELSE 'negative' END as dispute_resolution_type
        
    FROM current_data cd
    CROSS JOIN previous_data pd;
    """

    fallback_data = [
        {
            "payment_performance_value": 78.5,
            "payment_performance_change": 2.3,
            "payment_performance_type": "positive",
            "churn_risk_value": "12.3%",
            "churn_risk_change": -1.2,
            "churn_risk_type": "positive",
            "avg_revenue_per_sim_value": "$45.20",
            "avg_revenue_per_sim_change": 3.1,
            "avg_revenue_per_sim_type": "positive",
            "dispute_resolution_value": "2.8 days",
            "dispute_resolution_change": -0.5,
            "dispute_resolution_type": "positive",
        }
    ]

    return safe_query_execute(query, fallback_data)


@app.get("/performance/revenue-per-sim-trend")
@handle_database_errors
def get_revenue_per_sim_trend():
    """Returns revenue per SIM trend data for the LineChart component"""
    query = f"""
    SELECT 
        TO_CHAR(metric_date, 'Mon') as month,
        COALESCE(ROUND(AVG(avg_revenue_per_sim), 2), 0) as revenue
    FROM performance_analytics
    WHERE metric_date >= CURRENT_DATE - INTERVAL '{DEFAULT_MONTHS_BACK} months'
        AND avg_revenue_per_sim IS NOT NULL
    GROUP BY metric_date, TO_CHAR(metric_date, 'Mon')
    ORDER BY metric_date;
    """

    fallback_data = [
        {"month": "May", "revenue": 42.50},
        {"month": "Jun", "revenue": 45.20},
        {"month": "Jul", "revenue": 47.10},
    ]

    return safe_query_execute(query, fallback_data)


@app.get("/performance/customer-profitability-by-segment")
@handle_database_errors
def get_customer_profitability_by_segment():
    """Returns customer profitability scores by segment for the BarChart component"""
    query = """
    SELECT 
        COALESCE(account_segment, 'Unknown') as segment,
        COALESCE(ROUND(AVG(profitability_score), 0), 0) as score
    FROM performance_analytics
    WHERE billing_cycle = (SELECT MAX(billing_cycle) FROM performance_analytics)
        AND account_segment IS NOT NULL
        AND profitability_score IS NOT NULL
    GROUP BY account_segment
    ORDER BY 
        CASE account_segment
            WHEN 'Enterprise' THEN 1
            WHEN 'Mid-Market' THEN 2
            WHEN 'SMB' THEN 3
            WHEN 'Startup' THEN 4
            ELSE 5
        END;
    """

    fallback_data = [
        {"segment": "Enterprise", "score": 92},
        {"segment": "Mid-Market", "score": 78},
        {"segment": "SMB", "score": 65},
        {"segment": "Startup", "score": 58},
    ]

    return safe_query_execute(query, fallback_data)


@app.get("/performance/discount-credit-utilization")
@handle_database_errors
def get_discount_credit_utilization():
    """Returns discount and credit utilization metrics for progress bars"""
    query = """
    WITH current_metrics AS (
        SELECT 
            COALESCE(AVG(credit_utilization_percent), 0) as credit_utilization,
            COALESCE(AVG(discount_usage_percent), 0) as discount_usage,
            COALESCE(AVG(avg_discount_rate), 0) as avg_discount_rate
        FROM performance_analytics
        WHERE billing_cycle = (SELECT MAX(billing_cycle) FROM performance_analytics)
            AND credit_utilization_percent IS NOT NULL
    )
    SELECT 
        COALESCE(ROUND(credit_utilization, 0), 50) as credit_utilization_percent,
        COALESCE(ROUND(discount_usage, 0), 30) as discount_usage_percent,
        COALESCE(ROUND(avg_discount_rate, 1), 8.5) as avg_discount_rate
    FROM current_metrics;
    """

    fallback_data = [
        {
            "credit_utilization_percent": 65,
            "discount_usage_percent": 42,
            "avg_discount_rate": 7.8,
        }
    ]

    return safe_query_execute(query, fallback_data)


@app.get("/performance/discount-sensitivity-analysis")
@handle_database_errors
def get_discount_sensitivity_analysis():
    """Returns discount sensitivity analysis data"""
    query = """
    WITH current_cycle AS (
        SELECT MAX(billing_cycle) as current_cycle FROM performance_analytics
    ),
    sensitivity_counts AS (
        SELECT 
            COUNT(CASE WHEN discount_sensitivity = 'High' THEN 1 END) as high_count,
            COUNT(CASE WHEN discount_sensitivity = 'Medium' THEN 1 END) as medium_count,
            COUNT(CASE WHEN discount_sensitivity = 'Low' THEN 1 END) as low_count,
            GREATEST(COUNT(*), 1) as total_count,
            COALESCE(AVG(optimal_discount_rate), 6.2) as optimal_rate
        FROM performance_analytics pa
        JOIN current_cycle cc ON pa.billing_cycle = cc.current_cycle
        WHERE discount_sensitivity IS NOT NULL
    )
    SELECT 
        COALESCE(ROUND((high_count * 100.0 / total_count), 0), 30) as high_sensitivity_percent,
        COALESCE(ROUND((medium_count * 100.0 / total_count), 0), 45) as medium_sensitivity_percent,
        COALESCE(ROUND((low_count * 100.0 / total_count), 0), 25) as low_sensitivity_percent,
        COALESCE(ROUND(optimal_rate, 1), 6.2) as optimal_discount_rate
    FROM sensitivity_counts;
    """

    fallback_data = [
        {
            "high_sensitivity_percent": 30,
            "medium_sensitivity_percent": 45,
            "low_sensitivity_percent": 25,
            "optimal_discount_rate": 6.2,
        }
    ]

    return safe_query_execute(query, fallback_data)


@app.get("/performance/revenue-forecast-data")
@handle_database_errors
def get_revenue_forecast_data():
    """Returns revenue forecast data for the forecast card"""
    query = """
    WITH current_forecasts AS (
        SELECT 
            COALESCE(AVG(q3_forecast), 0) as q3_forecast,
            COALESCE(AVG(q4_forecast), 0) as q4_forecast,
            COALESCE(AVG(yoy_growth_forecast), 0) as yoy_growth,
            COALESCE(AVG(forecast_confidence_level), 0) as confidence_level
        FROM performance_analytics
        WHERE billing_cycle = (SELECT MAX(billing_cycle) FROM performance_analytics)
            AND q3_forecast IS NOT NULL
    )
    SELECT 
        CONCAT('$', COALESCE(ROUND(GREATEST(q3_forecast, 0)/1000, 0), 450), 'K') as q3_forecast_display,
        CONCAT('$', COALESCE(ROUND(GREATEST(q4_forecast, 0)/1000, 0), 540), 'K') as q4_forecast_display,
        CONCAT('+', COALESCE(ROUND(GREATEST(yoy_growth, 0), 1), 18.5), '%') as yoy_growth_display,
        CONCAT(COALESCE(ROUND(GREATEST(confidence_level, 0), 0), 94), '%') as confidence_level_display
    FROM current_forecasts;
    """

    fallback_data = [
        {
            "q3_forecast_display": "$450K",
            "q4_forecast_display": "$540K",
            "yoy_growth_display": "+18.5%",
            "confidence_level_display": "94%",
        }
    ]

    return safe_query_execute(query, fallback_data)


@app.get("/performance/account-performance-metrics")
@handle_database_errors
def get_account_performance_metrics():
    """Returns detailed account performance metrics for the AccountPerformanceTable"""
    query = f"""
   SELECT 
       COALESCE(account_name, 'Unknown') as account_name,
       COALESCE(account_segment, 'SMB') as segment,
       COALESCE(ROUND(payment_performance_score, 1), 75.0) as payment_score,
       COALESCE(ROUND(churn_risk_score, 1), 15.0) as churn_risk,
       CONCAT('$', COALESCE(ROUND(total_revenue, 0), 0)) as revenue,
       COALESCE(total_sims, 0) as sims,
       CONCAT('$', COALESCE(ROUND(avg_revenue_per_sim, 2), 0)) as revenue_per_sim,
       COALESCE(profitability_score, 50) as profitability,
       COALESCE(ROUND(dispute_resolution_days, 1), 3.2) as dispute_resolution_days,
       CASE 
           WHEN churn_risk_score <= 10 THEN 'Low'
           WHEN churn_risk_score <= 25 THEN 'Medium'
           ELSE 'High'
       END as risk_category,
       CASE 
           WHEN payment_performance_score >= 85 THEN 'Excellent'
           WHEN payment_performance_score >= 70 THEN 'Good'
           WHEN payment_performance_score >= 50 THEN 'Fair'
           ELSE 'Poor'
       END as payment_rating
   FROM performance_analytics
   WHERE billing_cycle = (SELECT MAX(billing_cycle) FROM performance_analytics)
       AND account_name IS NOT NULL
   ORDER BY total_revenue DESC
   LIMIT {DEFAULT_TOP_ACCOUNTS_LIMIT};
   """

    return safe_query_execute(query, [])


@app.get("/performance/payment-churn-correlation")
@handle_database_errors
def get_payment_churn_correlation():
    """Returns payment performance vs churn risk correlation data for scatter plot"""
    query = """
   SELECT 
       COALESCE(ROUND(payment_performance_score, 1), 75.0) as payment_score,
       COALESCE(ROUND(churn_risk_score, 1), 15.0) as churn_risk,
       COALESCE(account_segment, 'SMB') as segment,
       COALESCE(SUBSTRING(account_name, 1, 3), 'UNK') as account_code
   FROM performance_analytics
   WHERE billing_cycle = (SELECT MAX(billing_cycle) FROM performance_analytics)
       AND payment_performance_score IS NOT NULL
       AND churn_risk_score IS NOT NULL
       AND account_name IS NOT NULL
   ORDER BY RANDOM()
   LIMIT 20;
   """

    fallback_data = [
        {
            "payment_score": 85.2,
            "churn_risk": 8.3,
            "segment": "Enterprise",
            "account_code": "COC",
        },
        {
            "payment_score": 78.1,
            "churn_risk": 12.7,
            "segment": "Mid-Market",
            "account_code": "BMW",
        },
        {
            "payment_score": 72.5,
            "churn_risk": 18.9,
            "segment": "SMB",
            "account_code": "TES",
        },
    ]

    return safe_query_execute(query, fallback_data)


@app.get("/performance/segment-distribution")
@handle_database_errors
def get_segment_distribution():
    """Returns customer segment distribution for pie chart"""
    query = """
   WITH segment_counts AS (
       SELECT 
           COALESCE(account_segment, 'Unknown') as segment,
           COUNT(*) as count,
           COALESCE(SUM(total_revenue), 0) as total_revenue
       FROM performance_analytics
       WHERE billing_cycle = (SELECT MAX(billing_cycle) FROM performance_analytics)
           AND account_segment IS NOT NULL
       GROUP BY account_segment
   ),
   total_counts AS (
       SELECT GREATEST(SUM(count), 1) as total_accounts FROM segment_counts
   )
   SELECT 
       sc.segment,
       sc.count as accounts,
       COALESCE(ROUND((sc.count * 100.0 / tc.total_accounts), 1), 0) as percentage,
       COALESCE(ROUND(sc.total_revenue, 0), 0) as revenue
   FROM segment_counts sc
   CROSS JOIN total_counts tc
   ORDER BY sc.count DESC;
   """

    fallback_data = [
        {"segment": "SMB", "accounts": 12, "percentage": 48.0, "revenue": 125000},
        {"segment": "Mid-Market", "accounts": 8, "percentage": 32.0, "revenue": 245000},
        {"segment": "Enterprise", "accounts": 3, "percentage": 12.0, "revenue": 180000},
        {"segment": "Startup", "accounts": 2, "percentage": 8.0, "revenue": 35000},
    ]

    return safe_query_execute(query, fallback_data)


@app.get("/performance/monthly-churn-risk-trend")
@handle_database_errors
def get_monthly_churn_risk_trend():
    """Returns monthly churn risk trend data for area chart"""
    query = f"""
   SELECT 
       TO_CHAR(metric_date, 'Mon') as month,
       COALESCE(ROUND(AVG(churn_risk_score), 1), 15.0) as average_churn_risk,
       COALESCE(ROUND(MAX(churn_risk_score), 1), 35.0) as max_churn_risk,
       COALESCE(ROUND(MIN(churn_risk_score), 1), 5.0) as min_churn_risk
   FROM performance_analytics
   WHERE metric_date >= CURRENT_DATE - INTERVAL '{DEFAULT_MONTHS_BACK} months'
       AND churn_risk_score IS NOT NULL
   GROUP BY metric_date, TO_CHAR(metric_date, 'Mon')
   ORDER BY metric_date;
   """

    fallback_data = [
        {
            "month": "Apr",
            "average_churn_risk": 16.2,
            "max_churn_risk": 32.5,
            "min_churn_risk": 4.8,
        },
        {
            "month": "May",
            "average_churn_risk": 14.7,
            "max_churn_risk": 28.3,
            "min_churn_risk": 5.2,
        },
        {
            "month": "Jun",
            "average_churn_risk": 13.1,
            "max_churn_risk": 25.6,
            "min_churn_risk": 6.1,
        },
    ]

    return safe_query_execute(query, fallback_data)


@app.get("/performance/profitability-distribution")
@handle_database_errors
def get_profitability_distribution():
    """Returns profitability score distribution for histogram"""
    query = """
   WITH profitability_buckets AS (
       SELECT 
           CASE 
               WHEN profitability_score >= 90 THEN '90-100'
               WHEN profitability_score >= 80 THEN '80-89'
               WHEN profitability_score >= 70 THEN '70-79'
               WHEN profitability_score >= 60 THEN '60-69'
               WHEN profitability_score >= 50 THEN '50-59'
               ELSE '0-49'
           END as score_range,
           COUNT(*) as account_count
       FROM performance_analytics
       WHERE billing_cycle = (SELECT MAX(billing_cycle) FROM performance_analytics)
           AND profitability_score IS NOT NULL
       GROUP BY 
           CASE 
               WHEN profitability_score >= 90 THEN '90-100'
               WHEN profitability_score >= 80 THEN '80-89'
               WHEN profitability_score >= 70 THEN '70-79'
               WHEN profitability_score >= 60 THEN '60-69'
               WHEN profitability_score >= 50 THEN '50-59'
               ELSE '0-49'
           END
   )
   SELECT 
       score_range,
       COALESCE(account_count, 0) as accounts
   FROM profitability_buckets
   ORDER BY 
       CASE score_range
           WHEN '0-49' THEN 1
           WHEN '50-59' THEN 2
           WHEN '60-69' THEN 3
           WHEN '70-79' THEN 4
           WHEN '80-89' THEN 5
           WHEN '90-100' THEN 6
       END;
   """

    fallback_data = [
        {"score_range": "0-49", "accounts": 2},
        {"score_range": "50-59", "accounts": 4},
        {"score_range": "60-69", "accounts": 6},
        {"score_range": "70-79", "accounts": 8},
        {"score_range": "80-89", "accounts": 5},
        {"score_range": "90-100", "accounts": 3},
    ]

    return safe_query_execute(query, fallback_data)


# =============================================================================
# HEALTH CHECK FOR NEW ENDPOINTS
# =============================================================================


@app.get("/dashboard-health")
def dashboard_health_check():
    """Health check for dashboard endpoints"""
    try:
        # Test database connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        # Check if required tables exist
        required_tables = ["dashboard_metrics", "performance_analytics", "billing_data"]
        table_status = {}

        with engine.connect() as conn:
            for table in required_tables:
                try:
                    result = conn.execute(
                        text(f"SELECT COUNT(*) FROM {table} LIMIT 1")
                    ).scalar()
                    table_status[table] = {"exists": True, "row_count": result}
                except Exception as e:
                    table_status[table] = {"exists": False, "error": str(e)}

        return {
            "status": "healthy",
            "database_connection": "ok",
            "tables": table_status,
            "timestamp": datetime.datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Dashboard health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.datetime.now().isoformat(),
        }


@app.get("/dashboard-summary")
async def dashboard_summary():
    """Get latest dashboard metrics summary"""
    try:
        latest_cycle = get_latest_billing_cycle()
        query = """
            SELECT 
                billing_cycle,
                CONCAT('$', ROUND(total_revenue/1000, 0), 'K') as total_revenue,
                CONCAT('$', ROUND(gross_profit/1000, 0), 'K') as gross_profit,
                CONCAT('$', ROUND(net_profit/1000, 0), 'K') as net_profit,
                active_accounts,
                active_sims,
                CONCAT(ROUND(total_usage_gb, 1), ' GB') as total_usage
            FROM dashboard_metrics
            WHERE billing_cycle = :cycle;
        """
        params = {"cycle": latest_cycle}
        data = fetch_data(query, params)
        if not data:
            return {
                "message": f"No dashboard data available for billing cycle {latest_cycle}"
            }
        return data[0]  # Return single record
    except Exception as e:
        logger.error(f"Error in /dashboard-summary: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching dashboard summary: {str(e)}"
        )


@app.get("/performance-summary")
async def performance_summary():
    """Get performance analytics summary for latest cycle"""
    try:
        latest_cycle = get_latest_billing_cycle()
        query = """
            SELECT 
                account_name,
                account_segment,
                ROUND(payment_performance_score, 1) as payment_score,
                ROUND(churn_risk_score, 1) as churn_risk,
                CONCAT('$', ROUND(total_revenue, 0)) as revenue,
                profitability_score
            FROM performance_analytics
            WHERE billing_cycle = :cycle
            ORDER BY total_revenue DESC
            LIMIT 10;
        """
        params = {"cycle": latest_cycle}
        data = fetch_data(query, params)
        if not data:
            return {
                "message": f"No performance data available for billing cycle {latest_cycle}"
            }
        return data
    except Exception as e:
        logger.error(f"Error in /performance-summary: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching performance summary: {str(e)}"
        )


@app.get("/high-churn-risk-accounts")
async def high_churn_risk_accounts():
    """Get accounts with high churn risk (>20)"""
    try:
        latest_cycle = get_latest_billing_cycle()
        query = """
            SELECT 
                account_name,
                account_segment,
                ROUND(churn_risk_score, 1) as churn_risk,
                ROUND(payment_performance_score, 1) as payment_score,
                CONCAT('$', ROUND(total_revenue, 0)) as revenue
            FROM performance_analytics
            WHERE billing_cycle = :cycle
                AND churn_risk_score > 20
            ORDER BY churn_risk_score DESC;
        """
        params = {"cycle": latest_cycle}
        data = fetch_data(query, params)
        if not data:
            return {
                "message": f"No high churn risk accounts found for billing cycle {latest_cycle}"
            }
        return data
    except Exception as e:
        logger.error(f"Error in /high-churn-risk-accounts: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching high churn risk accounts: {str(e)}"
        )


# --- Wholesale API Endpoints ---

@app.get("/wholesale/entities")
async def get_wholesale_entities():
    """Get all wholesale entities (MNO, MVNA, MVNE)"""
    try:
        query = "SELECT * FROM wholesale_entities ORDER BY name;"
        data = fetch_data(query)
        return data
    except Exception as e:
        logger.error(f"Error in /wholesale/entities: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/wholesale/plans")
async def get_wholesale_plans(entity_id: Optional[int] = None):
    """Get wholesale plans, optionally filtered by entity_id"""
    try:
        if entity_id:
            query = "SELECT * FROM wholesale_plans WHERE entity_id = :entity_id ORDER BY id;"
            params = {"entity_id": entity_id}
            data = fetch_data(query, params)
        else:
            query = "SELECT * FROM wholesale_plans ORDER BY entity_id, id;"
            data = fetch_data(query)
        return data
    except Exception as e:
        logger.error(f"Error in /wholesale/plans: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/wholesale/billing-summary")
async def get_wholesale_billing_summary():
    """Get aggregated wholesale billing summary"""
    try:
        # Join with entities for name
        query = """
            SELECT s.*, e.name as entity_name
            FROM wholesale_billing_summary s
            JOIN wholesale_entities e ON s.entity_id = e.id
            ORDER BY s.year_month DESC, e.name;
        """
        data = fetch_data(query)
        return data
    except Exception as e:
        logger.error(f"Error in /wholesale/billing-summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/wholesale/billing-records/{cycle_id}")
async def get_wholesale_billing_records(cycle_id: int):
    """Get detailed billing records for a specific cycle"""
    try:
        query = """
            SELECT r.*, p.plan_name
            FROM wholesale_billing_records r
            JOIN wholesale_plans p ON r.plan_id = p.id
            WHERE r.billing_cycle_id = :cycle_id
            ORDER BY r.id;
        """
        params = {"cycle_id": cycle_id}
        data = fetch_data(query, params)
        return data
    except Exception as e:
        logger.error(f"Error in /wholesale/billing-records: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# --- Analytics API Endpoints ---

@app.get("/analytics/dashboard")
async def get_dashboard_metrics(billing_cycle: Optional[str] = None):
    """Get dashboard metrics, optionally filtered by billing cycle"""
    try:
        if billing_cycle:
             query = "SELECT * FROM dashboard_metrics WHERE billing_cycle = :bc"
             params = {"bc": billing_cycle}
        else:
             # Get latest if not specified
             latest = get_latest_billing_cycle()
             query = "SELECT * FROM dashboard_metrics WHERE billing_cycle = :bc"
             params = {"bc": latest}
        
        data = fetch_data(query, params)
        return data[0] if data else {}
    except Exception as e:
        logger.error(f"Error in /analytics/dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn

    logger.info("Starting FastAPI server on 127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
