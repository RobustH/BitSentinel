from typing import Any, Protocol

import httpx

from app.core.config import get_settings
from app.models.strategy import StrategyKlineInput
from app.services.market_data.binance_rest import BinanceRestClient


class StrategyMarketDataSource(Protocol):
    async def fetch_market_series(
        self,
        symbols: list[str],
        *,
        interval: str,
        limit: int,
    ) -> tuple[dict[str, list[StrategyKlineInput]], list[str]]:
        """Return Worker-ready Kline series and non-fatal warning messages."""


class BinanceStrategyMarketDataSource:
    def __init__(self, client: BinanceRestClient | None = None) -> None:
        self._client = client or BinanceRestClient(get_settings())

    async def fetch_market_series(
        self,
        symbols: list[str],
        *,
        interval: str,
        limit: int,
    ) -> tuple[dict[str, list[StrategyKlineInput]], list[str]]:
        market_series: dict[str, list[StrategyKlineInput]] = {}
        warnings: list[str] = []

        for symbol in symbols:
            try:
                raw_klines = await self._client.fetch_klines(symbol, interval, limit)
            except httpx.HTTPError as exc:
                warnings.append(f"{symbol} kline request failed: {type(exc).__name__}")
                market_series[symbol] = []
                continue

            try:
                market_series[symbol] = [
                    _to_strategy_kline(symbol, interval, raw_kline) for raw_kline in raw_klines
                ]
            except (IndexError, TypeError, ValueError) as exc:
                warnings.append(f"{symbol} kline payload invalid: {type(exc).__name__}")
                market_series[symbol] = []

        return market_series, warnings


def _to_strategy_kline(symbol: str, interval: str, raw_kline: list[Any]) -> StrategyKlineInput:
    return StrategyKlineInput(
        symbol=symbol,
        interval=interval,
        open_time=int(raw_kline[0]),
        open=float(raw_kline[1]),
        high=float(raw_kline[2]),
        low=float(raw_kline[3]),
        close=float(raw_kline[4]),
        volume=float(raw_kline[5]),
    )
