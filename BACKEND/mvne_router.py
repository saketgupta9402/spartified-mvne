from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
import pandas as pd
import io
from typing import List, Optional, Dict
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

# 7. MVNE Analytics Dashboard
@router.get("/analytics/dashboard")
async def get_mvne_dashboard_data(entity_id: Optional[int] = None):
    """
    Returns aggregated data for the 6 MVNE dashboard widgets.
    """
    params = {"entity_id": entity_id} if entity_id else {}
    entity_filter = " AND entity_id = :entity_id" if entity_id else ""

    # 1. Total Wholesale Cost Trend Over Time (Last 12-24 months)
    cost_trend_query = f"""
        SELECT year_month, SUM(grand_total) as total_cost
        FROM wholesale_billing_summary
        WHERE 1=1 {entity_filter}
        GROUP BY year_month
        ORDER BY year_month ASC
        LIMIT 24
    """
    
    # 2. Usage vs. Allowance Comparison (Stacked Bar Chart)
    # Grouping by service type across all records for the most recent month or selected entity
    usage_vs_allowance_query = f"""
        SELECT service_type, SUM(allowance_amount) as total_allowance, SUM(usage_amount) as total_usage
        FROM wholesale_billing_records
        WHERE 1=1 {entity_filter}
        AND year_month = (SELECT MAX(year_month) FROM wholesale_billing_records)
        GROUP BY service_type
    """

    # 3. Cost Breakdown by Service Type (Pie/Donut)
    cost_breakdown_query = f"""
        SELECT service_type, SUM(line_item_amount) as total_amount
        FROM wholesale_billing_records
        WHERE 1=1 {entity_filter}
        GROUP BY service_type
    """

    # 4. Overage Cost Trend (Line/Area)
    overage_trend_query = f"""
        SELECT year_month, SUM(total_overage_cost) as overage_cost
        FROM wholesale_billing_summary
        WHERE 1=1 {entity_filter}
        GROUP BY year_month
        ORDER BY year_month ASC
    """

    # 5. Wholesale Entity Comparison (Horizontal Bar Chart)
    entity_comparison_query = """
        SELECT e.name as entity_name, SUM(s.grand_total) as total_cost, 
               SUM(s.total_overage_cost) as total_overage,
               CASE WHEN SUM(s.grand_total) > 0 THEN (SUM(s.total_overage_cost) / SUM(s.grand_total)) * 100 ELSE 0 END as overage_percent
        FROM wholesale_billing_summary s
        JOIN wholesale_entities e ON s.entity_id = e.id
        GROUP BY e.name
    """

    # 6. Top-Level MVNE Analytics Overview (KPIs)
    kpi_query = f"""
        SELECT 
            SUM(CASE WHEN year_month = (SELECT MAX(year_month) FROM wholesale_billing_summary) THEN grand_total ELSE 0 END) as current_month_cost,
            SUM(CASE WHEN year_month = (SELECT TO_CHAR(TO_DATE(MAX(year_month), 'YYYY-MM') - INTERVAL '1 year', 'YYYY-MM') FROM wholesale_billing_summary) THEN grand_total ELSE 0 END) as last_year_month_cost,
            (SELECT service_type FROM wholesale_billing_records WHERE 1=1 {entity_filter} GROUP BY service_type ORDER BY SUM(usage_amount - allowance_amount) DESC LIMIT 1) as top_overage_service
        FROM wholesale_billing_summary
        WHERE 1=1 {entity_filter}
    """

    # 7. Service Usage Detail (Voice, SMS, Data) from monthly_consumption
    usage_detail_query = f"""
        SELECT 
            year_month,
            SUM(voice_minutes_used) as voice_usage,
            SUM(sms_count) as sms_usage,
            SUM(data_gb_used) as data_usage,
            COUNT(DISTINCT entity_id) as active_entities
        FROM monthly_consumption
        WHERE 1=1 {entity_filter}
        GROUP BY year_month
        ORDER BY year_month DESC LIMIT 6
    """

    try:
        usage_detail = fetch_data(usage_detail_query, params)
        
        # Mocking Porting Data as it's not in the current schema but requested in UI
        # In a real scenario, this would come from a 'porting_records' table
        porting_mock = [
            {"year_month": "2024-11", "portins": 6406, "mno_base": 19081, "portouts": 6181},
            {"year_month": "2024-10", "portins": 5800, "mno_base": 18500, "portouts": 5900},
            {"year_month": "2024-09", "portins": 6100, "mno_base": 18800, "portouts": 6000},
            {"year_month": "2024-08", "portins": 5950, "mno_base": 18200, "portouts": 5850},
        ]

        return {
            "costTrend": fetch_data(cost_trend_query, params),
            "usageVsAllowance": fetch_data(usage_vs_allowance_query, params),
            "costBreakdown": fetch_data(cost_breakdown_query, params),
            "overageTrend": fetch_data(overage_trend_query, params),
            "entityComparison": fetch_data(entity_comparison_query, params) if not entity_id else [],
            "kpis": fetch_data(kpi_query, params)[0] if fetch_data(kpi_query, params) else {},
            "usageDetail": usage_detail,
            "porting": porting_mock
        }
    except Exception as e:
        logger.error(f"Error fetching dashboard data: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard data")


