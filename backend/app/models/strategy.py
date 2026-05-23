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


class StrategyVersionHistoryItem(BaseModel):
    version: int = Field(ge=1)
    changed_at: str
    summary: str


class ExistingSignalInput(BaseModel):
    instance_id: str
    symbol: str
    strength: SignalStrengthValue


class ExistingStrategyStateInput(BaseModel):
    instance_id: str
    symbol: str
    state: StrategyStateValue


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


class StrategyWorkerRunRequest(StrategyEvaluationRequest):
    existing_states: list[ExistingStrategyStateInput] = Field(default_factory=list)


class StrategyStateEvent(BaseModel):
    instance_id: str
    symbol: str
    previous_state: StrategyStateValue | None = None
    new_state: StrategyStateValue
    score: int
    next_waiting_for: str


class StrategySignalEvent(BaseModel):
    id: str
    instance_id: str
    symbol: str
    strength: Literal["strong"]
    direction: Literal["long"]
    reason: str
    created_at: str


class StrategyWorkerRunResponse(BaseModel):
    run_id: str
    ran_at: str
    evaluated_count: int
    generated_signal_count: int
    state_events: list[StrategyStateEvent]
    generated_signals: list[StrategySignalEvent]
    results: list[StrategyEvaluationResult]
    persistence: "StrategyPersistenceResult | None" = None


class StrategyWorkerScheduleRequest(BaseModel):
    worker_request: StrategyWorkerRunRequest
    interval_seconds: int = Field(default=60, ge=5, le=86_400)
    persist: bool = True


class StrategyWorkerSchedulerStatus(BaseModel):
    running: bool
    interval_seconds: int | None = None
    persist: bool = True
    last_started_at: str | None = None
    last_stopped_at: str | None = None
    last_run_at: str | None = None
    next_run_at: str | None = None
    last_run_id: str | None = None
    last_error: str | None = None
    run_count: int = 0
    skipped_count: int = 0


class StrategyInstanceCreateRequest(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    template_id: str = Field(default="backend-strategy", min_length=1, max_length=128)
    slot_template_id: str = Field(default="backend-strategy", min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=160)
    version: int = Field(default=1, ge=1)
    version_history: list[StrategyVersionHistoryItem] = Field(default_factory=list)
    symbols: list[str]
    enabled: bool = True
    slots: dict[str, str] = Field(default_factory=dict)
    condition_ids: list[str] = Field(default_factory=list)
    risk_signal_ids: list[str] = Field(default_factory=list)
    signal_ids_by_slot: dict[str, list[str]] = Field(default_factory=dict)


class StrategyInstanceUpdateRequest(BaseModel):
    template_id: str | None = Field(default=None, min_length=1, max_length=128)
    slot_template_id: str | None = Field(default=None, min_length=1, max_length=128)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    version: int | None = Field(default=None, ge=1)
    version_history: list[StrategyVersionHistoryItem] | None = None
    symbols: list[str] | None = None
    enabled: bool | None = None
    slots: dict[str, str] | None = None
    condition_ids: list[str] | None = None
    risk_signal_ids: list[str] | None = None
    signal_ids_by_slot: dict[str, list[str]] | None = None


class PersistedStrategyInstance(BaseModel):
    id: str
    template_id: str
    slot_template_id: str
    name: str
    version: int
    version_history: list[StrategyVersionHistoryItem]
    symbols: list[str]
    enabled: bool
    slots: dict[str, str]
    condition_ids: list[str]
    risk_signal_ids: list[str]
    signal_ids_by_slot: dict[str, list[str]]
    created_at: str
    updated_at: str


class StrategyPersistenceResult(BaseModel):
    upserted_state_count: int
    inserted_signal_count: int


class PersistedStrategyState(BaseModel):
    strategy_instance_id: str
    symbol: str
    state: StrategyStateValue
    last_score: int
    next_waiting_for: str
    updated_at: str


class PersistedStrategySignal(BaseModel):
    signal_id: str
    strategy_instance_id: str
    symbol: str
    strength: SignalStrengthValue
    direction: Literal["long", "short", "neutral"]
    reason: str
    created_at: str


class PersistedStrategyWorkerRun(BaseModel):
    run_id: str
    ran_at: str
    evaluated_count: int
    generated_signal_count: int
    upserted_state_count: int
    inserted_signal_count: int
