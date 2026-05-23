import asyncio

from fastapi.testclient import TestClient

from app.main import create_app
from app.models.strategy import StrategyWorkerScheduleRequest
from app.services.strategy_engine.scheduler import StrategyWorkerScheduler
from tests.test_strategy_worker import _request


def _unused_session_factory():
    raise AssertionError("persist=false should not open a database session")


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
