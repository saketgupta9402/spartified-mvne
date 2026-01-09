import datetime
import random
import pandas as pd
from collections import defaultdict
from sqlalchemy import create_engine, text
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection (update with your credentials)
engine = create_engine("postgresql://postgres:postgres@localhost:5432/lucky_db")

# Define rate plan limits in MB for different data bundles
rate_plans = {
    "5GB Internet": 5120,
    "10GB Internet": 10240,
    "20GB Internet": 20480,
    "50GB Internet": 51200,
    "100GB Internet": 102400,
    "200GB Internet": 204800,
    "500GB Internet": 512000,
}

# Define bundle fees in currency units for each rate plan
bundle_fees = {
    "5GB Internet": 5,
    "10GB Internet": 10,
    "20GB Internet": 15,
    "50GB Internet": 25,
    "100GB Internet": 30,
    "200GB Internet": 50,
    "500GB Internet": 60,
}

# Define wholesale plans with allowance, type, fee, and out-of-bundle rates
wholesale_plans = {
    "Pool Plan A": {
        "allowance": 1000,
        "plan_type": "pool",
        "fee": 2.00,
        "oob_rate_home": 0.05,
        "oob_rate_roaming": 0.10,
    },
    "SIM Only B": {
        "allowance": 2000,
        "plan_type": "individual",
        "fee": 3.00,
        "oob_rate_home": 0.07,
        "oob_rate_roaming": 0.12,
    },
    "Pool Plan C": {
        "allowance": 5000,
        "plan_type": "pool",
        "fee": 5.00,
        "oob_rate_home": 0.06,
        "oob_rate_roaming": 0.11,
    },
}

# Business accounts and segments for the new dashboard
business_accounts = [
    {"name": "TechCorp Solutions", "segment": "Enterprise", "tier": "Premium"},
    {"name": "Global Manufacturing", "segment": "Enterprise", "tier": "Premium"},
    {"name": "StartupXYZ", "segment": "SMB", "tier": "Standard"},
    {"name": "RetailChain Inc", "segment": "Mid-Market", "tier": "Premium"},
    {"name": "Healthcare Plus", "segment": "Enterprise", "tier": "Standard"},
    {"name": "FinanceFirst", "segment": "Mid-Market", "tier": "Premium"},
    {"name": "LogisticsPro", "segment": "Enterprise", "tier": "Standard"},
    {"name": "EduTech Solutions", "segment": "SMB", "tier": "Standard"},
    {"name": "ManufacturingCorp", "segment": "Enterprise", "tier": "Premium"},
    {"name": "ServiceHub", "segment": "Mid-Market", "tier": "Standard"},
]

# Lists of networks, countries, and accounts for mock data generation
networks = [
    "Lebara",
    "Vodafone UK",
    "3UK",
    "EE",
    "Swiss Telecom",
    "W3",
    "CKH Austria",
    "US Cellular",
]
countries = [
    "USA",
    "UK",
    "Canada",
    "India",
    "Australia",
    "Brazil",
    "Italy",
    "Turkey",
    "Slovakia",
    "Germany",
]
accounts = [
    "Coca-Cola",
    "BMW",
    "Pepsi",
    "Mercedes",
    "Tesla",
    "Ford",
    "Fiat",
    "Land Rover",
    "Skoda",
    "British Gas",
    "ItalGas",
    "Zomato",
    "Uber",
    "Ola",
    "Tesco",
    "Sainsbury",
    "Waitrose",
    "Lidl",
    "Coop",
    "Southern Electric",
    "Octopus",
    "Vodafone Broadband",
    "Sky",
    "Lebara",
    "DigiTalk",
    "TalkMobile",
    "Amazon",
    "Starbucks",
]
home_country = "UK"
home_rate = 0.015
row_rate_edited = 0.09876

# Get the current year and month for billing cycle calculations
current_year = datetime.datetime.now().year
current_month = datetime.datetime.now().month


