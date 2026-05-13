from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.api.market import get_binance_client
from app.main import create_app


class FakeBinanceRestClient:
    async def fetch_tickers(self, symbols: list[str]) -> list[dict[str, str | int]]:
        return [
            {
                "symbol": symbol,
                "lastPrice": "101.50",
                "priceChangePercent": "2.50",
                "volume": "1234.00",
                "quoteVolume": "125251.00",
                "closeTime": 1710000000000,
            }
            for symbol in symbols
        ]

    async def fetch_klines(
        self,
        symbol: str,
        interval: str,
        limit: int,
    ) -> list[list[str | int]]:
        return [
            [
                1710000000000,
                "100.00",
                "110.00",
                "90.00",
                "105.00",
                "1000.00",
                1710003599999,
                "105000.00",
                88,
            ]
        ][:limit]

    async def fetch_futures_premium_index(self, symbol: str) -> dict[str, str | int]:
        return {
            "symbol": symbol,
            "markPrice": "100.50",
            "indexPrice": "100.25",
            "lastFundingRate": "0.0001",
            "nextFundingTime": 1710007200000,
        }

    async def fetch_open_interest(self, symbol: str) -> dict[str, str | int]:
        return {
            "symbol": symbol,
            "openInterest": "9999.50",
            "time": 1710000000000,
        }


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_binance_client] = FakeBinanceRestClient
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_list_symbols(client: TestClient) -> None:
    response = client.get("/api/market/symbols")

    assert response.status_code == 200
    assert response.json()[0]["symbol"] == "BTCUSDT"


def test_list_tickers(client: TestClient) -> None:
    response = client.get("/api/market/tickers?symbols=BTCUSDT,ETHUSDT")

    assert response.status_code == 200
    payload = response.json()
    assert [item["symbol"] for item in payload] == ["BTCUSDT", "ETHUSDT"]
    assert payload[0]["price"] == 101.5


def test_reject_unsupported_ticker_symbol(client: TestClient) -> None:
    response = client.get("/api/market/tickers?symbols=DOGEUSDT")

    assert response.status_code == 400
    assert "Unsupported symbols" in response.json()["detail"]


def test_list_klines(client: TestClient) -> None:
    response = client.get("/api/market/klines?symbol=BTCUSDT&interval=1h&limit=1")

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["symbol"] == "BTCUSDT"
    assert payload[0]["close"] == 105.0
    assert payload[0]["trade_count"] == 88


def test_get_funding_rate(client: TestClient) -> None:
    response = client.get("/api/market/funding-rate?symbol=BTCUSDT")

    assert response.status_code == 200
    assert response.json()["last_funding_rate"] == 0.0001


def test_get_open_interest(client: TestClient) -> None:
    response = client.get("/api/market/open-interest?symbol=BTCUSDT")

    assert response.status_code == 200
    assert response.json()["open_interest"] == 9999.5
