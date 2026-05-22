from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.strategy import StrategySignalRecord, StrategyStateRecord
from app.models.strategy import (
    PersistedStrategySignal,
    PersistedStrategyState,
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
        return StrategyPersistenceSummary(
            upserted_state_count=upserted_state_count,
            inserted_signal_count=inserted_signal_count,
        )

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


def _parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value)
