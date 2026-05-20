from datetime import UTC, datetime
from uuid import uuid4

from app.models.strategy import (
    StrategyEvaluationRequest,
    StrategyEvaluationResult,
    StrategySignalEvent,
    StrategyStateEvent,
    StrategyWorkerRunRequest,
    StrategyWorkerRunResponse,
)
from app.services.strategy_engine.evaluator import StrategyEvaluator


class StrategyWorker:
    def __init__(self, evaluator: StrategyEvaluator) -> None:
        self._evaluator = evaluator
        self._running = False

    @property
    def running(self) -> bool:
        return self._running

    async def start(self) -> None:
        self._running = True

    async def stop(self) -> None:
        self._running = False

    def run_once(self, request: StrategyWorkerRunRequest) -> StrategyWorkerRunResponse:
        results = self._evaluator.evaluate_all(_to_evaluation_request(request))
        ran_at = datetime.now(UTC).isoformat()
        return StrategyWorkerRunResponse(
            run_id=str(uuid4()),
            ran_at=ran_at,
            evaluated_count=len(results),
            generated_signal_count=sum(1 for result in results if result.should_trigger_signal),
            state_events=_build_state_events(request, results),
            generated_signals=_build_signal_events(results, ran_at),
            results=results,
        )


def _to_evaluation_request(request: StrategyWorkerRunRequest) -> StrategyEvaluationRequest:
    return StrategyEvaluationRequest(
        strategy_instances=request.strategy_instances,
        market_series=request.market_series,
        money_flows=request.money_flows,
        existing_signals=request.existing_signals,
    )


def _build_state_events(
    request: StrategyWorkerRunRequest,
    results: list[StrategyEvaluationResult],
) -> list[StrategyStateEvent]:
    existing_state_by_key = {
        (state.instance_id, state.symbol): state.state for state in request.existing_states
    }
    events: list[StrategyStateEvent] = []
    for result in results:
        key = (result.instance_id, result.symbol)
        previous_state = existing_state_by_key.get(key)
        if previous_state == result.state:
            continue
        events.append(
            StrategyStateEvent(
                instance_id=result.instance_id,
                symbol=result.symbol,
                previous_state=previous_state,
                new_state=result.state,
                score=result.score,
                next_waiting_for=result.next_waiting_for,
            )
        )
    return events


def _build_signal_events(
    results: list[StrategyEvaluationResult],
    created_at: str,
) -> list[StrategySignalEvent]:
    return [
        StrategySignalEvent(
            id=f"sig-{result.instance_id}-{result.symbol}-{uuid4()}",
            instance_id=result.instance_id,
            symbol=result.symbol,
            strength="strong",
            direction="long",
            reason=(
                "策略 Worker 触发："
                f"{result.passed_count}/{result.total_count} 条件命中，评分 {result.score}"
            ),
            created_at=created_at,
        )
        for result in results
        if result.should_trigger_signal
    ]
