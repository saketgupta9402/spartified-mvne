from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
import datetime
import logging
from sqlalchemy import text
from database import engine, fetch_data, execute_query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mvne", tags=["MVNE"])

# Pydantic Models (Redefined here or imported if they were already in main.py)
# Most of these are already in main.py, so I'll assume they are available or I'll re-declare if needed.
# Since I'm creating a new file, I'll re-declare to be safe and avoid circular imports if main.py is the entry point.

class WholesaleEntity(BaseModel):
    id: Optional[int] = None
    name: str
    type: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = "USD"
    status: Optional[str] = "active"

class WholesalePlan(BaseModel):
    id: Optional[int] = None
    entity_id: int
    plan_name: Optional[str] = None
    plan_type: Optional[str] = None
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    revenue_share_pct: Optional[float] = 0.0

class ServiceRate(BaseModel):
    id: Optional[int] = None
    plan_id: int
    service_type: Optional[str] = None
    rate_per_unit: Optional[float] = 0.0
    unit: Optional[str] = None
    overage_rate: Optional[float] = 0.0

class PlanAllowance(BaseModel):
    id: Optional[int] = None
    plan_id: int
    service_type: Optional[str] = None
    allowance_amount: Optional[float] = 0.0
    allowance_unit: Optional[str] = None
    period: Optional[str] = "monthly"

class MonthlyConsumption(BaseModel):
    id: Optional[int] = None
    entity_id: int
    plan_id: int
    year_month: Optional[str] = None
    voice_minutes_used: Optional[int] = 0
    sms_count: Optional[int] = 0
    data_gb_used: Optional[float] = 0.0

# 1. Wholesale Entities Endpoints
@router.get("/entities", response_model=List[WholesaleEntity])
async def get_entities(status: Optional[str] = None, country: Optional[str] = None, limit: int = 10, offset: int = 0):
    query = "SELECT * FROM wholesale_entities WHERE 1=1"
    params = {}
    if status:
        query += " AND status = :status"
        params["status"] = status
    if country:
        query += " AND country = :country"
        params["country"] = country
    query += " LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset
    
    return fetch_data(query, params)

@router.get("/entities/{entity_id}", response_model=WholesaleEntity)
async def get_entity(entity_id: int):
    query = "SELECT * FROM wholesale_entities WHERE id = :entity_id"
    data = fetch_data(query, {"entity_id": entity_id})
    if not data:
        raise HTTPException(status_code=404, detail="Entity not found")
    return data[0]

@router.post("/entities")
async def create_entity(entity: WholesaleEntity):
    query = """
        INSERT INTO wholesale_entities (name, type, country, currency, status)
        VALUES (:name, :type, :country, :currency, :status)
    """
    return execute_query(query, entity.dict(exclude={"id"}))

@router.put("/entities/{entity_id}")
async def update_entity(entity_id: int, entity: WholesaleEntity):
    query = """
        UPDATE wholesale_entities 
        SET name = :name, type = :type, country = :country, currency = :currency, status = :status
        WHERE id = :entity_id
    """
    params = entity.dict()
    params["entity_id"] = entity_id
    return execute_query(query, params)

@router.delete("/entities/{entity_id}")
async def delete_entity(entity_id: int):
    query = "UPDATE wholesale_entities SET status = 'inactive' WHERE id = :entity_id"
    return execute_query(query, {"entity_id": entity_id})

# 2. Wholesale Plans Endpoints
@router.get("/plans", response_model=List[WholesalePlan])
async def get_plans(entity_id: Optional[int] = None, limit: int = 10, offset: int = 0):
    query = "SELECT * FROM wholesale_plans WHERE 1=1"
    params = {}
    if entity_id:
        query += " AND entity_id = :entity_id"
        params["entity_id"] = entity_id
    query += " LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset
    return fetch_data(query, params)

@router.get("/plans/{plan_id}", response_model=WholesalePlan)
async def get_plan(plan_id: int):
    query = "SELECT * FROM wholesale_plans WHERE id = :plan_id"
    data = fetch_data(query, {"plan_id": plan_id})
    if not data:
        raise HTTPException(status_code=404, detail="Plan not found")
    return data[0]

@router.post("/plans")
async def create_plan(plan: WholesalePlan):
    query = """
        INSERT INTO wholesale_plans (entity_id, plan_name, plan_type, start_date, end_date, revenue_share_pct)
        VALUES (:entity_id, :plan_name, :plan_type, :start_date, :end_date, :revenue_share_pct)
    """
    return execute_query(query, plan.dict(exclude={"id"}))

# 3. Service Rates Endpoints
@router.get("/rates")
async def get_rates(plan_id: Optional[int] = None, service_type: Optional[str] = None):
    query = "SELECT * FROM service_rates WHERE 1=1"
    params = {}
    if plan_id:
        query += " AND plan_id = :plan_id"
        params["plan_id"] = plan_id
    if service_type:
        query += " AND service_type = :service_type"
        params["service_type"] = service_type
    return fetch_data(query, params)

# 4. Plan Allowances Endpoints
@router.get("/allowances")
async def get_allowances(plan_id: Optional[int] = None):
    query = "SELECT * FROM plan_allowances WHERE 1=1"
    params = {}
    if plan_id:
        query += " AND plan_id = :plan_id"
        params["plan_id"] = plan_id
    return fetch_data(query, params)

# 5. Monthly Consumption Endpoints
@router.get("/consumption")
async def get_consumption(entity_id: Optional[int] = None, year_month: Optional[str] = None):
    query = "SELECT * FROM monthly_consumption WHERE 1=1"
    params = {}
    if entity_id:
        query += " AND entity_id = :entity_id"
        params["entity_id"] = entity_id
    if year_month:
        query += " AND year_month = :year_month"
        params["year_month"] = year_month
    return fetch_data(query, params)

# 6. Wholesale Billing Endpoints
@router.get("/billing/summary")
async def get_billing_summary(entity_id: Optional[int] = None, year_month: Optional[str] = None):
    query = "SELECT * FROM wholesale_billing_summary WHERE 1=1"
    params = {}
    if entity_id:
        query += " AND entity_id = :entity_id"
        params["entity_id"] = entity_id
    if year_month:
        query += " AND year_month = :year_month"
        params["year_month"] = year_month
    return fetch_data(query, params)

@router.get("/billing/{entity_id}/{year_month}")
async def get_billing_details(entity_id: int, year_month: str):
    summary_query = "SELECT * FROM wholesale_billing_summary WHERE entity_id = :entity_id AND year_month = :year_month"
    records_query = "SELECT * FROM wholesale_billing_records WHERE entity_id = :entity_id AND year_month = :year_month"
    
    summary = fetch_data(summary_query, {"entity_id": entity_id, "year_month": year_month})
    records = fetch_data(records_query, {"entity_id": entity_id, "year_month": year_month})
    
    return {
        "summary": summary[0] if summary else None,
        "records": records
    }

# Additional Insights (Placeholder logic for AI-driven insights)
@router.get("/insights/trends")
async def get_insights_trends(entity_id: int, metric: str = "data_gb_used"):
    query = f"SELECT year_month, {metric} FROM monthly_consumption WHERE entity_id = :entity_id ORDER BY year_month"
    return fetch_data(query, {"entity_id": entity_id})
