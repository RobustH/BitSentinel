import asyncio

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.main import create_app
from app.models.strategy import (
    StrategyInstanceCreateRequest,
    StrategyKlineInput,
    StrategyWorkerScheduleRequest,
)
from app.services.strategy_engine.repository import StrategyPersistenceRepository
from app.services.strategy_engine.scheduler import StrategyWorkerScheduler
from tests.test_strategy_worker import _bullish_series, _request


def _unused_session_factory():
    raise AssertionError("persist=false should not open a database session")


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _seed_strategy_instances(session: Session) -> None:
    repository = StrategyPersistenceRepository(session)
    repository.create_strategy_instance(
        StrategyInstanceCreateRequest(
            id="enabled-strategy",
            name="启用策略",
            symbols=["BTCUSDT"],
            enabled=True,
            signal_ids_by_slot={"trigger_tf": ["ema-cross-up"]},
        )
    )
    repository.create_strategy_instance(
        StrategyInstanceCreateRequest(
            id="disabled-strategy",
            name="停用策略",
            symbols=["ETHUSDT"],
            enabled=False,
            signal_ids_by_slot={"trigger_tf": ["ema-cross-up"]},
        )
    )
    session.commit()


class FakeMarketDataSource:
    def __init__(
        self,
        market_series: dict[str, list[StrategyKlineInput]] | None = None,
        warnings: list[str] | None = None,
    ) -> None:
        self.market_series = market_series or {}
        self.warnings = warnings or []
        self.calls: list[tuple[list[str], str, int]] = []

    async def fetch_market_series(
        self,
        symbols: list[str],
        *,
        interval: str,
        limit: int,
    ) -> tuple[dict[str, list[StrategyKlineInput]], list[str]]:
        self.calls.append((symbols, interval, limit))
        return self.market_series, self.warnings


def test_strategy_worker_scheduler_runs_and_stops_without_persistence() -> None:
    async def run_case() -> None:
        scheduler = StrategyWorkerScheduler()

        status = await scheduler.start(
            StrategyWorkerScheduleRequest(
                worker_request=_request(),
                interval_seconds=5,
                persist=False,
            ),
            session_factory=_unused_session_factory,
        )
        await asyncio.sleep(0)

        running_status = scheduler.status()
        stopped_status = await scheduler.stop()

        assert status.running is True
        assert running_status.run_count == 1
        assert running_status.last_run_id is not None
        assert running_status.last_error is None
        assert stopped_status.running is False
        assert stopped_status.next_run_at is None

    asyncio.run(run_case())


def test_strategy_worker_scheduler_can_read_strategy_instances_from_database() -> None:
    async def run_case() -> None:
        market_data_source = FakeMarketDataSource({"BTCUSDT": _bullish_series()})
        scheduler = StrategyWorkerScheduler(market_data_source=market_data_source)
        factory = _session_factory()
        with factory() as session:
            _seed_strategy_instances(session)

        status = await scheduler.start(
            StrategyWorkerScheduleRequest(
                config_source="database",
                interval_seconds=5,
                persist=True,
            ),
            session_factory=factory,
        )
        await asyncio.sleep(0)
        running_status = scheduler.status()
        await scheduler.stop()

        with factory() as session:
            states = StrategyPersistenceRepository(session).list_states()

        assert status.running is True
        assert running_status.run_count == 1
        assert running_status.last_error is None
        assert [state.strategy_instance_id for state in states] == ["enabled-strategy"]
        assert market_data_source.calls == [(["BTCUSDT"], "1h", 80)]

    asyncio.run(run_case())


def test_strategy_worker_scheduler_keeps_running_when_market_source_warns() -> None:
    async def run_case() -> None:
        market_data_source = FakeMarketDataSource(
            {"BTCUSDT": []},
            warnings=["BTCUSDT kline request failed: ConnectError"],
        )
        scheduler = StrategyWorkerScheduler(market_data_source=market_data_source)
        factory = _session_factory()
        with factory() as session:
            _seed_strategy_instances(session)

        await scheduler.start(
            StrategyWorkerScheduleRequest(
                config_source="database",
                interval_seconds=5,
                persist=True,
            ),
            session_factory=factory,
        )
        await asyncio.sleep(0)
        running_status = scheduler.status()
        await scheduler.stop()

        assert running_status.run_count == 1
        assert running_status.last_run_id is not None
        assert running_status.last_error == "BTCUSDT kline request failed: ConnectError"

    asyncio.run(run_case())


def test_strategy_worker_scheduler_api_start_status_stop() -> None:
    client = TestClient(create_app())

    start_response = client.post(
        "/api/strategy/worker/scheduler/start",
        json={
            "worker_request": _request().model_dump(),
            "interval_seconds": 5,
            "persist": False,
        },
    )
    status_response = client.get("/api/strategy/worker/scheduler/status")
    stop_response = client.post("/api/strategy/worker/scheduler/stop")

    assert start_response.status_code == 200
    assert start_response.json()["running"] is True
    assert status_response.status_code == 200
    assert status_response.json()["running"] is True
    assert status_response.json()["interval_seconds"] == 5
    assert stop_response.status_code == 200
    assert stop_response.json()["running"] is False


def test_strategy_worker_scheduler_api_can_start_with_database_config(
    monkeypatch,
) -> None:
    factory = _session_factory()
    with factory() as session:
        _seed_strategy_instances(session)

    monkeypatch.setattr("app.api.strategy.SessionLocal", factory)
    monkeypatch.setattr(
        "app.services.strategy_engine.scheduler.strategy_worker_scheduler._market_data_source",
        FakeMarketDataSource({"BTCUSDT": _bullish_series()}),
    )
    client = TestClient(create_app())

    start_response = client.post(
        "/api/strategy/worker/scheduler/start",
        json={
            "config_source": "database",
            "interval_seconds": 5,
            "persist": True,
        },
    )
    stop_response = client.post("/api/strategy/worker/scheduler/stop")

    assert start_response.status_code == 200
    assert start_response.json()["running"] is True
    assert stop_response.status_code == 200


def test_strategy_worker_scheduler_api_requires_worker_request_for_request_source() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/strategy/worker/scheduler/start",
        json={
            "config_source": "request",
            "interval_seconds": 5,
            "persist": False,
        },
    )

    assert response.status_code == 422


def test_strategy_worker_scheduler_api_validates_interval() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/strategy/worker/scheduler/start",
        json={
            "worker_request": _request().model_dump(),
            "interval_seconds": 1,
            "persist": False,
        },
    )

    assert response.status_code == 422
