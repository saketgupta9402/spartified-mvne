import os
import logging
import pandas as pd
from sqlalchemy import create_engine, text
from fastapi import HTTPException
from dotenv import load_dotenv

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

DB_URI = os.getenv("DATABASE_URL")
if not DB_URI:
    # Fallback to local if not set in .env (though main.py expects it)
    DB_URI = "postgresql://postgres:manu9402*#@localhost:5433/ai_module_db"

engine = create_engine(DB_URI)

# Cache
billing_data_cache = {}

def fetch_data(query: str, params=None) -> list[dict]:
    cache_key = f"{query}:{str(params)}"
    if cache_key in billing_data_cache:
        logger.info(f"Cache hit for billing data query: {cache_key}")
        return billing_data_cache[cache_key]

    try:
        logger.info(f"Executing query: {query} with params: {params}")
        with engine.connect() as conn:
            result = pd.read_sql_query(text(query), conn, params=params)
            data = result.to_dict(orient="records")
            billing_data_cache[cache_key] = data
            logger.info(f"Fetched and cached data: {data}")
            return data if data else []
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        engine.dispose()

def execute_query(query: str, params=None):
    try:
        with engine.connect() as conn:
            query_lower = query.lower().strip()
            logger.info(f"Executing query: {query}")
            if query_lower.startswith("select"):
                result = pd.read_sql_query(text(query), conn, params=params)
                data = result.to_dict(orient="records")
                logger.info(f"Query result: {data}")
                return data if data else []
            elif query_lower.startswith("update") or query_lower.startswith(
                "insert into"
            ):
                with conn.begin():
                    result = conn.execute(text(query), params or {})
                    affected_rows = result.rowcount
                action = "updated" if query_lower.startswith("update") else "inserted"
                response_text = f"Success, {action} {affected_rows} row{'s' if affected_rows != 1 else ''}"
                logger.info(response_text)
                return response_text
            else:
                raise ValueError(f"Unsupported query type: {query[:50]}...")
    except Exception as e:
        logger.error(f"Error executing query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
