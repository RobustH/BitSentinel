from fastapi.testclient import TestClient

from app.main import create_app

StrategyKlinePayload = dict[str, float | int | str]


def _kline(
    close: float,
    index: int,
    high_extra: float = 2.0,
    low_extra: float = 2.0,
) -> StrategyKlinePayload:
    return {
        "symbol": "BTCUSDT",
        "interval": "1h",
        "open_time": 1710000000000 + index * 3_600_000,
        "open": close - 1,
        "high": close + high_extra,
        "low": close - low_extra,
        "close": close,
        "volume": 1000 + index,
    }


def _bullish_series() -> list[StrategyKlinePayload]:
    return [_kline(100 + index, index) for index in range(40)]


def _trigger_payload() -> dict:
    payload = _request_payload(_bullish_series())
    payload["strategy_instances"][0]["signal_ids_by_slot"] = {
        "direction_tf": ["ema-trend-up"],
        "trigger_tf": ["macd-expansion"],
    }
    return payload


def _request_payload(series: list[dict[str, float | int | str]]) -> dict:
    return {
        "strategy_instances": [
            {
                "id": "strategy-1",
                "name": "趋势策略",
                "symbols": ["BTCUSDT"],
                "condition_ids": [
                    "ema-trend-up",
                    "structure-squeeze-end",
                    "ema-cross-up",
                    "macd-expansion",
                    "oi-rising",
                    "taker-buy-dominant",
                    "funding-not-hot",
                ],
                "risk_signal_ids": ["trend-invalid"],
                "signal_ids_by_slot": {
                    "direction_tf": ["ema-trend-up"],
                    "structure_tf": ["structure-squeeze-end"],
                    "trigger_tf": ["ema-cross-up", "macd-expansion"],
                },
            }
        ],
        "market_series": {"BTCUSDT": series},
        "money_flows": [
            {
                "symbol": "BTCUSDT",
                "funding_rate": 0.02,
                "oi_change": 3.5,
                "taker_buy_ratio": 61,
            }
        ],
        "existing_signals": [],
    }


def test_evaluate_strategy_returns_waiting_trigger() -> None:
    client = TestClient(create_app())

    response = client.post("/api/strategy/evaluate", json=_request_payload(_bullish_series()))

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["instance_id"] == "strategy-1"
    assert result["symbol"] == "BTCUSDT"
    assert result["state"] in {"watching", "waiting_trigger"}
    assert result["score"] > 0
    assert result["should_trigger_signal"] is False


def test_evaluate_strategy_can_trigger_signal() -> None:
    client = TestClient(create_app())

    response = client.post("/api/strategy/evaluate", json=_trigger_payload())

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["state"] == "triggered"
    assert result["should_trigger_signal"] is True
    assert any(item["id"] == "macd-expansion" and item["passed"] for item in result["conditions"])


def test_evaluate_strategy_avoids_duplicate_strong_signal() -> None:
    client = TestClient(create_app())
    payload = _trigger_payload()
    payload["existing_signals"] = [
        {"instance_id": "strategy-1", "symbol": "BTCUSDT", "strength": "strong"}
    ]

    response = client.post("/api/strategy/evaluate", json=payload)

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["state"] == "triggered"
    assert result["should_trigger_signal"] is False


def test_evaluate_strategy_marks_invalidated() -> None:
    client = TestClient(create_app())
    payload = _request_payload([_kline(140 - index, index) for index in range(40)])

    response = client.post("/api/strategy/evaluate", json=payload)

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["state"] == "invalidated"
    assert any(item["id"] == "trend-invalid" and item["passed"] for item in result["conditions"])


def test_evaluate_strategy_handles_missing_inputs() -> None:
    client = TestClient(create_app())
    payload = _request_payload([_kline(100, 0)])
    payload["money_flows"] = []

    response = client.post("/api/strategy/evaluate", json=payload)

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["state"] == "idle"
    assert result["passed_count"] == 0
    assert result["should_trigger_signal"] is False
