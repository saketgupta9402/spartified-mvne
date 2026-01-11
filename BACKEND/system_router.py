from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
import pandas as pd
import io
import logging
from sqlalchemy import text
from database import engine, billing_data_cache
from typing import Dict, Any

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["System"])

@router.post("/upload-master-csv")
async def upload_master_csv(file: UploadFile = File(...)):
    """
    Upload a Master CSV containing records for multiple modules:
    WHOLESALE, RETAIL, PERFORMANCE, METRICS.
    """
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        if 'record_type' not in df.columns:
            raise HTTPException(status_code=400, detail="Missing 'record_type' column in CSV")

        results = {
            "WHOLESALE": 0,
            "RETAIL": 0,
            "PERFORMANCE": 0,
            "METRICS": 0
        }

        with engine.begin() as conn:
            # 1. Dispatch Wholesale Records
            wholesale_df = df[df['record_type'] == 'WHOLESALE']
            if not wholesale_df.empty:
                results["WHOLESALE"] = await _handle_wholesale_dispatch(conn, wholesale_df)

            # 2. Dispatch Retail Records
            retail_df = df[df['record_type'] == 'RETAIL']
            if not retail_df.empty:
                results["RETAIL"] = await _handle_retail_dispatch(conn, retail_df)

            # 3. Dispatch Performance Records
            perf_df = df[df['record_type'] == 'PERFORMANCE']
            if not perf_df.empty:
                results["PERFORMANCE"] = await _handle_performance_dispatch(conn, perf_df)

            # 4. Dispatch Dashboard Metrics
            metrics_df = df[df['record_type'] == 'METRICS']
            if not metrics_df.empty:
                results["METRICS"] = await _handle_metrics_dispatch(conn, metrics_df)

        # Clear all caches
        billing_data_cache.clear()

        return {
            "message": "Master upload completed successfully",
            "counts": results
        }

    except Exception as e:
        logger.error(f"Master CSV Upload Failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

async def _handle_wholesale_dispatch(conn, df: pd.DataFrame):
    """Reuse existing wholesale insertion logic."""
    # This logic is very similar to what's in mvne_router.py
    # We'll implement a slightly more streamlined version here for the batch dispatcher
    inserted_count = 0
    
    # We need to ensure billing cycles exist
    for _, row in df.iterrows():
        entity_id = row['entity_id']
        year_month = row['year_month']
        
        # Ensure Billing Cycle exists
        cycle_query = text("""
            SELECT id FROM wholesale_billing_cycles 
            WHERE entity_id = :ent_id AND billing_period = :ym
        """)
        cycle = conn.execute(cycle_query, {"ent_id": entity_id, "ym": year_month}).fetchone()
        
        if not cycle:
            # Create a simple cycle
            insert_cycle = text("""
                INSERT INTO wholesale_billing_cycles (entity_id, billing_period, status)
                VALUES (:ent_id, :ym, 'Open') RETURNING id
            """)
            cycle_id = conn.execute(insert_cycle, {"ent_id": entity_id, "ym": year_month}).scalar()
        else:
            cycle_id = cycle[0]

        # Insert Record
        insert_record = text("""
            INSERT INTO wholesale_billing_records 
            (entity_id, plan_id, billing_cycle_id, year_month, service_type, allowance_amount, usage_amount, billable_amount, rate_applied, line_item_amount)
            VALUES (:ent_id, :pl_id, :c_id, :ym, :st, :aa, :ua, :ba, :ra, :lia)
        """)
        conn.execute(insert_record, {
            "ent_id": entity_id,
            "pl_id": row['plan_id'],
            "c_id": cycle_id,
            "ym": year_month,
            "st": row['service_type'],
            "aa": row['allowance_amount'],
            "ua": row['usage_amount'],
            "ba": row['billable_amount'],
            "ra": row['rate_applied'],
            "lia": row['line_item_amount']
        })
        inserted_count += 1
        
    return inserted_count

async def _handle_retail_dispatch(conn, df: pd.DataFrame):
    """Insert records into billing_data."""
    inserted_count = 0
    # Required: sim_id, account_name, rate_plan, total_usage, total_bill, billing_cycle
    for _, row in df.iterrows():
        # Check if row exists or just append? The prompt implies 'persistence' which usually means 'add/update'.
        # For simplicity and given the task, we'll append.
        query = text("""
            INSERT INTO billing_data 
            (sim_id, account_name, rate_plan, total_usage, total_bill, billing_cycle)
            VALUES (:sim, :acc, :rp, :use, :bill, :bc)
        """)
        conn.execute(query, {
            "sim": row['sim_id'],
            "acc": row['account_name'],
            "rp": row['rate_plan'],
            "use": row['total_usage'],
            "bill": row['total_bill'],
            "bc": row['billing_cycle']
        })
        inserted_count += 1
    return inserted_count

async def _handle_performance_dispatch(conn, df: pd.DataFrame):
    """Insert or Update performance_analytics."""
    inserted_count = 0
    for _, row in df.iterrows():
        # Upsert logic for performance_analytics based on (account_name, billing_cycle)
        query = text("""
            INSERT INTO performance_analytics 
            (billing_cycle, metric_date, account_name, account_segment, payment_performance_score, churn_risk_score, dispute_resolution_days, avg_revenue_per_sim, profitability_score)
            VALUES (:bc, :md, :an, :asg, :pps, :crs, :drd, :arps, :ps)
            ON CONFLICT (account_name, billing_cycle) DO UPDATE SET
            metric_date = EXCLUDED.metric_date,
            account_segment = EXCLUDED.account_segment,
            payment_performance_score = EXCLUDED.payment_performance_score,
            churn_risk_score = EXCLUDED.churn_risk_score,
            dispute_resolution_days = EXCLUDED.dispute_resolution_days,
            avg_revenue_per_sim = EXCLUDED.avg_revenue_per_sim,
            profitability_score = EXCLUDED.profitability_score
        """)
        conn.execute(query, {
            "bc": row['billing_cycle'],
            "md": row['metric_date'],
            "an": row['account_name'],
            "asg": row['account_segment'],
            "pps": row['payment_performance_score'],
            "crs": row['churn_risk_score'],
            "drd": row['dispute_resolution_days'],
            "arps": row['avg_revenue_per_sim'],
            "ps": row['profitability_score']
        })
        inserted_count += 1
    return inserted_count

async def _handle_metrics_dispatch(conn, df: pd.DataFrame):
    """Insert or Update dashboard_metrics."""
    inserted_count = 0
    for _, row in df.iterrows():
        # Upsert logic for dashboard_metrics based on billing_cycle
        query = text("""
            INSERT INTO dashboard_metrics 
            (billing_cycle, metric_date, total_revenue, gross_profit, net_profit, total_opex, total_cogs, active_accounts, active_sims)
            VALUES (:bc, :md, :tr, :gp, :np, :to, :tc, :aa, :asims)
            ON CONFLICT (billing_cycle) DO UPDATE SET
            metric_date = EXCLUDED.metric_date,
            total_revenue = EXCLUDED.total_revenue,
            gross_profit = EXCLUDED.gross_profit,
            net_profit = EXCLUDED.net_profit,
            total_opex = EXCLUDED.total_opex,
            total_cogs = EXCLUDED.total_cogs,
            active_accounts = EXCLUDED.active_accounts,
            active_sims = EXCLUDED.active_sims
        """)
        conn.execute(query, {
            "bc": row['billing_cycle'],
            "md": row['metric_date'],
            "tr": row['total_revenue'],
            "gp": row['gross_profit'],
            "np": row['net_profit'],
            "to": row['total_opex'],
            "tc": row['total_cogs'],
            "aa": row['active_accounts'],
            "asims": row['active_sims']
        })
        inserted_count += 1
    return inserted_count
