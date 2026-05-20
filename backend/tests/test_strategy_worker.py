from fastapi.testclient import TestClient

from app.main import create_app
from app.models.strategy import (
    ExistingSignalInput,
    ExistingStrategyStateInput,
    StrategyInstanceInput,
    StrategyKlineInput,
    StrategyMoneyFlowInput,
    StrategyWorkerRunRequest,
)
from app.services.strategy_engine.evaluator import StrategyEvaluator
from app.services.strategy_engine.worker import StrategyWorker


def _kline(close: float, index: int) -> StrategyKlineInput:
    return StrategyKlineInput(
        symbol="BTCUSDT",
        interval="1h",
        open_time=1710000000000 + index * 3_600_000,
        open=close - 1,
        high=close + 2,
        low=close - 2,
        close=close,
        volume=1000 + index,
    )


def _bullish_series() -> list[StrategyKlineInput]:
    return [_kline(100 + index, index) for index in range(40)]


def _strategy_instance(enabled: bool = True) -> StrategyInstanceInput:
    return StrategyInstanceInput(
        id="strategy-1",
        name="趋势策略",
        symbols=["BTCUSDT"],
        enabled=enabled,
        condition_ids=[
            "ema-trend-up",
            "macd-expansion",
            "oi-rising",
            "taker-buy-dominant",
            "funding-not-hot",
        ],
        risk_signal_ids=["trend-invalid"],
        signal_ids_by_slot={
            "direction_tf": ["ema-trend-up"],
            "trigger_tf": ["macd-expansion"],
        },
    )


def _request(
    *,
    existing_state: str = "idle",
    existing_signals: list[ExistingSignalInput] | None = None,
    enabled: bool = True,
) -> StrategyWorkerRunRequest:
    return StrategyWorkerRunRequest(
        strategy_instances=[_strategy_instance(enabled=enabled)],
        market_series={"BTCUSDT": _bullish_series()},
        money_flows=[
            StrategyMoneyFlowInput(
                symbol="BTCUSDT",
                funding_rate=0.02,
                oi_change=3.5,
                taker_buy_ratio=61,
            )
        ],
        existing_signals=existing_signals or [],
        existing_states=[
            ExistingStrategyStateInput(
                instance_id="strategy-1",
                symbol="BTCUSDT",
                state=existing_state,
            )
        ],
    )


def test_worker_run_once_generates_state_event_and_signal_event() -> None:
    worker = StrategyWorker(StrategyEvaluator())

    result = worker.run_once(_request())

    assert result.evaluated_count == 1
    assert result.generated_signal_count == 1
    assert result.state_events[0].instance_id == "strategy-1"
    assert result.state_events[0].symbol == "BTCUSDT"
    assert result.state_events[0].previous_state == "idle"
    assert result.state_events[0].new_state == "triggered"
    assert result.generated_signals[0].instance_id == "strategy-1"
    assert result.generated_signals[0].symbol == "BTCUSDT"
    assert result.generated_signals[0].strength == "strong"


def test_worker_run_once_avoids_duplicate_strong_signal() -> None:
    worker = StrategyWorker(StrategyEvaluator())
    existing_signal = ExistingSignalInput(
        instance_id="strategy-1",
        symbol="BTCUSDT",
        strength="strong",
    )

    result = worker.run_once(_request(existing_signals=[existing_signal]))

    assert result.evaluated_count == 1
    assert result.generated_signal_count == 0
    assert result.generated_signals == []


def test_worker_run_once_ignores_unchanged_state() -> None:
    worker = StrategyWorker(StrategyEvaluator())

    result = worker.run_once(_request(existing_state="triggered"))

    assert result.evaluated_count == 1
    assert result.state_events == []


def test_worker_run_once_skips_disabled_strategy() -> None:
    worker = StrategyWorker(StrategyEvaluator())

    result = worker.run_once(_request(enabled=False))

    assert result.evaluated_count == 0
    assert result.generated_signal_count == 0
    assert result.state_events == []
    assert result.generated_signals == []


def test_worker_run_once_api_returns_run_summary() -> None:
    client = TestClient(create_app())

    response = client.post("/api/strategy/worker/run-once", json=_request().model_dump())

    assert response.status_code == 200
    payload = response.json()
    assert payload["evaluated_count"] == 1
    assert payload["generated_signal_count"] == 1
    assert payload["state_events"][0]["new_state"] == "triggered"
    assert payload["generated_signals"][0]["strength"] == "strong"
