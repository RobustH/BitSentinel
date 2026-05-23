from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.db.strategy import StrategySignalRecord, StrategyStateRecord, StrategyWorkerRunRecord
from app.models.strategy import (
    StrategyInstanceCreateRequest,
    StrategyInstanceUpdateRequest,
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
    run_id: str = "run-1",
    ran_at: str = "2026-05-20T09:00:00+00:00",
    state: str = "watching",
    signal_id: str = "sig-1",
) -> StrategyWorkerRunResponse:
    return StrategyWorkerRunResponse(
        run_id=run_id,
        ran_at=ran_at,
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


def test_apply_worker_run_records_run_history() -> None:
    session = _session()
    repository = StrategyPersistenceRepository(session)

    summary = repository.apply_worker_run(_worker_run())

    runs = session.scalars(select(StrategyWorkerRunRecord)).all()
    assert len(runs) == 1
    assert runs[0].run_id == "run-1"
    assert runs[0].evaluated_count == 1
    assert runs[0].generated_signal_count == 1
    assert runs[0].upserted_state_count == summary.upserted_state_count
    assert runs[0].inserted_signal_count == summary.inserted_signal_count


def test_apply_worker_run_updates_existing_run_history_by_run_id() -> None:
    session = _session()
    repository = StrategyPersistenceRepository(session)

    repository.apply_worker_run(_worker_run(run_id="run-1", signal_id="sig-1"))
    repository.apply_worker_run(_worker_run(run_id="run-1", signal_id="sig-1", state="triggered"))

    runs = session.scalars(select(StrategyWorkerRunRecord)).all()
    assert len(runs) == 1
    assert runs[0].inserted_signal_count == 0


def test_list_worker_runs_returns_recent_runs_first_with_limit() -> None:
    session = _session()
    repository = StrategyPersistenceRepository(session)

    repository.apply_worker_run(
        _worker_run(run_id="run-1", ran_at="2026-05-20T09:00:00+00:00", signal_id="sig-1")
    )
    repository.apply_worker_run(
        _worker_run(run_id="run-2", ran_at="2026-05-20T10:00:00+00:00", signal_id="sig-2")
    )

    runs = repository.list_worker_runs(limit=1)

    assert len(runs) == 1
    assert runs[0].run_id == "run-2"


def test_create_and_list_strategy_instance_configuration() -> None:
    session = _session()
    repository = StrategyPersistenceRepository(session)

    created = repository.create_strategy_instance(
        StrategyInstanceCreateRequest(
            id="strategy-config-1",
            name="三周期趋势策略",
            symbols=["BTCUSDT", "ETHUSDT"],
            enabled=True,
            condition_ids=["ema-trend-up", "macd-expansion"],
            risk_signal_ids=["trend-invalid"],
            signal_ids_by_slot={"direction_tf": ["ema-trend-up"]},
        )
    )
    listed = repository.list_strategy_instances()

    assert created.id == "strategy-config-1"
    assert created.symbols == ["BTCUSDT", "ETHUSDT"]
    assert created.condition_ids == ["ema-trend-up", "macd-expansion"]
    assert created.signal_ids_by_slot == {"direction_tf": ["ema-trend-up"]}
    assert listed[0].id == "strategy-config-1"


def test_update_strategy_instance_configuration() -> None:
    session = _session()
    repository = StrategyPersistenceRepository(session)
    repository.create_strategy_instance(
        StrategyInstanceCreateRequest(
            id="strategy-config-1",
            name="旧策略",
            symbols=["BTCUSDT"],
        )
    )

    updated = repository.update_strategy_instance(
        "strategy-config-1",
        StrategyInstanceUpdateRequest(
            name="新策略",
            symbols=["SOLUSDT"],
            enabled=False,
            condition_ids=["oi-rising"],
        ),
    )

    assert updated is not None
    assert updated.name == "新策略"
    assert updated.symbols == ["SOLUSDT"]
    assert updated.enabled is False
    assert updated.condition_ids == ["oi-rising"]


def test_set_strategy_instance_enabled_returns_none_for_missing_instance() -> None:
    session = _session()
    repository = StrategyPersistenceRepository(session)

    assert repository.set_strategy_instance_enabled("missing", enabled=True) is None
