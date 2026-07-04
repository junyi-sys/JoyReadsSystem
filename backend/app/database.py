import logging
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, Session
from .config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """FastAPI dependency: yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def sync_schema():
    """
    Compare ORM models with actual DB schema, add any missing columns.
    Runs at every startup — safe, idempotent, no migration tool needed.
    """
    from .models.base import Base

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table_name, table in Base.metadata.tables.items():
        if table_name not in existing_tables:
            continue  # create_all handles new tables

        existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
        for col in table.columns:
            if col.name not in existing_cols:
                col_type = str(col.type.compile(engine.dialect))
                nullable = "NULL" if col.nullable else "NOT NULL"
                default_sql = ""
                if col.default:
                    default_sql = f" DEFAULT {col.default.arg}"
                if col.server_default:
                    from sqlalchemy import DefaultClause
                    if hasattr(col.server_default, 'arg'):
                        default_sql = f" DEFAULT {col.server_default.arg}"

                sql = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type} {nullable}{default_sql}"
                try:
                    with engine.connect() as conn:
                        conn.execute(text(sql))
                        conn.commit()
                    logger.warning(f"[sync_schema] Added {table_name}.{col.name} ({col_type})")
                except Exception as e:
                    logger.error(f"[sync_schema] Failed to add {table_name}.{col.name}: {e}")


def safe_commit(db: Session):
    """Commit with error logging — avoids silent failures under concurrency."""
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Database commit failed, rolled back")


def init_db():
    """Create all tables + sync missing columns. Called on app startup."""
    from .models.base import Base
    Base.metadata.create_all(bind=engine)
    sync_schema()
