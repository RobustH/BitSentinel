from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import StaticPool

from app.core.database import get_database_engine
from app.main import create_app
from app.services.database.connection import check_database_connection, describe_database_target


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


def test_database_test_endpoint_uses_configured_backend_connection() -> None:
    app = create_app()
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    def override_database_engine() -> Generator[object, None, None]:
        yield engine

    app.dependency_overrides[get_database_engine] = override_database_engine
    try:
        response = TestClient(app).get("/api/system/database/test")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["connected"] is True
    assert "password" not in str(payload).lower()
    assert "bitsentinel:bitsentinel" not in str(payload)
