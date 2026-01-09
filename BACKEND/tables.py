from sqlalchemy import create_engine, text
import pandas as pd
import random
import datetime
import logging
from sqlalchemy.exc import SQLAlchemyError
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# PostgreSQL connection
DB_URI = "postgresql://postgres:postgres@localhost:5432/ai_module_db"

try:
    engine = create_engine(DB_URI, echo=False, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    logger.info("Database connection established successfully!")
except Exception as e:
    logger.error(f"Failed to connect to database: {e}")
    sys.exit(1)


def create_analytics_tables_only():
    """Create only the 2 new analytics tables - don't touch existing tables"""
    try:
        with engine.connect() as conn:
            logger.info("Creating analytics tables only...")

            # Drop only the 2 analytics tables if they exist
            conn.execute(text("DROP TABLE IF EXISTS performance_analytics CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS dashboard_metrics CASCADE"))
            logger.info("Dropped existing analytics tables")

            # Create dashboard_metrics table (from yesterday's correct schema)
            conn.execute(
                text(
                    """
                CREATE TABLE dashboard_metrics (
                    id SERIAL PRIMARY KEY,
                    billing_cycle VARCHAR(7),
                    metric_date DATE,
                    total_revenue DECIMAL(15,2),
                    gross_profit DECIMAL(15,2),
                    net_profit DECIMAL(15,2),
                    total_opex DECIMAL(15,2),
                    total_cogs DECIMAL(15,2),
                    active_accounts INTEGER,
                    active_sims INTEGER,
                    new_accounts INTEGER,   
                    lost_accounts INTEGER,
                    total_usage_gb DECIMAL(15,2),
                    avg_cogs_per_account DECIMAL(10,2),   
                    avg_opex_per_account DECIMAL(10,2),
                    accounts_receivable DECIMAL(15,2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """
                )
            )
            logger.info("✓ Created dashboard_metrics table")

            # Create performance_analytics table (from yesterday's correct schema)
            conn.execute(
                text(
                    """
                CREATE TABLE performance_analytics (
                    id SERIAL PRIMARY KEY,
                    billing_cycle VARCHAR(7),
                    metric_date DATE,
                    account_name VARCHAR(255),
                    account_segment VARCHAR(50),
                    payment_performance_score DECIMAL(5,2),
                    churn_risk_score DECIMAL(5,2),
                    dispute_resolution_days DECIMAL(4,2),
                    avg_revenue_per_sim DECIMAL(10,2),
                    total_revenue DECIMAL(15,2),
                    profitability_score INTEGER,
                    credit_utilization_percent DECIMAL(5,2),
                    discount_usage_percent DECIMAL(5,2),
                    avg_discount_rate DECIMAL(5,2),
                    discount_sensitivity VARCHAR(20),
                    optimal_discount_rate DECIMAL(5,2),
                    q3_forecast DECIMAL(15,2),
                    q4_forecast DECIMAL(15,2),
                    yoy_growth_forecast DECIMAL(5,2),
                    forecast_confidence_level DECIMAL(5,2),
                    total_sims INTEGER,
                    total_usage_mb INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT unique_account_billing_cycle UNIQUE (account_name, billing_cycle)
                )
            """
                )
            )
            logger.info("✓ Created performance_analytics table")

            conn.commit()
            logger.info("Analytics tables created successfully!")

    except SQLAlchemyError as e:
        logger.error(f"Database error creating analytics tables: {e}")
        raise


def generate_analytics_data_only():
    """Generate fake data ONLY for the 2 analytics tables"""
    logger.info("Generating analytics data...")

    dashboard_metrics_data = []
    performance_analytics_data = []

    # Account names to use (get from your existing accounts or use these)
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
        "Amazon",
        "Starbucks",
        "Microsoft",
    ]

    # Generate dashboard metrics for last 8 months
    for i in range(8):
        date = datetime.date.today().replace(day=1) - datetime.timedelta(days=30 * i)
        billing_cycle = date.strftime("%Y-%m")

        # Realistic financial metrics
        base_accounts = 220
        active_accounts = base_accounts + random.randint(-15, 25) + (8 - i) * 3
        active_sims = active_accounts * random.randint(12, 28)
        new_accounts = random.randint(10, 35)
        lost_accounts = random.randint(3, 18)
        total_usage_gb = round(active_sims * random.uniform(1.8, 3.5), 2)

        # Revenue with seasonal patterns
        base_revenue = active_accounts * random.uniform(2200, 4200)
        seasonal_factor = 1.15 if date.month in [11, 12] else random.uniform(0.96, 1.08)
        total_revenue = round(base_revenue * seasonal_factor, 2)

        # Cost structure
        total_cogs = round(total_revenue * random.uniform(0.38, 0.52), 2)
        total_opex = round(total_revenue * random.uniform(0.16, 0.29), 2)
        gross_profit = round(total_revenue - total_cogs, 2)
        net_profit = round(gross_profit - total_opex, 2)
        avg_cogs_per_account = round(total_cogs / active_accounts, 2)
        avg_opex_per_account = round(total_opex / active_accounts, 2)
        accounts_receivable = round(total_revenue * random.uniform(0.09, 0.27), 2)

        dashboard_metrics_data.append(
            {
                "billing_cycle": billing_cycle,
                "metric_date": date,
                "total_revenue": total_revenue,
                "gross_profit": gross_profit,
                "net_profit": net_profit,
                "total_opex": total_opex,
                "total_cogs": total_cogs,
                "active_accounts": active_accounts,
                "active_sims": active_sims,
                "new_accounts": new_accounts,
                "lost_accounts": lost_accounts,
                "total_usage_gb": total_usage_gb,
                "avg_cogs_per_account": avg_cogs_per_account,
                "avg_opex_per_account": avg_opex_per_account,
                "accounts_receivable": accounts_receivable,
            }
        )

    # Generate performance analytics for selected accounts over last 8 months
    selected_accounts = random.sample(accounts, min(25, len(accounts)))
    segment_weights = {
        "Enterprise": 0.18,
        "Mid-Market": 0.28,
        "SMB": 0.42,
        "Startup": 0.12,
    }

    for account in selected_accounts:
        for i in range(8):  # Last 8 months
            date = datetime.date.today().replace(day=1) - datetime.timedelta(
                days=30 * i
            )
            billing_cycle = date.strftime("%Y-%m")

            # Assign realistic segment
            segment = random.choices(
                list(segment_weights.keys()), weights=list(segment_weights.values())
            )[0]

            # Generate segment-based metrics
            if segment == "Enterprise":
                base_revenue = random.uniform(40000, 120000)
                payment_score = random.uniform(88, 99)
                churn_risk = random.uniform(1, 8)
                profitability = random.randint(82, 96)
                total_sims = random.randint(60, 350)
            elif segment == "Mid-Market":
                base_revenue = random.uniform(18000, 50000)
                payment_score = random.uniform(78, 94)
                churn_risk = random.uniform(4, 16)
                profitability = random.randint(68, 87)
                total_sims = random.randint(25, 120)
            elif segment == "SMB":
                base_revenue = random.uniform(2500, 22000)
                payment_score = random.uniform(62, 87)
                churn_risk = random.uniform(7, 28)
                profitability = random.randint(52, 78)
                total_sims = random.randint(4, 60)
            else:  # Startup
                base_revenue = random.uniform(400, 9000)
                payment_score = random.uniform(48, 78)
                churn_risk = random.uniform(12, 42)
                profitability = random.randint(35, 68)
                total_sims = random.randint(1, 30)

            # Add trend variations
            trend_factor = random.uniform(0.94, 1.07)
            base_revenue *= trend_factor

            performance_analytics_data.append(
                {
                    "billing_cycle": billing_cycle,
                    "metric_date": date,
                    "account_name": account,
                    "account_segment": segment,
                    "payment_performance_score": round(payment_score, 2),
                    "churn_risk_score": round(churn_risk, 2),
                    "dispute_resolution_days": round(random.uniform(0.8, 12.0), 2),
                    "avg_revenue_per_sim": round(base_revenue / total_sims, 2),
                    "total_revenue": round(base_revenue, 2),
                    "profitability_score": profitability,
                    "credit_utilization_percent": round(random.uniform(18, 92), 2),
                    "discount_usage_percent": round(random.uniform(8, 68), 2),
                    "avg_discount_rate": round(random.uniform(1.5, 22), 2),
                    "discount_sensitivity": random.choices(
                        ["High", "Medium", "Low"], weights=[0.32, 0.48, 0.20]
                    )[0],
                    "optimal_discount_rate": round(random.uniform(2.5, 16), 2),
                    "q3_forecast": round(base_revenue * random.uniform(1.01, 1.32), 2),
                    "q4_forecast": round(base_revenue * random.uniform(1.04, 1.42), 2),
                    "yoy_growth_forecast": round(random.uniform(-12, 45), 2),
                    "forecast_confidence_level": round(random.uniform(68, 99), 2),
                    "total_sims": total_sims,
                    "total_usage_mb": random.randint(4000, 180000),
                }
            )

    logger.info(f"Generated {len(dashboard_metrics_data)} dashboard metrics records")
    logger.info(
        f"Generated {len(performance_analytics_data)} performance analytics records"
    )

    return pd.DataFrame(dashboard_metrics_data), pd.DataFrame(
        performance_analytics_data
    )