def create_tables():
    """Drop and create necessary tables with updated schema - preserving existing columns and adding new ones."""
    try:
        with engine.connect() as conn:
            # Drop existing tables to ensure a clean schema
            conn.execute(text("DROP TABLE IF EXISTS cdr_data CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS billing_data CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS account_info CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS rate_plan CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS wholesale_plan CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS dashboard_metrics CASCADE"))

            # Create CDR table (keeping original structure)
            conn.execute(
                text(
                    """
                CREATE TABLE cdr_data (
                    sim_id VARCHAR(255),
                    data_usage INT,
                    network VARCHAR(255),
                    timestamp TIMESTAMP,
                    country VARCHAR(255)
                )
            """
                )
            )

            # Create billing table (keeping original structure + adding new columns)
            conn.execute(
                text(
                    """
                CREATE TABLE billing_data (
                    sim_id VARCHAR(255),
                    account_name VARCHAR(255),
                    rate_plan VARCHAR(255),
                    total_usage INT,
                    usage_from_plan INT,
                    bundle_allowance INT,
                    bundle_fee NUMERIC(10, 2),
                    usage_out_of_bundle INT,
                    charges_out_of_bundle NUMERIC(10, 2),
                    total_bill NUMERIC(10, 2),
                    billing_cycle VARCHAR(7),
                    wholesale_plan VARCHAR(255),
                    -- New columns for dashboard
                    revenue NUMERIC(12, 2),
                    gross_profit NUMERIC(12, 2),
                    net_profit NUMERIC(12, 2),
                    opex NUMERIC(12, 2),
                    cogs NUMERIC(12, 2),
                    outstanding_amount NUMERIC(12, 2),
                    invoice_date DATE,
                    due_date DATE,
                    days_outstanding INT,
                    aging_bucket VARCHAR(50),
                    payment_status VARCHAR(50),
                    revenue_growth_rate NUMERIC(8, 4),
                    account_status VARCHAR(50),
                    customer_retention_score NUMERIC(5, 2),
                    segment VARCHAR(100),
                    tier VARCHAR(100),
                    record_date DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """
                )
            )

            # Create account info table (keeping original structure + adding new columns)
            conn.execute(
                text(
                    """
                CREATE TABLE account_info (
                    account_name VARCHAR(255),
                    sim_id VARCHAR(255),
                    rate_plan VARCHAR(255),
                    billing_cycle VARCHAR(7),
                    -- New columns for dashboard
                    segment VARCHAR(100),
                    tier VARCHAR(100),
                    account_manager VARCHAR(255),
                    contract_start_date DATE,
                    contract_end_date DATE,
                    is_active BOOLEAN DEFAULT TRUE,
                    monthly_active_sims INT,
                    avg_cogs_per_account NUMERIC(10, 2),
                    avg_opex_per_account NUMERIC(10, 2)
                )
            """
                )
            )

            # Keep existing rate plan table structure
            conn.execute(
                text(
                    """
                CREATE TABLE rate_plan (
                    rate_plan VARCHAR(255) PRIMARY KEY,
                    bundle_allowance INT,
                    bundle_fee NUMERIC(10, 2),
                    home_rate NUMERIC(10, 4),
                    row_rate NUMERIC(10, 4)
                )
            """
                )
            )

            # Keep existing wholesale plan table structure
            conn.execute(
                text(
                    """
                CREATE TABLE wholesale_plan (
                    wholesale_plan_name VARCHAR(255) PRIMARY KEY,
                    allowance INT,
                    plan_type VARCHAR(50),
                    fee NUMERIC(10, 2),
                    out_of_bundle_rate_home NUMERIC(10, 4),
                    out_of_bundle_rate_roaming NUMERIC(10, 4)
                )
            """
                )
            )

            # New table for dashboard summary metrics
            conn.execute(
                text(
                    """
                CREATE TABLE dashboard_metrics (
                    id SERIAL PRIMARY KEY,
                    metric_name VARCHAR(255),
                    metric_value NUMERIC(15, 2),
                    metric_change NUMERIC(8, 4),
                    metric_period VARCHAR(50),
                    record_date DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """
                )
            )

            conn.commit()
        logger.info("Tables created successfully!")
    except Exception as e:
        logger.error(f"Error creating tables: {e}")
        raise


def calculate_aging_bucket(days_outstanding):
    """Calculate aging bucket based on days outstanding."""
    if days_outstanding <= 30:
        return "Current (0-30 days)"
    elif days_outstanding <= 60:
        return "30-60 days"
    elif days_outstanding <= 90:
        return "60-90 days"
    else:
        return "90+ days"


def generate_financial_metrics(base_revenue):
    """Generate realistic financial metrics based on base revenue."""
    # Generate COGS (typically 40-60% of revenue)
    cogs = base_revenue * random.uniform(0.4, 0.6)
    gross_profit = base_revenue - cogs

    # Generate OPEX (typically 20-40% of revenue)
    opex = base_revenue * random.uniform(0.2, 0.4)
    net_profit = gross_profit - opex

    return {
        "cogs": round(cogs, 2),
        "gross_profit": round(gross_profit, 2),
        "opex": round(opex, 2),
        "net_profit": round(net_profit, 2),
    }


