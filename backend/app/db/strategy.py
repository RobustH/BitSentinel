from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StrategyInstanceRecord(Base):
    __tablename__ = "strategy_instances"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    template_id: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        default="backend-strategy",
    )
    slot_template_id: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        default="backend-strategy",
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    version_history_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    symbols_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    slots_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    condition_ids_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    risk_signal_ids_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    signal_ids_by_slot_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )


class StrategyStateRecord(Base):
    __tablename__ = "strategy_states"
    __table_args__ = (
        UniqueConstraint(
            "strategy_instance_id",
            "symbol",
            name="uq_strategy_states_instance_symbol",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    strategy_instance_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(32), nullable=False)
    last_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_waiting_for: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class StrategySignalRecord(Base):
    __tablename__ = "strategy_signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    signal_id: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    strategy_instance_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    strength: Mapped[str] = mapped_column(String(32), nullable=False)
    direction: Mapped[str] = mapped_column(String(32), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class StrategyWorkerRunRecord(Base):
    __tablename__ = "strategy_worker_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    ran_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    evaluated_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    generated_signal_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    upserted_state_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    inserted_signal_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
