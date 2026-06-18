"""Database engine + session for Pathly (PostgreSQL via SQLAlchemy)."""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from models import Base

# Set this in Azure App Service → Configuration → Application settings.
# Format (Azure Database for PostgreSQL Flexible Server):
#   postgresql+psycopg2://USER:PASSWORD@SERVER.postgres.database.azure.com:5432/DBNAME?sslmode=require
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to the App Service application settings."
    )

# pool_pre_ping recycles dead connections (Azure drops idle ones).
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=1800)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    """FastAPI dependency — yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create any tables that don't exist yet. Idempotent."""
    Base.metadata.create_all(bind=engine)