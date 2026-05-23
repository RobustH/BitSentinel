import asyncio
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.strategy import (
    ExistingSignalInput,
    ExistingStrategyStateInput,
    PersistedStrategyInstance,
    PersistedStrategySignal,
    PersistedStrategyState,
    StrategyInstanceInput,
    StrategyPersistenceResult,
    StrategyWorkerRunRequest,
    StrategyWorkerScheduleRequest,
    StrategyWorkerSchedulerStatus,
)
from app.services.market_data.strategy_source import (
    BinanceStrategyMarketDataSource,
    StrategyMarketDataSource,
)
from app.services.strategy_engine.evaluator import StrategyEvaluator
from app.services.strategy_engine.repository import StrategyPersistenceRepository
from app.services.strategy_engine.worker import StrategyWorker

SessionFactory = Callable[[], Session]
SCHEDULER_KLINE_INTERVAL = "1h"
SCHEDULER_KLINE_LIMIT = 80


class StrategyWorkerScheduler:
    def __init__(self, market_data_source: StrategyMarketDataSource | None = None) -> None:
        self._task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()
        self._request: StrategyWorkerScheduleRequest | None = None
        self._status = StrategyWorkerSchedulerStatus(running=False)
        self._in_progress = False
        self._market_data_source = market_data_source or BinanceStrategyMarketDataSource()

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
            if self._request.config_source == "database":
                session = session_factory()
            request, warnings = await self._build_worker_request(session)
            response = worker.run_once(request)

            if self._request.persist:
                if session is None:
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
            self._status.last_error = "; ".join(warnings) if warnings else None
        except Exception as exc:
            if session is not None:
                session.rollback()
            self._status.last_error = f"{type(exc).__name__}: {exc}"
        finally:
            if session is not None:
                session.close()
            self._in_progress = False

    async def _build_worker_request(
        self,
        session: Session | None,
    ) -> tuple[StrategyWorkerRunRequest, list[str]]:
        if self._request is None:
            raise RuntimeError("Scheduler request is not configured")

        if self._request.config_source == "request":
            if self._request.worker_request is None:
                raise RuntimeError("worker_request is required for request config source")
            return self._request.worker_request, []

        if session is None:
            raise RuntimeError("Database config source requires a database session")

        repository = StrategyPersistenceRepository(session)
        strategy_instances = [
            _to_strategy_instance_input(instance)
            for instance in repository.list_strategy_instances()
            if instance.enabled
        ]
        states = [_to_existing_state_input(state) for state in repository.list_states()]
        signals = [_to_existing_signal_input(signal) for signal in repository.list_signals()]
        symbols = _collect_symbols(strategy_instances)
        market_series, warnings = await self._market_data_source.fetch_market_series(
            symbols,
            interval=SCHEDULER_KLINE_INTERVAL,
            limit=SCHEDULER_KLINE_LIMIT,
        )

        return (
            StrategyWorkerRunRequest(
                strategy_instances=strategy_instances,
                market_series=market_series,
                money_flows=[],
                existing_signals=signals,
                existing_states=states,
            ),
            warnings,
        )


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _to_strategy_instance_input(instance: PersistedStrategyInstance) -> StrategyInstanceInput:
    return StrategyInstanceInput(
        id=instance.id,
        name=instance.name,
        symbols=instance.symbols,
        enabled=instance.enabled,
        condition_ids=instance.condition_ids,
        risk_signal_ids=instance.risk_signal_ids,
        signal_ids_by_slot=instance.signal_ids_by_slot,
    )


def _to_existing_state_input(state: PersistedStrategyState) -> ExistingStrategyStateInput:
    return ExistingStrategyStateInput(
        instance_id=state.strategy_instance_id,
        symbol=state.symbol,
        state=state.state,
    )


def _to_existing_signal_input(signal: PersistedStrategySignal) -> ExistingSignalInput:
    return ExistingSignalInput(
        instance_id=signal.strategy_instance_id,
        symbol=signal.symbol,
        strength=signal.strength,
    )


def _collect_symbols(strategy_instances: list[StrategyInstanceInput]) -> list[str]:
    return sorted({symbol for instance in strategy_instances for symbol in instance.symbols})


strategy_worker_scheduler = StrategyWorkerScheduler()
