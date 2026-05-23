from dataclasses import dataclass

from sqlalchemy import inspect
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from app.db.base import Base
from app.models.system import DatabaseConnectionTarget, DatabaseSchemaStatusResult
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


def check_database_schema(engine: Engine, database_url: str) -> DatabaseSchemaStatusResult:
    target = describe_database_target(database_url)
    managed_tables = managed_table_names()
    try:
        existing_tables = sorted(
            set(inspect(engine).get_table_names()).intersection(managed_tables)
        )
    except SQLAlchemyError as error:
        return DatabaseSchemaStatusResult(
            ready=False,
            message=f"Database schema check failed: {type(error).__name__}",
            target=target,
            managed_tables=managed_tables,
            existing_tables=[],
            missing_tables=managed_tables,
        )

    missing_tables = sorted(set(managed_tables).difference(existing_tables))
    return DatabaseSchemaStatusResult(
        ready=not missing_tables,
        message=(
            "Database schema is ready"
            if not missing_tables
            else "Database schema is missing managed tables"
        ),
        target=target,
        managed_tables=managed_tables,
        existing_tables=existing_tables,
        missing_tables=missing_tables,
    )
