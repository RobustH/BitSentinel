from typing import Literal

from pydantic import BaseModel, Field

StrategyStateValue = Literal[
    "idle",
    "watching",
    "waiting_trigger",
    "triggered",
    "invalidated",
    "cooldown",
]
SignalStrengthValue = Literal["strong", "weak", "watch", "invalidated"]


class StrategyKlineInput(BaseModel):
    symbol: str
    interval: str = "1h"
    open_time: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class StrategyMoneyFlowInput(BaseModel):
    symbol: str
    funding_rate: float | None = None
    oi_change: float | None = None
    taker_buy_ratio: float | None = None


class StrategyInstanceInput(BaseModel):
    id: str
    name: str
    symbols: list[str]
    enabled: bool = True
    condition_ids: list[str] = Field(default_factory=list)
    risk_signal_ids: list[str] = Field(default_factory=list)
    signal_ids_by_slot: dict[str, list[str]] = Field(default_factory=dict)


class ExistingSignalInput(BaseModel):
    instance_id: str
    symbol: str
    strength: SignalStrengthValue


class StrategyEvaluationRequest(BaseModel):
    strategy_instances: list[StrategyInstanceInput]
    market_series: dict[str, list[StrategyKlineInput]]
    money_flows: list[StrategyMoneyFlowInput] = Field(default_factory=list)
    existing_signals: list[ExistingSignalInput] = Field(default_factory=list)


class ConditionEvaluation(BaseModel):
    id: str
    label: str
    slot_key: str | None = None
    passed: bool
    score: int
    reason: str


class StrategyEvaluationResult(BaseModel):
    instance_id: str
    symbol: str
    state: StrategyStateValue
    score: int
    passed_count: int
    total_count: int
    should_trigger_signal: bool
    next_waiting_for: str
    conditions: list[ConditionEvaluation]


class StrategyEvaluationResponse(BaseModel):
    results: list[StrategyEvaluationResult]
