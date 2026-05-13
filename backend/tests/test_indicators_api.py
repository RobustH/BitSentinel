from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.api.indicators import get_indicator_binance_client
from app.main import create_app


class FakeIndicatorBinanceRestClient:
    async def fetch_klines(
        self,
        symbol: str,
        interval: str,
        limit: int,
    ) -> list[list[str | int]]:
        rows: list[list[str | int]] = []
        for index in range(limit):
            close = 100 + index
            rows.append(
                [
                    1710000000000 + index * 3_600_000,
                    str(close - 2),
                    str(close + 3),
                    str(close - 5),
                    str(close),
                    "1000.00",
                    1710003599999 + index * 3_600_000,
                    "105000.00",
                    88,
                ]
            )
        return rows


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_indicator_binance_client] = FakeIndicatorBinanceRestClient
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_get_indicator_summary(client: TestClient) -> None:
    response = client.get("/api/indicators/summary?symbol=BTCUSDT&interval=1h&limit=80")

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "BTCUSDT"
    assert payload["interval"] == "1h"
    assert payload["ema"]["alignment"] == "bullish"
    assert payload["trend"] in {"bullish", "neutral"}
    assert payload["score"] >= 0
    assert payload["source_bars"] == 80


def test_reject_unsupported_indicator_symbol(client: TestClient) -> None:
    response = client.get("/api/indicators/summary?symbol=DOGEUSDT")

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported symbol: DOGEUSDT"