def generate_mock_data():
    """Generate mock data for CDR, billing, account, rate plans, and wholesale plans."""
    cdr_records = []
    billing_records = []
    account_info_records = []
    rate_plan_info = []
    wholesale_plan_info = []
    dashboard_metrics_records = []

    # Populate rate plan data with bundle details
    for bundle_type, fees in bundle_fees.items():
        rate_plan_info.append(
            {
                "rate_plan": bundle_type,
                "bundle_allowance": rate_plans[bundle_type],
                "bundle_fee": fees,
                "home_rate": home_rate,
                "row_rate": row_rate_edited,
            }
        )

    # Populate wholesale plan data
    for plan_name, details in wholesale_plans.items():
        wholesale_plan_info.append(
            {
                "wholesale_plan_name": plan_name,
                "allowance": details["allowance"],
                "plan_type": details["plan_type"],
                "fee": details["fee"],
                "out_of_bundle_rate_home": details["oob_rate_home"],
                "out_of_bundle_rate_roaming": details["oob_rate_roaming"],
            }
        )

    # Create extended account list combining business accounts with existing accounts
    all_accounts = []
    for biz_acc in business_accounts:
        all_accounts.append(biz_acc)
    for acc in accounts:
        all_accounts.append(
            {
                "name": acc,
                "segment": random.choice(["SMB", "Mid-Market", "Enterprise"]),
                "tier": random.choice(["Standard", "Premium"]),
            }
        )

    # Select top accounts for weighted random selection
    top_accounts = random.sample([acc["name"] for acc in all_accounts], 10)

    # Generate unique SIM IDs (up to 9500 for deployment)
    sim_ids = set(
        ["2545" + str(random.randint(10**10, 10**11 - 1)) for _ in range(9500)]
    )
    wholesale_plan_names = list(wholesale_plans.keys())
    account_managers = [
        "John Smith",
        "Sarah Johnson",
        "Mike Wilson",
        "Lisa Brown",
        "David Lee",
        "Emma Davis",
    ]

    # Track metrics for dashboard summary
    total_revenue = 0
    total_gross_profit = 0
    total_net_profit = 0
    total_opex = 0
    total_outstanding = 0
    active_accounts = set()
    account_cogs_sum = defaultdict(float)
    account_opex_sum = defaultdict(float)
    account_sim_count = defaultdict(int)

    # Generate data for each SIM
    for sim_id in sim_ids:
        # Select account with weighted preference for top accounts and business accounts
        account_data = random.choices(
            all_accounts,
            weights=[
                (
                    10
                    if acc["name"] in top_accounts
                    else 5 if acc in business_accounts else 1
                )
                for acc in all_accounts
            ],
        )[0]
        account_name = account_data["name"]
        segment = account_data["segment"]
        tier = account_data["tier"]

        network = random.choice(networks)
        country = random.choice(countries)
        rate_plan = random.choice(list(rate_plans.keys()))
        wholesale_plan = random.choice(wholesale_plan_names)
        plan_limit = rate_plans[rate_plan]
        bundle_fee = bundle_fees[rate_plan]

        # Generate contract dates
        contract_start = datetime.date.today() - datetime.timedelta(
            days=random.randint(30, 1095)
        )
        contract_end = contract_start + datetime.timedelta(
            days=random.randint(365, 1095)
        )

        num_records = random.randint(40, 60)
        monthly_usage = defaultdict(int)

        # Generate CDR records for the SIM
        for _ in range(num_records):
            days_ago = random.randint(0, 365)
            timestamp = datetime.datetime.now() - datetime.timedelta(
                days=days_ago,
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )
            data_usage = random.randint(1, 100)
            year_month = (timestamp.year, timestamp.month)
            monthly_usage[year_month] += data_usage

            cdr_records.append(
                {
                    "sim_id": sim_id,
                    "data_usage": data_usage,
                    "network": network,
                    "timestamp": timestamp,
                    "country": country,
                }
            )

        # Generate billing records for each month up to current month
        for (year, month), total_usage in monthly_usage.items():
            if (year < current_year) or (
                year == current_year and month <= current_month
            ):
                usage_from_plan = min(total_usage, plan_limit)
                usage_out_of_bundle = max(0, total_usage - usage_from_plan)
                charges_out_of_bundle = round(
                    usage_out_of_bundle
                    * (home_rate if country == home_country else row_rate_edited),
                    2,
                )
                total_bill = round(bundle_fee + charges_out_of_bundle, 2)
                billing_cycle = f"{year}-{month:02d}"

                # Generate enhanced financial metrics
                base_revenue = total_bill * random.uniform(1.5, 3.0)  # 50-200% markup
                financial_metrics = generate_financial_metrics(base_revenue)

                # Generate accounts receivable data
                invoice_date = datetime.date(year, month, random.randint(1, 28))
                due_date = invoice_date + datetime.timedelta(
                    days=random.choice([30, 45, 60])
                )
                days_outstanding = max(0, (datetime.date.today() - due_date).days)
                aging_bucket = calculate_aging_bucket(days_outstanding)

                # Outstanding amount (70% chance of payment)
                if random.random() < 0.7:
                    outstanding_amount = 0
                    payment_status = "Paid"
                else:
                    outstanding_amount = base_revenue * random.uniform(0.3, 1.0)
                    payment_status = "Outstanding"

                # Growth and status metrics
                revenue_growth_rate = random.uniform(-0.15, 0.35)
                account_status = random.choices(
                    ["Growing", "Stable", "Declining"], weights=[0.4, 0.4, 0.2]
                )[0]
                customer_retention_score = random.uniform(85, 99)

                record_date = datetime.date(year, month, 1)

                billing_records.append(
                    {
                        # Original columns
                        "sim_id": sim_id,
                        "account_name": account_name,
                        "rate_plan": rate_plan,
                        "total_usage": total_usage,
                        "usage_from_plan": usage_from_plan,
                        "bundle_allowance": plan_limit,
                        "bundle_fee": bundle_fee,
                        "usage_out_of_bundle": usage_out_of_bundle,
                        "charges_out_of_bundle": charges_out_of_bundle,
                        "total_bill": total_bill,
                        "billing_cycle": billing_cycle,
                        "wholesale_plan": wholesale_plan,
                        # New columns for dashboard
                        "revenue": round(base_revenue, 2),
                        "gross_profit": financial_metrics["gross_profit"],
                        "net_profit": financial_metrics["net_profit"],
                        "opex": financial_metrics["opex"],
                        "cogs": financial_metrics["cogs"],
                        "outstanding_amount": round(outstanding_amount, 2),
                        "invoice_date": invoice_date,
                        "due_date": due_date,
                        "days_outstanding": days_outstanding,
                        "aging_bucket": aging_bucket,
                        "payment_status": payment_status,
                        "revenue_growth_rate": round(revenue_growth_rate, 4),
                        "account_status": account_status,
                        "customer_retention_score": round(customer_retention_score, 2),
                        "segment": segment,
                        "tier": tier,
                        "record_date": record_date,
                    }
                )

                # Track metrics for dashboard summary
                if billing_cycle == f"{current_year}-{current_month:02d}":
                    total_revenue += base_revenue
                    total_gross_profit += financial_metrics["gross_profit"]
                    total_net_profit += financial_metrics["net_profit"]
                    total_opex += financial_metrics["opex"]
                    total_outstanding += outstanding_amount
                    active_accounts.add(account_name)
                    account_cogs_sum[account_name] += financial_metrics["cogs"]
                    account_opex_sum[account_name] += financial_metrics["opex"]
                    account_sim_count[account_name] += 1

        # Generate account info record (original structure + new columns)
        avg_cogs = account_cogs_sum[account_name] / max(
            account_sim_count[account_name], 1
        )
        avg_opex = account_opex_sum[account_name] / max(
            account_sim_count[account_name], 1
        )

        account_info_records.append(
            {
                # Original columns
                "account_name": account_name,
                "sim_id": sim_id,
                "rate_plan": rate_plan,
                "billing_cycle": f"{current_year}-{current_month:02d}",
                # New columns
                "segment": segment,
                "tier": tier,
                "account_manager": random.choice(account_managers),
                "contract_start_date": contract_start,
                "contract_end_date": contract_end,
                "is_active": True,
                "monthly_active_sims": account_sim_count[account_name],
                "avg_cogs_per_account": round(avg_cogs, 2),
                "avg_opex_per_account": round(avg_opex, 2),
            }
        )

    # Generate dashboard summary metrics
    current_date = datetime.date.today()
    dashboard_metrics_records.extend(
        [
            {
                "metric_name": "Total Revenue (YTD)",
                "metric_value": round(total_revenue, 2),
                "metric_change": 0.152,  # +15.2% vs last year
                "metric_period": "YTD",
                "record_date": current_date,
            },
            {
                "metric_name": "Gross Profit (YTD)",
                "metric_value": round(total_gross_profit, 2),
                "metric_change": 0.125,  # +12.5% vs last year
                "metric_period": "YTD",
                "record_date": current_date,
            },
            {
                "metric_name": "Net Profit (YTD)",
                "metric_value": round(total_net_profit, 2),
                "metric_change": 0.083,  # +8.3% vs last year
                "metric_period": "YTD",
                "record_date": current_date,
            },
            {
                "metric_name": "Total OPEX (YTD)",
                "metric_value": round(total_opex, 2),
                "metric_change": -0.031,  # -3.1% vs last year
                "metric_period": "YTD",
                "record_date": current_date,
            },
            {
                "metric_name": "Active Accounts",
                "metric_value": len(active_accounts),
                "metric_change": 0.042,  # +4.2% vs last month
                "metric_period": "Current",
                "record_date": current_date,
            },
            {
                "metric_name": "CoGS per Account (Avg)",
                "metric_value": round(
                    sum(account_cogs_sum.values()) / len(active_accounts), 2
                ),
                "metric_change": -0.028,  # -2.8% vs last month
                "metric_period": "Current",
                "record_date": current_date,
            },
            {
                "metric_name": "OPEX per Account (Avg)",
                "metric_value": round(
                    sum(account_opex_sum.values()) / len(active_accounts), 2
                ),
                "metric_change": 0.015,  # +1.5% vs last month
                "metric_period": "Current",
                "record_date": current_date,
            },
            {
                "metric_name": "Total Outstanding",
                "metric_value": round(total_outstanding, 2),
                "metric_change": 0.0,  # No change indicator
                "metric_period": "Current",
                "record_date": current_date,
            },
            {
                "metric_name": "Average Days to Payment",
                "metric_value": 28,
                "metric_change": 0.0,
                "metric_period": "Current",
                "record_date": current_date,
            },
        ]
    )

    return (
        pd.DataFrame(cdr_records),
        pd.DataFrame(billing_records),
        pd.DataFrame(account_info_records),
        pd.DataFrame(rate_plan_info),
        pd.DataFrame(wholesale_plan_info),
        pd.DataFrame(dashboard_metrics_records),
    )