@router.post("/upload-csv")
async def upload_mvne_csv(file: UploadFile = File(...)):
    """
    Uploads a CSV file to populate wholesale_billing_records and associated summaries.
    Expecting columns: year_month, entity_id, plan_id, service_type, allowance_amount, usage_amount, billable_amount, rate_applied, line_item_amount
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        # Validation
        required_cols = [
            'year_month', 'entity_id', 'plan_id', 'service_type', 
            'allowance_amount', 'usage_amount', 'billable_amount', 
            'rate_applied', 'line_item_amount'
        ]
        if not all(col in df.columns for col in required_cols):
            missing = [col for col in required_cols if col not in df.columns]
            raise HTTPException(status_code=400, detail=f"Missing required columns: {missing}")
        
        inserted_count = 0
        touched_entities_periods = set() # (entity_id, year_month)
        touched_entities_plans_periods = set() # (entity_id, plan_id, year_month)

        with engine.connect() as conn:
            with conn.begin():
                for _, row in df.iterrows():
                    entity_id = int(row['entity_id'])
                    plan_id = int(row['plan_id'])
                    period = str(row['year_month'])
                    touched_entities_periods.add((entity_id, period))
                    touched_entities_plans_periods.add((entity_id, plan_id, period))

                    # 1. Ensure Billing Cycle exists
                    cycle_query = text("""
                        SELECT id FROM wholesale_billing_cycles 
                        WHERE entity_id = :entity_id AND billing_period = :period
                        LIMIT 1
                    """)
                    cycle_result = conn.execute(cycle_query, {
                        "entity_id": entity_id, 
                        "period": period
                    }).fetchone()
                    
                    if cycle_result:
                        cycle_id = cycle_result[0]
                    else:
                        year_str, month_str = period.split('-')
                        year, month = int(year_str), int(month_str)
                        start_date = datetime.date(year, month, 1)
                        if month == 12:
                            end_date = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
                        else:
                            end_date = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)
                        
                        insert_cycle = text("""
                            INSERT INTO wholesale_billing_cycles 
                            (entity_id, cycle_start_date, cycle_end_date, billing_period, status, total_amount)
                            VALUES (:entity_id, :start, :end, :period, 'Draft', 0)
                            RETURNING id
                        """)
                        cycle_id = conn.execute(insert_cycle, {
                            "entity_id": entity_id,
                            "start": start_date,
                            "end": end_date,
                            "period": period
                        }).fetchone()[0]

                    # 2. Insert Billing Record
                    insert_record = text("""
                        INSERT INTO wholesale_billing_records 
                        (entity_id, plan_id, billing_cycle_id, year_month, service_type, 
                         allowance_amount, usage_amount, billable_amount, rate_applied, line_item_amount)
                        VALUES (:entity_id, :plan_id, :cycle_id, :year_month, :service_type,
                                :allowance, :usage, :billable, :rate, :amount)
                    """)
                    conn.execute(insert_record, {
                        "entity_id": entity_id,
                        "plan_id": plan_id,
                        "cycle_id": cycle_id,
                        "year_month": period,
                        "service_type": str(row['service_type']),
                        "allowance": float(row['allowance_amount']),
                        "usage": float(row['usage_amount']),
                        "billable": float(row['billable_amount']),
                        "rate": float(row['rate_applied']),
                        "amount": float(row['line_item_amount'])
                    })
                    inserted_count += 1
                
                # --- After processing all rows, update summaries ---
                
                # 3. Update wholesale_billing_summary
                for ent_id, ym in touched_entities_periods:
                    # Sum costs from records
                    agg_query = text("""
                        SELECT 
                            SUM(line_item_amount) as total_cost,
                            SUM(CASE WHEN billable_amount > 0 THEN line_item_amount ELSE 0 END) as overage_cost
                        FROM wholesale_billing_records
                        WHERE entity_id = :ent_id AND year_month = :ym
                    """)
                    agg_res = conn.execute(agg_query, {"ent_id": ent_id, "ym": ym}).fetchone()
                    total_cost = float(agg_res[0] or 0)
                    overage_cost = float(agg_res[1] or 0)
                    base_cost = total_cost - overage_cost

                    # Upsert summary
                    upsert_summary = text("""
                        INSERT INTO wholesale_billing_summary (entity_id, year_month, total_base_cost, total_overage_cost, grand_total, invoice_status)
                        VALUES (:ent_id, :ym, :base, :overage, :total, 'Draft')
                        ON CONFLICT (entity_id, year_month) DO UPDATE SET
                            total_base_cost = EXCLUDED.total_base_cost,
                            total_overage_cost = EXCLUDED.total_overage_cost,
                            grand_total = EXCLUDED.grand_total
                    """)
                    # Note: We need a unique constraint on (entity_id, year_month) for ON CONFLICT to work.
                    # If not exist, we'll delete and insert just to be safe for this demo.
                    conn.execute(text("DELETE FROM wholesale_billing_summary WHERE entity_id = :ent_id AND year_month = :ym"), {"ent_id": ent_id, "ym": ym})
                    conn.execute(text("""
                        INSERT INTO wholesale_billing_summary (entity_id, year_month, total_base_cost, total_overage_cost, grand_total, invoice_status)
                        VALUES (:ent_id, :ym, :base, :overage, :total, 'Draft')
                    """), {"ent_id": ent_id, "ym": ym, "base": base_cost, "overage": overage_cost, "total": total_cost})

                # 4. Update monthly_consumption
                for ent_id, pl_id, ym in touched_entities_plans_periods:
                    usage_query = text("""
                        SELECT 
                            SUM(CASE WHEN service_type = 'voice_domestic' THEN usage_amount ELSE 0 END) as voice,
                            SUM(CASE WHEN service_type = 'sms_mo' THEN usage_amount ELSE 0 END) as sms,
                            SUM(CASE WHEN service_type = 'data_domestic' THEN usage_amount ELSE 0 END) as data
                        FROM wholesale_billing_records
                        WHERE entity_id = :ent_id AND plan_id = :pl_id AND year_month = :ym
                    """)
                    usage_res = conn.execute(usage_query, {"ent_id": ent_id, "pl_id": pl_id, "ym": ym}).fetchone()
                    voice = int(usage_res[0] or 0)
                    sms = int(usage_res[1] or 0)
                    data = float(usage_res[2] or 0)

                    # Upsert consumption
                    conn.execute(text("DELETE FROM monthly_consumption WHERE entity_id = :ent_id AND plan_id = :pl_id AND year_month = :ym"), 
                                 {"ent_id": ent_id, "pl_id": pl_id, "ym": ym})
                    conn.execute(text("""
                        INSERT INTO monthly_consumption (entity_id, plan_id, year_month, voice_minutes_used, sms_count, data_gb_used)
                        VALUES (:ent_id, :pl_id, :ym, :voice, :sms, :data)
                    """), {"ent_id": ent_id, "pl_id": pl_id, "ym": ym, "voice": voice, "sms": sms, "data": data})

        # Clear database cache to ensure frontend sees new data
        try:
            from database import billing_data_cache
            billing_data_cache.clear()
            logger.info("Database cache cleared after CSV upload.")
        except Exception as cache_err:
            logger.warning(f"Failed to clear cache: {cache_err}")

        return {"message": f"Successfully processed {inserted_count} records. Summaries and consumption updated."}
    except Exception as e:
        logger.error(f"Error uploading MVNE CSV: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {str(e)}")
