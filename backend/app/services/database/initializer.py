from dataclasses import dataclass

from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from app.db.base import Base
from app.models.system import DatabaseConnectionTarget
from app.services.database.connection import describe_database_target


@dataclass(frozen=True)
class DatabaseInitializationResult:
    target: DatabaseConnectionTarget
    managed_tables: list[str]
    existing_tables: list[str]
    created_tables: list[str]


def register_database_models() -> None:
    __import__("app.db.strategy")


def managed_table_names() -> list[str]:
    register_database_models()
    return sorted(Base.metadata.tables.keys())


def initialize_database(engine: Engine, database_url: str) -> DatabaseInitializationResult:
    target = describe_database_target(database_url)
    inspector = inspect(engine)
    existing_before = set(inspector.get_table_names())
    managed_tables = managed_table_names()

    Base.metadata.create_all(bind=engine, checkfirst=True)

    inspector.clear_cache()
    existing_after = set(inspector.get_table_names())
    return DatabaseInitializationResult(
        target=target,
        managed_tables=managed_tables,
        existing_tables=sorted(existing_after.intersection(managed_tables)),
        created_tables=sorted(existing_after.difference(existing_before).intersection(managed_tables)),
    )
