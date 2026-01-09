from sqlalchemy import create_engine, text
import pandas as pd
import random
import datetime
import time
from collections import defaultdict
import logging
from sqlalchemy.exc import SQLAlchemyError
import sys

# Configure logging without emoji characters for Windows compatibility
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("mock_data_generation.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# PostgreSQL connection for local database
DB_URI = "postgresql://postgres:manu9402*#@localhost:5433/ai_module_db"

try:
    engine = create_engine(DB_URI, echo=False, pool_pre_ping=True)
    # Test connection
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    logger.info("Database connection established successfully!")
except Exception as e:
    logger.error(f"Failed to connect to database: {e}")
    sys.exit(1)

# Define rate plan limits in MB for different data bundles (Retail)
rate_plans = {
    "5GB Internet": 5120,
    "10GB Internet": 10240,
    "20GB Internet": 20480,
    "50GB Internet": 51200,
    "100GB Internet": 102400,
    "200GB Internet": 204800,
    "500GB Internet": 512000,
}

# Define bundle fees in currency units for each rate plan (Retail)
bundle_fees = {
    "5GB Internet": 5,
    "10GB Internet": 10,
    "20GB Internet": 15,
    "50GB Internet": 25,
    "100GB Internet": 30,
    "200GB Internet": 50,
    "500GB Internet": 60,
}

# Lists of networks, countries, and accounts for mock data generation
networks = [
    "Lebara", "Vodafone UK", "3UK", "EE", "Swiss Telecom", 
    "W3", "CKH Austria", "US Cellular", "Orange", "T-Mobile"
]

countries = [
    "USA", "UK", "Canada", "India", "Australia", "Brazil", 
    "Italy", "Turkey", "Slovakia", "Germany", "France", 
    "Spain", "Netherlands"
]

accounts = [
    "Coca-Cola", "BMW", "Pepsi", "Mercedes", "Tesla", "Ford", "Fiat", 
    "Land Rover", "Skoda", "British Gas", "ItalGas", "Zomato", "Uber", 
    "Ola", "Tesco", "Sainsbury", "Waitrose", "Lidl", "Coop", 
    "Southern Electric", "Octopus", "Vodafone Broadband", "Sky", 
    "Lebara", "DigiTalk", "TalkMobile", "Amazon", "Starbucks", 
    "Microsoft", "Google", "Apple", "Samsung", "Netflix", "Spotify"
]

home_country = "UK"
home_rate = 0.015
row_rate_edited = 0.09876
current_year = datetime.datetime.now().year
current_month = datetime.datetime.now().month


def create_tables():
    """Drop and create necessary tables with correct PostgreSQL syntax and Foreign Keys."""
    try:
        with engine.connect() as conn:
            logger.info("Starting table creation process...")

            # Drop existing tables in correct reverse dependency order
            tables_to_drop = [
                "wholesale_billing_summary",
                "wholesale_billing_records",
                "wholesale_billing_cycles",
                "monthly_consumption",
                "plan_allowances",
                "service_rates",
                "wholesale_plans",
                "wholesale_entities",  # New tables
                "performance_analytics",
                "dashboard_metrics",
                "cdr_data",
                "billing_data",
                "account_info",
                "rate_plan",
                "wholesale_plan", # Old table
            ]

            for table in tables_to_drop:
                try:
                    conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
                    logger.info(f"Dropped table {table}")
                except Exception as e:
                    logger.warning(f"Failed to drop table {table}: {e}")

            # --- 1. Wholesale Entities ---
            conn.execute(text("""
                CREATE TABLE wholesale_entities (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    type VARCHAR(50), 
                    country VARCHAR(100),
                    currency VARCHAR(10) DEFAULT 'USD',
                    status VARCHAR(50) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            logger.info("Created wholesale_entities table")

            # --- 2. Wholesale Plans ---
            conn.execute(text("""
                CREATE TABLE wholesale_plans (
                    id SERIAL PRIMARY KEY,
                    entity_id INT REFERENCES wholesale_entities(id),
                    plan_name VARCHAR(255),
                    plan_type VARCHAR(50), 
                    start_date DATE,
                    end_date DATE,
                    revenue_share_pct DECIMAL(5,2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            logger.info("Created wholesale_plans table")

            # --- 3. Service Rates ---
            conn.execute(text("""
                CREATE TABLE service_rates (
                    id SERIAL PRIMARY KEY,
                    plan_id INT REFERENCES wholesale_plans(id),
                    service_type VARCHAR(50), 
                    rate_per_unit DECIMAL(10, 6),
                    unit VARCHAR(20), 
                    overage_rate DECIMAL(10, 6)
                )
            """))
            logger.info("Created service_rates table")

            # --- 4. Plan Allowances ---
            conn.execute(text("""
                CREATE TABLE plan_allowances (
                    id SERIAL PRIMARY KEY,
                    plan_id INT REFERENCES wholesale_plans(id),
                    service_type VARCHAR(50),
                    allowance_amount DECIMAL(15, 2), 
                    allowance_unit VARCHAR(50),
                    period VARCHAR(20) DEFAULT 'monthly'
                )
            """))
            logger.info("Created plan_allowances table")

            # --- 5. Monthly Consumption ---
            conn.execute(text("""
                CREATE TABLE monthly_consumption (
                    id SERIAL PRIMARY KEY,
                    entity_id INT REFERENCES wholesale_entities(id),
                    plan_id INT REFERENCES wholesale_plans(id),
                    year_month VARCHAR(7), 
                    voice_minutes_used BIGINT,
                    sms_count BIGINT,
                    data_gb_used DECIMAL(15, 2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            logger.info("Created monthly_consumption table")

            # --- 6. Billing Cycles ---
            conn.execute(text("""
                CREATE TABLE wholesale_billing_cycles (
                    id SERIAL PRIMARY KEY,
                    entity_id INT REFERENCES wholesale_entities(id),
                    cycle_start_date DATE,
                    cycle_end_date DATE,
                    billing_period VARCHAR(20),
                    status VARCHAR(50),
                    total_amount DECIMAL(15, 2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            logger.info("Created wholesale_billing_cycles table")

            # --- 7. Billing Records (Detailed Line Items) ---
            conn.execute(text("""
                CREATE TABLE wholesale_billing_records (
                    id SERIAL PRIMARY KEY,
                    entity_id INT REFERENCES wholesale_entities(id),
                    plan_id INT REFERENCES wholesale_plans(id),
                    billing_cycle_id INT REFERENCES wholesale_billing_cycles(id),
                    year_month VARCHAR(7),
                    service_type VARCHAR(50),
                    allowance_amount DECIMAL(15, 2),
                    usage_amount DECIMAL(15, 2),
                    billable_amount DECIMAL(15, 2),
                    rate_applied DECIMAL(10, 6),
                    line_item_amount DECIMAL(15, 2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            logger.info("Created wholesale_billing_records table")

            # --- 8. Billing Summary (Aggregated) ---
            conn.execute(text("""
                CREATE TABLE wholesale_billing_summary (
                    id SERIAL PRIMARY KEY,
                    entity_id INT REFERENCES wholesale_entities(id),
                    year_month VARCHAR(7),
                    total_base_cost DECIMAL(15, 2),
                    total_overage_cost DECIMAL(15, 2),
                    grand_total DECIMAL(15, 2),
                    invoice_status VARCHAR(50),
                    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            logger.info("Created wholesale_billing_summary table")

            # --- Retail Tables ---

            # Create rate_plan table
            conn.execute(text("""
                CREATE TABLE rate_plan (
                    rate_plan VARCHAR(255) PRIMARY KEY,
                    bundle_allowance INT NOT NULL DEFAULT 0,
                    bundle_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                    home_rate DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
                    row_rate DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            logger.info("Created rate_plan table")

            # Create cdr_data table
            conn.execute(text("""
                CREATE TABLE cdr_data (
                    id SERIAL PRIMARY KEY,
                    sim_id VARCHAR(255) NOT NULL,
                    data_usage INT NOT NULL DEFAULT 0,
                    network VARCHAR(255) NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    country VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("CREATE INDEX idx_cdr_sim_id ON cdr_data (sim_id)"))
            logger.info("Created cdr_data table")

            # Create billing_data table with link to NEW wholesale_plans
            conn.execute(text("""
                CREATE TABLE billing_data (
                    id SERIAL PRIMARY KEY,
                    sim_id VARCHAR(255) NOT NULL,
                    account_name VARCHAR(255) NOT NULL,
                    rate_plan VARCHAR(255) NOT NULL,
                    total_usage INT NOT NULL DEFAULT 0,
                    usage_from_plan INT NOT NULL DEFAULT 0,
                    bundle_allowance INT NOT NULL DEFAULT 0,
                    bundle_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                    usage_out_of_bundle INT NOT NULL DEFAULT 0,
                    charges_out_of_bundle DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                    total_bill DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                    billing_cycle VARCHAR(7) NOT NULL,
                    wholesale_plan_id INT, 
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (rate_plan) REFERENCES rate_plan(rate_plan),
                    FOREIGN KEY (wholesale_plan_id) REFERENCES wholesale_plans(id)
                )
            """))
            conn.execute(text("CREATE INDEX idx_billing_account_name ON billing_data (account_name)"))
            logger.info("Created billing_data table")

            # Create account_info table
            conn.execute(text("""
                CREATE TABLE account_info (
                    id SERIAL PRIMARY KEY,
                    account_name VARCHAR(255) NOT NULL,
                    sim_id VARCHAR(255) NOT NULL,
                    rate_plan VARCHAR(255) NOT NULL,
                    billing_cycle VARCHAR(7) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (rate_plan) REFERENCES rate_plan(rate_plan)
                )
            """))
            logger.info("Created account_info table")

            # --- Analytics Tables ---
            conn.execute(text("""
                CREATE TABLE dashboard_metrics (
                    id SERIAL PRIMARY KEY,
                    billing_cycle VARCHAR(7) NOT NULL UNIQUE,
                    metric_date DATE NOT NULL,
                    total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    gross_profit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    net_profit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    total_opex DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    total_cogs DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    active_accounts INTEGER NOT NULL DEFAULT 0,
                    active_sims INTEGER NOT NULL DEFAULT 0,
                    new_accounts INTEGER NOT NULL DEFAULT 0,   
                    lost_accounts INTEGER NOT NULL DEFAULT 0,
                    total_usage_gb DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    avg_cogs_per_account DECIMAL(10,2) NOT NULL DEFAULT 0.00,   
                    avg_opex_per_account DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    accounts_receivable DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))

            conn.execute(text("""
                CREATE TABLE performance_analytics (
                    id SERIAL PRIMARY KEY,
                    billing_cycle VARCHAR(7) NOT NULL,
                    metric_date DATE NOT NULL,
                    account_name VARCHAR(255) NOT NULL,
                    account_segment VARCHAR(50) NOT NULL DEFAULT 'SMB',
                    payment_performance_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    churn_risk_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    dispute_resolution_days DECIMAL(4,2) NOT NULL DEFAULT 0.00,
                    avg_revenue_per_sim DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    profitability_score INTEGER NOT NULL DEFAULT 0,
                    credit_utilization_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    discount_usage_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    avg_discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    discount_sensitivity VARCHAR(20) NOT NULL DEFAULT 'Medium',
                    optimal_discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    q3_forecast DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    q4_forecast DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                    yoy_growth_forecast DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    forecast_confidence_level DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    total_sims INTEGER NOT NULL DEFAULT 0,
                    total_usage_mb INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT unique_account_billing_cycle UNIQUE (account_name, billing_cycle)
                )
            """))
            conn.commit()
            logger.info("All tables created successfully!")

    except SQLAlchemyError as e:
        logger.error(f"Database error creating tables: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error creating tables: {e}")
        raise


def generate_mock_data():
    """Generate mock data for both Wholesale and Retail modules."""
    t0 = time.time()
    logger.info("Starting mock data generation...")

    try:
        # --- 1. Wholesale Data Generation ---
        
        # Entities
        entities = [
            {"id": 1, "name": "Vodafone Wholesale", "type": "MNO", "country": "UK"},
            {"id": 2, "name": "O2 Wholesale", "type": "MNO", "country": "UK"},
            {"id": 3, "name": "EE Wholesale", "type": "MNO", "country": "UK"},
            {"id": 4, "name": "Gamma Telecom", "type": "MVNA", "country": "UK"},
            {"id": 5, "name": "Transatel", "type": "MVNE", "country": "France"},
        ]
        entities_df = pd.DataFrame(entities)

        # Plans
        plans_data = []
        plan_id_counter = 1
        for entity in entities:
             # creating a couple of plans for each entity
            plans_data.append({
                "id": plan_id_counter,
                "entity_id": entity["id"],
                "plan_name": f"{entity['name']} Standard Pool 2025",
                "plan_type": "Capacity-Based",
                "start_date": datetime.date(2024, 1, 1),
                "end_date": datetime.date(2026, 12, 31),
                "revenue_share_pct": 0.0
            })
            plan_id_counter += 1
            plans_data.append({
                "id": plan_id_counter,
                "entity_id": entity["id"],
                "plan_name": f"{entity['name']} Flex PayG",
                "plan_type": "Pay-Per-Unit",
                "start_date": datetime.date(2024, 1, 1),
                "end_date": datetime.date(2026, 12, 31),
                "revenue_share_pct": 0.0
            })
            plan_id_counter += 1
        plans_df = pd.DataFrame(plans_data)

        # Rates and Allowances
        rates_data = []
        allowances_data = []
        rate_id_counter = 1
        allowance_id_counter = 1

        for plan in plans_data:
            is_pool = "Pool" in plan["plan_name"]
            
            # Allowances
            if is_pool:
                allowances_data.extend([
                    {"id": allowance_id_counter, "plan_id": plan["id"], "service_type": "data_domestic", "allowance_amount": 10000.0, "allowance_unit": "GB"},
                    {"id": allowance_id_counter+1, "plan_id": plan["id"], "service_type": "voice_domestic", "allowance_amount": 50000.0, "allowance_unit": "Min"},
                ])
                allowance_id_counter += 2
            else:
                allowances_data.extend([
                   {"id": allowance_id_counter, "plan_id": plan["id"], "service_type": "data_domestic", "allowance_amount": 0.0, "allowance_unit": "GB"}, # PayG
                ])
                allowance_id_counter += 1

            # Rates
            rates_data.extend([
                {"id": rate_id_counter, "plan_id": plan["id"], "service_type": "data_domestic", "rate_per_unit": 1.5 if is_pool else 2.0, "unit": "per_gb", "overage_rate": 2.5},
                {"id": rate_id_counter+1, "plan_id": plan["id"], "service_type": "voice_domestic", "rate_per_unit": 0.02, "unit": "per_min", "overage_rate": 0.05},
                {"id": rate_id_counter+2, "plan_id": plan["id"], "service_type": "sms_mo", "rate_per_unit": 0.01, "unit": "per_sms", "overage_rate": 0.01},
            ])
            rate_id_counter += 3
        
        rates_df = pd.DataFrame(rates_data)
        allowances_df = pd.DataFrame(allowances_data)

        # Monthly Consumption & Billing Calculation
        consumption_data = []
        billing_cycles_data = []
        billing_records_data = []
        billing_summary_data = []
        
        cycle_id_counter = 1
        record_id_counter = 1
        summary_id_counter = 1
        consumption_id_counter = 1

        # Generate for last 12 months
        params_date = datetime.date.today() - datetime.timedelta(days=365)
        
        for i in range(12):
            curr_date = params_date + datetime.timedelta(days=30*i)
            year_month = curr_date.strftime("%Y-%m")
            cycle_start = curr_date.replace(day=1)
            next_month = cycle_start.replace(day=28) + datetime.timedelta(days=4)
            cycle_end = next_month - datetime.timedelta(days=next_month.day)

            for plan in plans_data:
                # Random Consumption
                data_usage = random.uniform(500, 15000)
                voice_usage = random.randint(1000, 60000)
                sms_usage = random.randint(500, 5000)
                
                consumption_data.append({
                    "id": consumption_id_counter,
                    "entity_id": plan["entity_id"],
                    "plan_id": plan["id"],
                    "year_month": year_month,
                    "voice_minutes_used": voice_usage,
                    "sms_count": sms_usage,
                    "data_gb_used": round(data_usage, 2)
                })
                consumption_id_counter += 1

                # --- Billing Logic ---
                # Get rates and allowances for this plan
                p_rates = [r for r in rates_data if r["plan_id"] == plan["id"]]
                p_allows = [a for a in allowances_data if a["plan_id"] == plan["id"]]
                
                # Create Billing Cycle
                cycle_id = cycle_id_counter
                cycle_id_counter += 1
                
                plan_total_cost = 0.0
                
                # Process Data
                data_allowance = next((a["allowance_amount"] for a in p_allows if a["service_type"] == "data_domestic"), 0.0)
                data_rate = next((r for r in p_rates if r["service_type"] == "data_domestic"), None)
                
                if data_rate:
                    billable_data = 0.0
                    rate_applied = data_rate["rate_per_unit"]
                    cost = 0.0
                    
                    if data_usage > data_allowance:
                         # Simple logic: flat rate for payg or overage for pool
                         # If allowance > 0, it's a pool, charge overage on excess
                         # If allowance == 0, it's payg, charge base rate on all
                         if data_allowance > 0:
                             excess = data_usage - data_allowance
                             cost = excess * data_rate["overage_rate"]
                             billable_data = excess
                             rate_applied = data_rate["overage_rate"]
                         else:
                             cost = data_usage * data_rate["rate_per_unit"]
                             billable_data = data_usage
                    
                    billing_records_data.append({
                        "id": record_id_counter,
                        "entity_id": plan["entity_id"],
                        "plan_id": plan["id"],
                        "billing_cycle_id": cycle_id,
                        "year_month": year_month,
                        "service_type": "data_domestic",
                        "allowance_amount": data_allowance,
                        "usage_amount": round(data_usage, 2),
                        "billable_amount": round(billable_data, 2),
                        "rate_applied": rate_applied,
                        "line_item_amount": round(cost, 2)
                    })
                    record_id_counter += 1
                    plan_total_cost += cost

                # Process Voice (Simplified same logic)
                voice_allowance = next((a["allowance_amount"] for a in p_allows if a["service_type"] == "voice_domestic"), 0.0)
                voice_rate = next((r for r in p_rates if r["service_type"] == "voice_domestic"), None)
                
                if voice_rate:
                    cost = voice_usage * voice_rate["rate_per_unit"] # Charging all for simplicity in this mock
                    billing_records_data.append({
                        "id": record_id_counter,
                         "entity_id": plan["entity_id"],
                        "plan_id": plan["id"],
                        "billing_cycle_id": cycle_id,
                        "year_month": year_month,
                        "service_type": "voice_domestic",
                        "allowance_amount": voice_allowance,
                        "usage_amount": voice_usage,
                        "billable_amount": voice_usage,
                        "rate_applied": voice_rate["rate_per_unit"],
                        "line_item_amount": round(cost, 2)
                    })
                    record_id_counter += 1
                    plan_total_cost += cost

                # Save Cycle
                billing_cycles_data.append({
                    "id": cycle_id,
                    "entity_id": plan["entity_id"],
                    "cycle_start_date": cycle_start,
                    "cycle_end_date": cycle_end,
                    "billing_period": year_month,
                    "status": "Closed",
                    "total_amount": round(plan_total_cost, 2)
                })

            # Summaries per Entity per Month
            for entity in entities:
                entity_plans = [p["id"] for p in plans_data if p["entity_id"] == entity["id"]]
                entity_records = [r for r in billing_records_data if r["plan_id"] in entity_plans and r["year_month"] == year_month]
                
                total_cost = sum(r["line_item_amount"] for r in entity_records)
                
                billing_summary_data.append({
                    "id": summary_id_counter,
                    "entity_id": entity["id"],
                    "year_month": year_month,
                    "total_base_cost": round(total_cost * 0.9, 2), # Mock split
                    "total_overage_cost": round(total_cost * 0.1, 2),
                    "grand_total": round(total_cost, 2),
                    "invoice_status": "Paid"
                })
                summary_id_counter += 1

        consumption_df = pd.DataFrame(consumption_data)
        cycles_df = pd.DataFrame(billing_cycles_data)
        records_df = pd.DataFrame(billing_records_data)
        summary_df = pd.DataFrame(billing_summary_data)

        
        # --- 2. Retail Data Generation (CDR, Billing, etc) ---
        cdr_records = []
        billing_records = []
        account_info_records = []
        rate_plan_info = [] # Retail Rate Plans
        dashboard_metrics_data = [] # Retail Analytics
        performance_analytics_data = [] # Retail Analytics

        # Rate Plans (Retail)
        for bundle_type, fees in bundle_fees.items():
            rate_plan_info.append({
                "rate_plan": bundle_type,
                "bundle_allowance": rate_plans[bundle_type],
                "bundle_fee": fees,
                "home_rate": home_rate,
                "row_rate": row_rate_edited,
            })
        rate_plan_df = pd.DataFrame(rate_plan_info)

        # Generate Retail Records
        sim_ids = set(["2545" + str(random.randint(10**10, 10**11 - 1)) for _ in range(500)])
        
        for sim_id in sim_ids:
            account = random.choice(accounts)
            rate_plan = random.choice(list(rate_plans.keys()))
            plan_limit = rate_plans[rate_plan]
            bundle_fee = bundle_fees[rate_plan]
            
            # LINK TO NEW WHOLESALE PLAN: Pick a random ID from plans_data
            wholesale_plan_id = random.choice(plans_data)["id"]

            records_count = random.randint(10, 30)
            monthly_usage = defaultdict(int)

            for _ in range(records_count):
                ts = datetime.datetime.now() - datetime.timedelta(days=random.randint(0, 90))
                usage = random.randint(10, 500)
                year_month = (ts.year, ts.month)
                monthly_usage[year_month] += usage
                
                cdr_records.append({
                    "sim_id": sim_id,
                    "data_usage": usage,
                    "network": random.choice(networks),
                    "timestamp": ts,
                    "country": random.choice(countries)
                })

            for (year, month), usage in monthly_usage.items():
                billing_cycle = f"{year}-{month:02d}"
                usage_from_plan = min(usage, plan_limit)
                usage_out = max(0, usage - plan_limit)
                bill = bundle_fee + (usage_out * 0.01) # Simple mock calculation

                billing_records.append({
                    "sim_id": sim_id,
                    "account_name": account,
                    "rate_plan": rate_plan,
                    "total_usage": usage,
                    "usage_from_plan": usage_from_plan,
                    "bundle_allowance": plan_limit,
                    "bundle_fee": bundle_fee,
                    "usage_out_of_bundle": usage_out,
                    "charges_out_of_bundle": usage_out * 0.01,
                    "total_bill": round(bill, 2),
                    "billing_cycle": billing_cycle,
                    "wholesale_plan_id": wholesale_plan_id
                })

                if month == current_month and year == current_year:
                    account_info_records.append({
                         "account_name": account,
                        "sim_id": sim_id,
                        "rate_plan": rate_plan,
                        "billing_cycle": billing_cycle
                    })

        # --- Analytics Mock Data (simplified for brevity) ---
        for i in range(6):
            date = datetime.date.today().replace(day=1) - datetime.timedelta(days=30 * i)
            bc = date.strftime("%Y-%m")
            dashboard_metrics_data.append({
                "billing_cycle": bc,
                "metric_date": date,
                "total_revenue": random.uniform(50000, 100000),
                "gross_profit": random.uniform(20000, 40000),
                "net_profit": random.uniform(5000, 15000),
                "total_opex": random.uniform(10000, 20000),
                "total_cogs": random.uniform(15000, 30000),
                "active_accounts": random.randint(100, 200),
                "active_sims": random.randint(1000, 5000),
                "new_accounts": random.randint(5, 20),
                "lost_accounts": random.randint(1, 10),
                "total_usage_gb": random.uniform(5000, 15000),
                "avg_cogs_per_account": random.uniform(100, 300),
                "avg_opex_per_account": random.uniform(50, 150),
                "accounts_receivable": random.uniform(5000, 20000)
            })
            
            # Performance Analytics
            for account in random.sample(accounts, 5):
                 performance_analytics_data.append({
                    "billing_cycle": bc,
                    "metric_date": date,
                    "account_name": account,
                    "account_segment": "SMB",
                    "payment_performance_score": random.uniform(70, 99),
                    "churn_risk_score": random.uniform(1, 20),
                    "dispute_resolution_days": random.uniform(1, 10),
                    "avg_revenue_per_sim": random.uniform(5, 20),
                    "total_revenue": random.uniform(1000, 5000),
                    "profitability_score": random.randint(50, 100),
                    "credit_utilization_percent": random.uniform(10, 80),
                    "discount_usage_percent": random.uniform(0, 30),
                    "avg_discount_rate": random.uniform(0, 10),
                    "discount_sensitivity": "Medium",
                    "optimal_discount_rate": random.uniform(5, 15),
                    "q3_forecast": random.uniform(1500, 6000),
                    "q4_forecast": random.uniform(1600, 6500),
                    "yoy_growth_forecast": random.uniform(5, 25),
                    "forecast_confidence_level": random.uniform(80, 99),
                    "total_sims": random.randint(50, 500),
                    "total_usage_mb": random.randint(10000, 500000)
                })

        return (
            entities_df, plans_df, rates_df, allowances_df,
            consumption_df, cycles_df, records_df, summary_df,
            rate_plan_df, pd.DataFrame(cdr_records), pd.DataFrame(billing_records),
            pd.DataFrame(account_info_records), pd.DataFrame(dashboard_metrics_data), 
            pd.DataFrame(performance_analytics_data)
        )

    except Exception as e:
        logger.error(f"Error generating mock data: {e}")
        raise


def insert_mock_data():
    """Insert data into all tables."""
    try:
        logger.info("Starting data insertion process...")
        create_tables()

        (
            entities, plans, rates, allowances,
            consumption, cycles, billing_recs, billing_sum,
            retail_rates, cdrs, retail_bills, acc_infos,
            dash_metrics, perf_analytics
        ) = generate_mock_data()

        with engine.connect() as connection:
            with connection.begin():
                logger.info("Inserting Wholesale Data...")
                entities.to_sql("wholesale_entities", connection, if_exists="append", index=False)
                plans.to_sql("wholesale_plans", connection, if_exists="append", index=False)
                rates.to_sql("service_rates", connection, if_exists="append", index=False)
                allowances.to_sql("plan_allowances", connection, if_exists="append", index=False)
                consumption.to_sql("monthly_consumption", connection, if_exists="append", index=False)
                cycles.to_sql("wholesale_billing_cycles", connection, if_exists="append", index=False)
                billing_recs.to_sql("wholesale_billing_records", connection, if_exists="append", index=False)
                billing_sum.to_sql("wholesale_billing_summary", connection, if_exists="append", index=False)
                
                logger.info("Inserting Retail Data...")
                retail_rates.to_sql("rate_plan", connection, if_exists="append", index=False)
                cdrs.to_sql("cdr_data", connection, if_exists="append", index=False, chunksize=5000)
                retail_bills.to_sql("billing_data", connection, if_exists="append", index=False, chunksize=5000)
                acc_infos.to_sql("account_info", connection, if_exists="append", index=False, chunksize=5000)
                
                logger.info("Inserting Analytics Data...")
                dash_metrics.to_sql("dashboard_metrics", connection, if_exists="append", index=False)
                perf_analytics.to_sql("performance_analytics", connection, if_exists="append", index=False)

        logger.info("All data inserted successfully!")

    except Exception as e:
        logger.error(f"Error inserting data: {e}")
        raise

if __name__ == "__main__":
    insert_mock_data()
