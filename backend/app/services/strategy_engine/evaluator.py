from dataclasses import dataclass

from app.models.domain import ConditionBlock, StrategyInstance, StrategyState


@dataclass(frozen=True)
class ConditionResult:
    condition_id: str
    passed: bool
    reason: str


@dataclass(frozen=True)
class StrategyEvaluationResult:
    instance_id: str
    symbol: str
    state: StrategyState
    score: int
    condition_results: list[ConditionResult]
    next_waiting_for: str


class StrategyEvaluator:
    def evaluate(
        self,
        instance: StrategyInstance,
        symbol: str,
        conditions: list[ConditionBlock],
    ) -> StrategyEvaluationResult:
        condition_results = [
            ConditionResult(
                condition_id=condition.id,
                passed=False,
                reason="condition wiring is reserved for the next task",
            )
            for condition in conditions
        ]
        return StrategyEvaluationResult(
            instance_id=instance.id,
            symbol=symbol,
            state=StrategyState.IDLE,
            score=0,
            condition_results=condition_results,
            next_waiting_for="等待后续接入真实行情、指标和资金流输入",
        )
