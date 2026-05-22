from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings

settings = get_settings()


def get_database_connect_args(settings: Settings) -> dict[str, int]:
    connect_args = {}
    if settings.database_url.startswith("postgresql+psycopg"):
        connect_args["connect_timeout"] = settings.database_connect_timeout_seconds
    return connect_args


def create_database_engine(settings: Settings) -> Engine:
    return create_engine(
        settings.database_url,
        pool_pre_ping=True,
        connect_args=get_database_connect_args(settings),
    )


engine = create_database_engine(settings)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_database_engine() -> Engine:
    return engine


def get_db_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
