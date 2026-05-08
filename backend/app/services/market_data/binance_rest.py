from typing import Any

import httpx

from app.core.config import Settings


class BinanceRestClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def fetch_klines(
        self,
        symbol: str,
        interval: str,
        limit: int = 500,
    ) -> list[dict[str, Any]]:
        params = {"symbol": symbol, "interval": interval, "limit": limit}
        async with httpx.AsyncClient(base_url=self._settings.binance_spot_base_url) as client:
            response = await client.get("/api/v3/klines", params=params)
            response.raise_for_status()
            return response.json()

    async def fetch_futures_premium_index(self, symbol: str) -> dict[str, Any]:
        params = {"symbol": symbol}
        async with httpx.AsyncClient(base_url=self._settings.binance_futures_base_url) as client:
            response = await client.get("/fapi/v1/premiumIndex", params=params)
            response.raise_for_status()
            return response.json()
