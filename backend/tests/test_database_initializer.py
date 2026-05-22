import json
import subprocess
import sys

from sqlalchemy import create_engine, inspect
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
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]


def test_initialize_database_creates_strategy_tables_once() -> None:
    engine = _sqlite_engine()

    first = initialize_database(engine, "sqlite+pysqlite:///:memory:")
    second = initialize_database(engine, "sqlite+pysqlite:///:memory:")

    assert first.created_tables == [
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]
    assert first.existing_tables == [
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]
    assert second.created_tables == []
    assert second.existing_tables == [
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]
    assert set(inspect(engine).get_table_names()) == {
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    }


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
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]
    assert "password" not in completed.stdout.lower()
