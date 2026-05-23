from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import StaticPool

from app.core.config import Settings, get_settings
from app.core.database import get_database_connect_args
from app.db.base import Base
from app.main import create_app
from app.services.database.connection import check_database_connection, describe_database_target
from app.services.database.initializer import check_database_schema


def test_describe_database_target_masks_credentials() -> None:
    target = describe_database_target(
        "postgresql+psycopg://bitsentinel:secret@localhost:5432/bitsentinel"
    )

    payload = target.model_dump()

    assert payload == {
        "driver": "postgresql+psycopg",
        "host": "localhost",
        "port": 5432,
        "database": "bitsentinel",
    }
    assert "secret" not in str(payload)


def test_database_connection_service_reports_success() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    result = check_database_connection(engine, "sqlite+pysqlite:///:memory:")

    assert result.connected is True
    assert result.message == "Database connection succeeded"
    assert result.target.driver == "sqlite+pysqlite"


def test_postgresql_connection_args_use_configured_timeout() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://bitsentinel:secret@localhost:5432/bitsentinel",
        database_connect_timeout_seconds=3,
    )

    assert get_database_connect_args(settings) == {"connect_timeout": 3}


class FailingEngine:
    def connect(self):
        raise OperationalError("SELECT 1", {}, RuntimeError("boom"))


def test_database_connection_service_reports_failure_without_leaking_url() -> None:
    result = check_database_connection(
        FailingEngine(),
        "postgresql+psycopg://bitsentinel:secret@localhost:5432/bitsentinel",
    )

    payload = result.model_dump()

    assert result.connected is False
    assert result.message == "Database connection failed: OperationalError"
    assert payload["target"]["host"] == "localhost"
    assert "secret" not in str(payload)


def test_database_schema_service_reports_missing_tables() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    result = check_database_schema(engine, "sqlite+pysqlite:///:memory:")

    assert result.ready is False
    assert result.existing_tables == []
    assert result.missing_tables == [
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]


def test_database_schema_service_reports_ready_tables() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)

    result = check_database_schema(engine, "sqlite+pysqlite:///:memory:")

    assert result.ready is True
    assert result.missing_tables == []
    assert result.existing_tables == [
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]


def test_database_test_endpoint_uses_configured_backend_connection(monkeypatch) -> None:
    monkeypatch.setenv("BITSENTINEL_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    get_settings.cache_clear()

    response = TestClient(create_app()).get("/api/system/database/test")

    assert response.status_code == 200
    payload = response.json()
    assert payload["connected"] is True
    assert payload["target"]["driver"] == "sqlite+pysqlite"
    assert "password" not in str(payload).lower()
    get_settings.cache_clear()


def test_database_test_endpoint_can_report_failure(monkeypatch) -> None:
    monkeypatch.setenv(
        "BITSENTINEL_DATABASE_URL",
        "postgresql+psycopg://postgres:secret@127.0.0.1:1/bitsentinel",
    )
    monkeypatch.setenv("BITSENTINEL_DATABASE_CONNECT_TIMEOUT_SECONDS", "1")
    get_settings.cache_clear()

    response = TestClient(create_app()).get("/api/system/database/test")

    assert response.status_code == 200
    payload = response.json()
    assert payload["connected"] is False
    assert payload["target"]["host"] == "127.0.0.1"
    assert "password" not in str(payload).lower()
    assert "secret" not in str(payload)
    get_settings.cache_clear()


def test_database_schema_endpoint_reports_missing_tables(monkeypatch) -> None:
    monkeypatch.setenv("BITSENTINEL_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    get_settings.cache_clear()

    response = TestClient(create_app()).get("/api/system/database/schema")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ready"] is False
    assert payload["existing_tables"] == []
    assert payload["missing_tables"] == [
        "strategy_signals",
        "strategy_states",
        "strategy_worker_runs",
    ]
    assert "password" not in str(payload).lower()
    get_settings.cache_clear()


def test_database_schema_endpoint_reports_ready_tables(monkeypatch) -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)

    def create_ready_engine(_settings):
        return engine

    monkeypatch.setenv("BITSENTINEL_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setattr("app.api.system.create_database_engine", create_ready_engine)
    get_settings.cache_clear()

    response = TestClient(create_app()).get("/api/system/database/schema")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ready"] is True
    assert payload["missing_tables"] == []
    get_settings.cache_clear()


def test_database_schema_endpoint_can_report_failure(monkeypatch) -> None:
    monkeypatch.setenv(
        "BITSENTINEL_DATABASE_URL",
        "postgresql+psycopg://postgres:secret@127.0.0.1:1/bitsentinel",
    )
    monkeypatch.setenv("BITSENTINEL_DATABASE_CONNECT_TIMEOUT_SECONDS", "1")
    get_settings.cache_clear()

    response = TestClient(create_app()).get("/api/system/database/schema")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ready"] is False
    assert payload["target"]["host"] == "127.0.0.1"
    assert "secret" not in str(payload)
    get_settings.cache_clear()
