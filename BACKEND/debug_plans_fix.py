
import pandas as pd
from sqlalchemy import create_engine, text

# Replicate database connection logic
DB_URI = "postgresql://postgres:manu9402*#@localhost:5433/ai_module_db"
engine = create_engine(DB_URI)

def test_get_wholesale_plans_legacy_format():
    print("\n--- Testing get_wholesale_plans legacy format ---")
    try:
        with engine.connect() as conn:
            # Replicate the new query logic
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
                ORDER BY plan_name asc
                LIMIT 5
            """
            result = pd.read_sql_query(text(query), conn)
            print("Success! Data preview:")
            print(result)
            
            # Verify columns exist
            required_cols = ['wholesale_plan_name', 'allowance', 'fee', 'out_of_bundle_rate_home', 'out_of_bundle_rate_roaming']
            missing = [c for c in required_cols if c not in result.columns]
            if missing:
                print(f"FAILED: Missing columns: {missing}")
            else:
                print("SUCCESS: All legacy columns present.")
            
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_get_wholesale_plans_legacy_format()
