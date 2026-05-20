from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.db.strategy import StrategySignalRecord, StrategyStateRecord
from app.models.strategy import (
    StrategySignalEvent,
    StrategyStateEvent,
    StrategyWorkerRunResponse,
)
from app.services.strategy_engine.repository import StrategyPersistenceRepository


def _session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)()


def _worker_run(
    *,
    state: str = "watching",
    signal_id: str = "sig-1",
) -> StrategyWorkerRunResponse:
    return StrategyWorkerRunResponse(
        run_id="run-1",
        ran_at="2026-05-20T09:00:00+00:00",
        evaluated_count=1,
        generated_signal_count=1,
        state_events=[
            StrategyStateEvent(
                instance_id="strategy-1",
                symbol="BTCUSDT",
                previous_state="idle",
                new_state=state,
                score=80,
                next_waiting_for="等待触发周期信号",
            )
        ],
        generated_signals=[
            StrategySignalEvent(
                id=signal_id,
                instance_id="strategy-1",
                symbol="BTCUSDT",
                strength="strong",
                direction="long",
                reason="策略 Worker 触发",
                created_at="2026-05-20T09:00:00+00:00",
            )
        ],
        results=[],
    )


def test_apply_worker_run_inserts_strategy_state() -> None:
    session = _session()
    repository = StrategyPersistenceRepository(session)

    summary = repository.apply_worker_run(_worker_run())

    records = session.scalars(select(StrategyStateRecord)).all()
    assert summary.upserted_state_count == 1
    assert records[0].strategy_instance_id == "strategy-1"
    assert records[0].symbol == "BTCUSDT"
    assert records[0].state == "watching"
    assert records[0].last_score == 80


def test_apply_worker_run_updates_existing_strategy_state() -> None:
    session = _session()
    repository = StrategyPersistenceRepository(session)

    repository.apply_worker_run(_worker_run(state="watching"))
    repository.apply_worker_run(_worker_run(state="triggered", signal_id="sig-2"))

    records = session.scalars(select(StrategyStateRecord)).all()
    assert len(records) == 1
    assert records[0].state == "triggered"
    assert records[0].last_score == 80


def test_apply_worker_run_inserts_signal_records() -> None:
    session = _session()
    repository = StrategyPersistenceRepository(session)

    summary = repository.apply_worker_run(_worker_run())

    signals = session.scalars(select(StrategySignalRecord)).all()
    assert summary.inserted_signal_count == 1
    assert signals[0].signal_id == "sig-1"
    assert signals[0].strategy_instance_id == "strategy-1"
    assert signals[0].strength == "strong"


def test_apply_worker_run_does_not_duplicate_signal_records() -> None:
    session = _session()
    repository = StrategyPersistenceRepository(session)

    repository.apply_worker_run(_worker_run(signal_id="sig-1"))
    summary = repository.apply_worker_run(_worker_run(signal_id="sig-1"))

    signals = session.scalars(select(StrategySignalRecord)).all()
    assert summary.inserted_signal_count == 0
    assert len(signals) == 1