def insert_mock_data():
    """Insert mock data into PostgreSQL tables."""
    try:
        create_tables()
        # Generate mock data for all tables
        (
            cdr_data,
            billing_data,
            account_data,
            rate_plan_data,
            wholesale_plan_data,
            dashboard_metrics_data,
        ) = generate_mock_data()

        with engine.connect() as connection:
            with connection.begin():
                # Insert data in chunks for efficiency
                cdr_data.to_sql(
                    "cdr_data",
                    connection,
                    if_exists="append",
                    index=False,
                    chunksize=10000,
                )
                logger.info(f"Inserted {len(cdr_data)} CDR records successfully!")

                billing_data.to_sql(
                    "billing_data",
                    connection,
                    if_exists="append",
                    index=False,
                    chunksize=50000,
                )
                logger.info(
                    f"Inserted {len(billing_data)} Billing records successfully!"
                )

                account_data.to_sql(
                    "account_info",
                    connection,
                    if_exists="append",
                    index=False,
                    chunksize=10000,
                )
                logger.info(
                    f"Inserted {len(account_data)} Account records successfully!"
                )

                rate_plan_data.to_sql(
                    "rate_plan",
                    connection,
                    if_exists="append",
                    index=False,
                    chunksize=10000,
                )
                logger.info(
                    f"Inserted {len(rate_plan_data)} Rate Plan records successfully!"
                )

                wholesale_plan_data.to_sql(
                    "wholesale_plan",
                    connection,
                    if_exists="append",
                    index=False,
                    chunksize=10000,
                )
                logger.info(
                    f"Inserted {len(wholesale_plan_data)} Wholesale Plan records successfully!"
                )

                dashboard_metrics_data.to_sql(
                    "dashboard_metrics",
                    connection,
                    if_exists="append",
                    index=False,
                    chunksize=1000,
                )
                logger.info(
                    f"Inserted {len(dashboard_metrics_data)} Dashboard Metrics records successfully!"
                )

    except Exception as e:
        logger.error(f"An error occurred: {e}")
        raise


if __name__ == "__main__":
    insert_mock_data()
