import asyncio
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.strategy import (
    StrategyPersistenceResult,
    StrategyWorkerScheduleRequest,
    StrategyWorkerSchedulerStatus,
)
from app.services.strategy_engine.evaluator import StrategyEvaluator
from app.services.strategy_engine.repository import StrategyPersistenceRepository
from app.services.strategy_engine.worker import StrategyWorker

SessionFactory = Callable[[], Session]


class StrategyWorkerScheduler:
    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()
        self._request: StrategyWorkerScheduleRequest | None = None
        self._status = StrategyWorkerSchedulerStatus(running=False)
        self._in_progress = False

    async def start(
        self,
        request: StrategyWorkerScheduleRequest,
        session_factory: SessionFactory,
    ) -> StrategyWorkerSchedulerStatus:
        async with self._lock:
            await self._stop_locked()
            now = _now_iso()
            self._request = request
            self._status = StrategyWorkerSchedulerStatus(
                running=True,
                interval_seconds=request.interval_seconds,
                persist=request.persist,
                last_started_at=now,
                next_run_at=now,
            )
            self._task = asyncio.create_task(self._run_loop(session_factory))
            return self.status()

    async def stop(self) -> StrategyWorkerSchedulerStatus:
        async with self._lock:
            await self._stop_locked()
            return self.status()

    def status(self) -> StrategyWorkerSchedulerStatus:
        return self._status.model_copy()

    async def _stop_locked(self) -> None:
        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        if self._status.running:
            self._status.running = False
            self._status.last_stopped_at = _now_iso()
            self._status.next_run_at = None
        self._task = None

    async def _run_loop(self, session_factory: SessionFactory) -> None:
        while self._status.running and self._request is not None:
            await self._execute_once(session_factory)
            if not self._status.running or self._request is None:
                break

            next_run_at = datetime.now(UTC) + timedelta(seconds=self._request.interval_seconds)
            self._status.next_run_at = next_run_at.isoformat()
            await asyncio.sleep(self._request.interval_seconds)

    async def _execute_once(self, session_factory: SessionFactory) -> None:
        if self._request is None:
            return
        if self._in_progress:
            self._status.skipped_count += 1
            return

        self._in_progress = True
        session: Session | None = None
        try:
            worker = StrategyWorker(StrategyEvaluator())
            response = worker.run_once(self._request.worker_request)

            if self._request.persist:
                session = session_factory()
                summary = StrategyPersistenceRepository(session).apply_worker_run(response)
                session.commit()
                response.persistence = StrategyPersistenceResult(
                    upserted_state_count=summary.upserted_state_count,
                    inserted_signal_count=summary.inserted_signal_count,
                )

            self._status.run_count += 1
            self._status.last_run_at = response.ran_at
            self._status.last_run_id = response.run_id
            self._status.last_error = None
        except Exception as exc:
            if session is not None:
                session.rollback()
            self._status.last_error = f"{type(exc).__name__}: {exc}"
        finally:
            if session is not None:
                session.close()
            self._in_progress = False


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


strategy_worker_scheduler = StrategyWorkerScheduler()