def insert_analytics_data_only():
    """Insert data ONLY into the 2 analytics tables"""
    try:
        logger.info("Starting analytics data insertion...")

        # Create the 2 analytics tables
        create_analytics_tables_only()

        # Generate data for analytics tables only
        dashboard_data, performance_data = generate_analytics_data_only()

        with engine.connect() as connection:
            with connection.begin():
                # Insert analytics data
                logger.info("Inserting analytics data...")

                dashboard_data.to_sql(
                    "dashboard_metrics",
                    connection,
                    if_exists="append",
                    index=False,
                    chunksize=100,
                )
                logger.info(
                    f"✓ Inserted {len(dashboard_data)} dashboard metrics records"
                )

                performance_data.to_sql(
                    "performance_analytics",
                    connection,
                    if_exists="append",
                    index=False,
                    chunksize=200,
                )
                logger.info(
                    f"✓ Inserted {len(performance_data)} performance analytics records"
                )

                logger.info("Analytics data inserted successfully!")

    except SQLAlchemyError as e:
        logger.error(f"Database error during analytics insertion: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during analytics insertion: {e}")
        raise


def verify_analytics_tables():
    """Verify only the analytics tables"""
    try:
        with engine.connect() as conn:
            analytics_tables = ["dashboard_metrics", "performance_analytics"]

            logger.info("Verifying analytics tables...")
            for table in analytics_tables:
                result = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                logger.info(f"✓ {table}: {result:,} records")

    except Exception as e:
        logger.error(f"Error verifying analytics tables: {e}")


if __name__ == "__main__":
    try:
        logger.info(
            "Starting analytics tables setup (keeping existing 5 tables unchanged)..."
        )
        insert_analytics_data_only()
        verify_analytics_tables()
        logger.info("Analytics setup completed successfully!")

    except KeyboardInterrupt:
        logger.info("Script interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Script failed: {e}")
        sys.exit(1)
