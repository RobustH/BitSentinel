import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.strategy import (
    StrategyInstanceRecord,
    StrategySignalRecord,
    StrategyStateRecord,
    StrategyWorkerRunRecord,
)
from app.models.strategy import (
    PersistedStrategyInstance,
    PersistedStrategySignal,
    PersistedStrategyState,
    PersistedStrategyWorkerRun,
    StrategyInstanceCreateRequest,
    StrategyInstanceUpdateRequest,
    StrategySignalEvent,
    StrategyStateEvent,
    StrategyWorkerRunResponse,
)


@dataclass(frozen=True)
class StrategyPersistenceSummary:
    upserted_state_count: int
    inserted_signal_count: int


class StrategyPersistenceRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def apply_worker_run(self, run: StrategyWorkerRunResponse) -> StrategyPersistenceSummary:
        upserted_state_count = sum(1 for event in run.state_events if self._upsert_state(event))
        inserted_signal_count = sum(
            1 for event in run.generated_signals if self._insert_signal(event)
        )
        self._upsert_worker_run(
            run=run,
            upserted_state_count=upserted_state_count,
            inserted_signal_count=inserted_signal_count,
        )
        return StrategyPersistenceSummary(
            upserted_state_count=upserted_state_count,
            inserted_signal_count=inserted_signal_count,
        )

    def create_strategy_instance(
        self,
        request: StrategyInstanceCreateRequest,
    ) -> PersistedStrategyInstance:
        now = datetime.now().astimezone()
        record = StrategyInstanceRecord(
            id=request.id,
            name=request.name,
            symbols_json=_dump_json(request.symbols),
            enabled=request.enabled,
            condition_ids_json=_dump_json(request.condition_ids),
            risk_signal_ids_json=_dump_json(request.risk_signal_ids),
            signal_ids_by_slot_json=_dump_json(request.signal_ids_by_slot),
            created_at=now,
            updated_at=now,
        )
        self._session.add(record)
        self._session.flush()
        return _to_persisted_strategy_instance(record)

    def update_strategy_instance(
        self,
        instance_id: str,
        request: StrategyInstanceUpdateRequest,
    ) -> PersistedStrategyInstance | None:
        record = self._get_strategy_instance_record(instance_id)
        if record is None:
            return None

        if request.name is not None:
            record.name = request.name
        if request.symbols is not None:
            record.symbols_json = _dump_json(request.symbols)
        if request.enabled is not None:
            record.enabled = request.enabled
        if request.condition_ids is not None:
            record.condition_ids_json = _dump_json(request.condition_ids)
        if request.risk_signal_ids is not None:
            record.risk_signal_ids_json = _dump_json(request.risk_signal_ids)
        if request.signal_ids_by_slot is not None:
            record.signal_ids_by_slot_json = _dump_json(request.signal_ids_by_slot)
        record.updated_at = datetime.now().astimezone()
        self._session.flush()
        return _to_persisted_strategy_instance(record)

    def set_strategy_instance_enabled(
        self,
        instance_id: str,
        enabled: bool,
    ) -> PersistedStrategyInstance | None:
        record = self._get_strategy_instance_record(instance_id)
        if record is None:
            return None

        record.enabled = enabled
        record.updated_at = datetime.now().astimezone()
        self._session.flush()
        return _to_persisted_strategy_instance(record)

    def list_strategy_instances(self) -> list[PersistedStrategyInstance]:
        statement = select(StrategyInstanceRecord).order_by(
            StrategyInstanceRecord.updated_at.desc()
        )
        return [
            _to_persisted_strategy_instance(record)
            for record in self._session.scalars(statement).all()
        ]

    def get_strategy_instance(self, instance_id: str) -> PersistedStrategyInstance | None:
        record = self._get_strategy_instance_record(instance_id)
        if record is None:
            return None
        return _to_persisted_strategy_instance(record)

    def list_states(
        self,
        instance_id: str | None = None,
        symbol: str | None = None,
    ) -> list[PersistedStrategyState]:
        statement = select(StrategyStateRecord).order_by(StrategyStateRecord.updated_at.desc())
        if instance_id:
            statement = statement.where(StrategyStateRecord.strategy_instance_id == instance_id)
        if symbol:
            statement = statement.where(StrategyStateRecord.symbol == symbol)

        return [
            PersistedStrategyState(
                strategy_instance_id=record.strategy_instance_id,
                symbol=record.symbol,
                state=record.state,
                last_score=record.last_score,
                next_waiting_for=record.next_waiting_for,
                updated_at=record.updated_at.isoformat(),
            )
            for record in self._session.scalars(statement).all()
        ]

    def _get_strategy_instance_record(self, instance_id: str) -> StrategyInstanceRecord | None:
        return self._session.scalar(
            select(StrategyInstanceRecord).where(StrategyInstanceRecord.id == instance_id)
        )

    def list_signals(
        self,
        instance_id: str | None = None,
        symbol: str | None = None,
    ) -> list[PersistedStrategySignal]:
        statement = select(StrategySignalRecord).order_by(StrategySignalRecord.created_at.desc())
        if instance_id:
            statement = statement.where(StrategySignalRecord.strategy_instance_id == instance_id)
        if symbol:
            statement = statement.where(StrategySignalRecord.symbol == symbol)

        return [
            PersistedStrategySignal(
                signal_id=record.signal_id,
                strategy_instance_id=record.strategy_instance_id,
                symbol=record.symbol,
                strength=record.strength,
                direction=record.direction,
                reason=record.reason,
                created_at=record.created_at.isoformat(),
            )
            for record in self._session.scalars(statement).all()
        ]

    def list_worker_runs(self, limit: int = 20) -> list[PersistedStrategyWorkerRun]:
        statement = (
            select(StrategyWorkerRunRecord)
            .order_by(StrategyWorkerRunRecord.ran_at.desc())
            .limit(limit)
        )

        return [
            PersistedStrategyWorkerRun(
                run_id=record.run_id,
                ran_at=record.ran_at.isoformat(),
                evaluated_count=record.evaluated_count,
                generated_signal_count=record.generated_signal_count,
                upserted_state_count=record.upserted_state_count,
                inserted_signal_count=record.inserted_signal_count,
            )
            for record in self._session.scalars(statement).all()
        ]

    def _upsert_state(self, event: StrategyStateEvent) -> bool:
        record = self._session.scalar(
            select(StrategyStateRecord).where(
                StrategyStateRecord.strategy_instance_id == event.instance_id,
                StrategyStateRecord.symbol == event.symbol,
            )
        )
        updated_at = datetime.now().astimezone()
        if record is None:
            self._session.add(
                StrategyStateRecord(
                    strategy_instance_id=event.instance_id,
                    symbol=event.symbol,
                    state=event.new_state,
                    last_score=event.score,
                    next_waiting_for=event.next_waiting_for,
                    updated_at=updated_at,
                )
            )
            self._session.flush()
            return True

        record.state = event.new_state
        record.last_score = event.score
        record.next_waiting_for = event.next_waiting_for
        record.updated_at = updated_at
        self._session.flush()
        return True

    def _insert_signal(self, event: StrategySignalEvent) -> bool:
        existing = self._session.scalar(
            select(StrategySignalRecord).where(StrategySignalRecord.signal_id == event.id)
        )
        if existing is not None:
            return False

        self._session.add(
            StrategySignalRecord(
                signal_id=event.id,
                strategy_instance_id=event.instance_id,
                symbol=event.symbol,
                strength=event.strength,
                direction=event.direction,
                reason=event.reason,
                created_at=_parse_datetime(event.created_at),
            )
        )
        self._session.flush()
        return True

    def _upsert_worker_run(
        self,
        *,
        run: StrategyWorkerRunResponse,
        upserted_state_count: int,
        inserted_signal_count: int,
    ) -> None:
        record = self._session.scalar(
            select(StrategyWorkerRunRecord).where(StrategyWorkerRunRecord.run_id == run.run_id)
        )
        ran_at = _parse_datetime(run.ran_at)
        if record is None:
            self._session.add(
                StrategyWorkerRunRecord(
                    run_id=run.run_id,
                    ran_at=ran_at,
                    evaluated_count=run.evaluated_count,
                    generated_signal_count=run.generated_signal_count,
                    upserted_state_count=upserted_state_count,
                    inserted_signal_count=inserted_signal_count,
                )
            )
            self._session.flush()
            return

        record.ran_at = ran_at
        record.evaluated_count = run.evaluated_count
        record.generated_signal_count = run.generated_signal_count
        record.upserted_state_count = upserted_state_count
        record.inserted_signal_count = inserted_signal_count
        self._session.flush()


def _parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _dump_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _load_json(value: str, fallback: object) -> object:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _to_string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _to_slot_mapping(value: object) -> dict[str, list[str]]:
    if not isinstance(value, dict):
        return {}
    return {key: _to_string_list(raw) for key, raw in value.items() if isinstance(key, str)}


def _to_persisted_strategy_instance(record: StrategyInstanceRecord) -> PersistedStrategyInstance:
    return PersistedStrategyInstance(
        id=record.id,
        name=record.name,
        symbols=_to_string_list(_load_json(record.symbols_json, [])),
        enabled=record.enabled,
        condition_ids=_to_string_list(_load_json(record.condition_ids_json, [])),
        risk_signal_ids=_to_string_list(_load_json(record.risk_signal_ids_json, [])),
        signal_ids_by_slot=_to_slot_mapping(_load_json(record.signal_ids_by_slot_json, {})),
        created_at=record.created_at.isoformat(),
        updated_at=record.updated_at.isoformat(),
    )
