from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class TimeframeSlotKey(StrEnum):
    DIRECTION = "direction_tf"
    STRUCTURE = "structure_tf"
    TRIGGER = "trigger_tf"


class StrategyState(StrEnum):
    IDLE = "idle"
    WATCHING = "watching"
    WAITING_TRIGGER = "waiting_trigger"
    TRIGGERED = "triggered"
    INVALIDATED = "invalidated"
    COOLDOWN = "cooldown"


class SignalStrength(StrEnum):
    STRONG = "strong"
    WEAK = "weak"
    WATCH = "watch"
    INVALIDATED = "invalidated"


@dataclass(frozen=True)
class Kline:
    symbol: str
    timeframe: str
    open_time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass(frozen=True)
class TimeframeSlot:
    key: TimeframeSlotKey
    label: str
    timeframe: str


@dataclass(frozen=True)
class ConditionBlock:
    id: str
    group: str
    category: str
    label: str
    slot_key: TimeframeSlotKey | None = None
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class StrategyTemplate:
    id: str
    name: str
    slots: list[TimeframeSlot]
    conditions: list[ConditionBlock]


@dataclass(frozen=True)
class StrategyInstance:
    id: str
    template_id: str
    name: str
    symbols: list[str]
    enabled: bool


@dataclass(frozen=True)
class SignalRecord:
    id: str
    symbol: str
    instance_id: str
    strength: SignalStrength
    direction: str
    reason: str
    created_at: datetime
