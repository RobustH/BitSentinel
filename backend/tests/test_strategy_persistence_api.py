from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db_session
from app.db.base import Base
from app.main import create_app
from tests.test_strategy_worker import _request


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    app = create_app()

    def override_db_session() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db_session] = override_db_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_worker_run_once_can_persist_events(client: TestClient) -> None:
    response = client.post(
        "/api/strategy/worker/run-once?persist=true",
        json=_request().model_dump(),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["persistence"] == {
        "upserted_state_count": 1,
        "inserted_signal_count": 1,
    }

    states_response = client.get("/api/strategy/states")
    signals_response = client.get("/api/strategy/signals")
    runs_response = client.get("/api/strategy/worker/runs")

    assert states_response.status_code == 200
    assert states_response.json()[0]["state"] == "triggered"
    assert signals_response.status_code == 200
    assert signals_response.json()[0]["strength"] == "strong"
    assert runs_response.status_code == 200
    assert runs_response.json()[0]["evaluated_count"] == payload["evaluated_count"]
    assert runs_response.json()[0]["upserted_state_count"] == 1


def test_worker_run_once_without_persist_does_not_write_events(client: TestClient) -> None:
    response = client.post(
        "/api/strategy/worker/run-once",
        json=_request().model_dump(),
    )

    assert response.status_code == 200
    assert response.json()["persistence"] is None
    assert client.get("/api/strategy/states").json() == []
    assert client.get("/api/strategy/signals").json() == []
    assert client.get("/api/strategy/worker/runs").json() == []


def test_strategy_persistence_queries_can_filter_by_instance_and_symbol(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/strategy/worker/run-once?persist=true",
        json=_request().model_dump(),
    )
    assert response.status_code == 200

    matching_states = client.get(
        "/api/strategy/states?instance_id=strategy-1&symbol=BTCUSDT"
    ).json()
    missing_states = client.get(
        "/api/strategy/states?instance_id=other&symbol=BTCUSDT"
    ).json()
    matching_signals = client.get(
        "/api/strategy/signals?instance_id=strategy-1&symbol=BTCUSDT"
    ).json()

    assert len(matching_states) == 1
    assert missing_states == []
    assert len(matching_signals) == 1


def test_strategy_worker_run_history_limit(client: TestClient) -> None:
    first_response = client.post(
        "/api/strategy/worker/run-once?persist=true",
        json=_request().model_dump(),
    )
    second_response = client.post(
        "/api/strategy/worker/run-once?persist=true",
        json=_request().model_dump(),
    )
    assert first_response.status_code == 200
    assert second_response.status_code == 200

    runs = client.get("/api/strategy/worker/runs?limit=1").json()

    assert len(runs) == 1
    assert runs[0]["run_id"] == second_response.json()["run_id"]
