from dataclasses import dataclass

from sqlalchemy import inspect, text
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
    ensure_managed_columns(engine)

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
        inspector = inspect(engine)
        existing_tables = sorted(set(inspector.get_table_names()).intersection(managed_tables))
        missing_columns = _missing_managed_columns(inspector, existing_tables)
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
    missing_items = [*missing_tables, *missing_columns]
    return DatabaseSchemaStatusResult(
        ready=not missing_items,
        message=(
            "Database schema is ready"
            if not missing_items
            else "Database schema is missing managed tables or columns"
        ),
        target=target,
        managed_tables=managed_tables,
        existing_tables=existing_tables,
        missing_tables=missing_items,
    )


def ensure_managed_columns(engine: Engine) -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    if "strategy_instances" not in existing_tables:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("strategy_instances")}
    missing_columns = [
        column
        for column in _strategy_instance_column_definitions()
        if column[0] not in existing_columns
    ]
    if not missing_columns:
        return

    with engine.begin() as connection:
        for name, definition in missing_columns:
            connection.execute(
                text(f"ALTER TABLE strategy_instances ADD COLUMN {name} {definition}")
            )


def _missing_managed_columns(inspector, existing_tables: list[str]) -> list[str]:
    if "strategy_instances" not in existing_tables:
        return []

    existing_columns = {column["name"] for column in inspector.get_columns("strategy_instances")}
    return [
        f"strategy_instances.{name}"
        for name, _definition in _strategy_instance_column_definitions()
        if name not in existing_columns
    ]


def _strategy_instance_column_definitions() -> list[tuple[str, str]]:
    return [
        ("template_id", "VARCHAR(128) NOT NULL DEFAULT 'backend-strategy'"),
        ("slot_template_id", "VARCHAR(128) NOT NULL DEFAULT 'backend-strategy'"),
        ("version", "INTEGER NOT NULL DEFAULT 1"),
        ("version_history_json", "TEXT NOT NULL DEFAULT '[]'"),
        ("slots_json", "TEXT NOT NULL DEFAULT '{}'"),
    ]
