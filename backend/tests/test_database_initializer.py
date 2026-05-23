import json
import subprocess
import sys
from datetime import datetime

from sqlalchemy import Column, DateTime, MetaData, String, Table, create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool

from app.services.database.initializer import initialize_database, managed_table_names


def _sqlite_engine() -> Engine:
    return create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def test_managed_table_names_include_strategy_persistence_tables() -> None:
    assert managed_table_names() == [
        "strategy_instances",
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]


def test_initialize_database_creates_strategy_tables_once() -> None:
    engine = _sqlite_engine()

    first = initialize_database(engine, "sqlite+pysqlite:///:memory:")
    second = initialize_database(engine, "sqlite+pysqlite:///:memory:")

    assert first.created_tables == [
        "strategy_instances",
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]
    assert first.existing_tables == [
        "strategy_instances",
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]
    assert second.created_tables == []
    assert second.existing_tables == [
        "strategy_instances",
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]
    assert set(inspect(engine).get_table_names()) == {
        "strategy_instances",
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    }


def test_initialize_database_adds_missing_strategy_instance_columns() -> None:
    engine = _sqlite_engine()
    metadata = MetaData()
    Table(
        "strategy_instances",
        metadata,
        Column("id", String(128), primary_key=True),
        Column("name", String(160), nullable=False),
        Column("symbols_json", String, nullable=False, default="[]"),
        Column("enabled", String, nullable=False, default="1"),
        Column("condition_ids_json", String, nullable=False, default="[]"),
        Column("risk_signal_ids_json", String, nullable=False, default="[]"),
        Column("signal_ids_by_slot_json", String, nullable=False, default="{}"),
        Column("created_at", DateTime(timezone=True), nullable=False),
        Column("updated_at", DateTime(timezone=True), nullable=False),
    )
    metadata.create_all(bind=engine)

    initialize_database(engine, "sqlite+pysqlite:///:memory:")

    columns = {column["name"] for column in inspect(engine).get_columns("strategy_instances")}
    assert {
        "template_id",
        "slot_template_id",
        "version",
        "version_history_json",
        "slots_json",
    }.issubset(columns)


def test_initialize_database_preserves_existing_strategy_instance_rows_on_column_add() -> None:
    engine = _sqlite_engine()
    metadata = MetaData()
    old_table = Table(
        "strategy_instances",
        metadata,
        Column("id", String(128), primary_key=True),
        Column("name", String(160), nullable=False),
        Column("symbols_json", String, nullable=False, default="[]"),
        Column("enabled", String, nullable=False, default="1"),
        Column("condition_ids_json", String, nullable=False, default="[]"),
        Column("risk_signal_ids_json", String, nullable=False, default="[]"),
        Column("signal_ids_by_slot_json", String, nullable=False, default="{}"),
        Column("created_at", DateTime(timezone=True), nullable=False),
        Column("updated_at", DateTime(timezone=True), nullable=False),
    )
    metadata.create_all(bind=engine)
    now = datetime.now().astimezone()
    with engine.begin() as connection:
        connection.execute(
            old_table.insert().values(
                id="old-strategy",
                name="旧策略",
                symbols_json='["BTCUSDT"]',
                enabled="1",
                condition_ids_json="[]",
                risk_signal_ids_json="[]",
                signal_ids_by_slot_json="{}",
                created_at=now,
                updated_at=now,
            )
        )

    initialize_database(engine, "sqlite+pysqlite:///:memory:")

    with engine.connect() as connection:
        record = connection.execute(
            text(
                "SELECT name, template_id, version "
                "FROM strategy_instances WHERE id = 'old-strategy'"
            )
        ).mappings().one()

    assert record["name"] == "旧策略"
    assert record["template_id"] == "backend-strategy"
    assert record["version"] == 1


def test_init_db_script_outputs_json_without_credentials(monkeypatch) -> None:
    monkeypatch.setenv("BITSENTINEL_DATABASE_URL", "sqlite+pysqlite:///:memory:")

    completed = subprocess.run(
        [sys.executable, "-m", "app.scripts.init_db"],
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0
    payload = json.loads(completed.stdout)
    assert payload["ok"] is True
    assert payload["target"]["driver"] == "sqlite+pysqlite"
    assert payload["managed_tables"] == [
        "strategy_instances",
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]
    assert "password" not in completed.stdout.lower()
