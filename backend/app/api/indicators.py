from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import get_settings
from app.models.indicator import IndicatorSummary
from app.services.indicators.engine import build_indicator_summary
from app.services.market_data.binance_rest import BinanceRestClient

router = APIRouter(prefix="/indicators", tags=["indicators"])

SUPPORTED_SYMBOLS = {"BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"}
LimitQuery = Annotated[int, Query(ge=55, le=1000)]


def get_indicator_binance_client() -> BinanceRestClient:
    return BinanceRestClient(get_settings())


BinanceClientDep = Annotated[BinanceRestClient, Depends(get_indicator_binance_client)]


@router.get("/summary", response_model=IndicatorSummary)
async def get_indicator_summary(
    symbol: str,
    client: BinanceClientDep,
    interval: str = "1h",
    limit: LimitQuery = 200,
) -> IndicatorSummary:
    normalized_symbol = symbol.upper()
    if normalized_symbol not in SUPPORTED_SYMBOLS:
        raise HTTPException(status_code=400, detail=f"Unsupported symbol: {normalized_symbol}")

    try:
        raw_klines = await client.fetch_klines(normalized_symbol, interval, limit)
        return build_indicator_summary(normalized_symbol, interval, raw_klines)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail="Binance indicator source request failed",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
