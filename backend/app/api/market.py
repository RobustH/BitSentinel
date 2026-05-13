from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import get_settings
from app.models.market import (
    FundingRateSnapshot,
    MarketKline,
    MarketSymbol,
    MarketTicker,
    OpenInterestSnapshot,
)
from app.services.market_data.binance_rest import BinanceRestClient

router = APIRouter(prefix="/market", tags=["market"])

SUPPORTED_SYMBOLS: tuple[MarketSymbol, ...] = (
    MarketSymbol(symbol="BTCUSDT", base_asset="BTC", quote_asset="USDT"),
    MarketSymbol(symbol="ETHUSDT", base_asset="ETH", quote_asset="USDT"),
    MarketSymbol(symbol="SOLUSDT", base_asset="SOL", quote_asset="USDT"),
    MarketSymbol(symbol="BNBUSDT", base_asset="BNB", quote_asset="USDT"),
)
SUPPORTED_SYMBOL_SET = {item.symbol for item in SUPPORTED_SYMBOLS}
SymbolsQuery = Annotated[str | None, Query(description="Comma-separated symbols.")]
KlineLimitQuery = Annotated[int, Query(ge=1, le=1000)]


def get_binance_client() -> BinanceRestClient:
    return BinanceRestClient(get_settings())


BinanceClientDep = Annotated[BinanceRestClient, Depends(get_binance_client)]


@router.get("/symbols", response_model=list[MarketSymbol])
def list_symbols() -> list[MarketSymbol]:
    return list(SUPPORTED_SYMBOLS)


@router.get("/tickers", response_model=list[MarketTicker])
async def list_tickers(
    client: BinanceClientDep,
    symbols: SymbolsQuery = None,
) -> list[MarketTicker]:
    requested_symbols = _parse_symbol_list(symbols)
    try:
        raw_tickers = await client.fetch_tickers(requested_symbols)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Binance ticker request failed") from exc

    tickers = [_to_market_ticker(item) for item in raw_tickers]
    ticker_by_symbol = {item.symbol: item for item in tickers}
    return [ticker_by_symbol[symbol] for symbol in requested_symbols if symbol in ticker_by_symbol]


@router.get("/klines", response_model=list[MarketKline])
async def list_klines(
    symbol: str,
    client: BinanceClientDep,
    interval: str = "1h",
    limit: KlineLimitQuery = 200,
) -> list[MarketKline]:
    normalized_symbol = _normalize_symbol(symbol)
    try:
        raw_klines = await client.fetch_klines(normalized_symbol, interval, limit)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Binance kline request failed") from exc

    return [_to_market_kline(normalized_symbol, interval, item) for item in raw_klines]


@router.get("/funding-rate", response_model=FundingRateSnapshot)
async def get_funding_rate(
    symbol: str,
    client: BinanceClientDep,
) -> FundingRateSnapshot:
    normalized_symbol = _normalize_symbol(symbol)
    try:
        raw_snapshot = await client.fetch_futures_premium_index(normalized_symbol)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Binance funding rate request failed") from exc

    return FundingRateSnapshot(
        symbol=raw_snapshot["symbol"],
        mark_price=float(raw_snapshot["markPrice"]),
        index_price=float(raw_snapshot["indexPrice"]),
        last_funding_rate=float(raw_snapshot["lastFundingRate"]),
        next_funding_time=raw_snapshot.get("nextFundingTime"),
    )


@router.get("/open-interest", response_model=OpenInterestSnapshot)
async def get_open_interest(
    symbol: str,
    client: BinanceClientDep,
) -> OpenInterestSnapshot:
    normalized_symbol = _normalize_symbol(symbol)
    try:
        raw_snapshot = await client.fetch_open_interest(normalized_symbol)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Binance open interest request failed") from exc

    return OpenInterestSnapshot(
        symbol=raw_snapshot["symbol"],
        open_interest=float(raw_snapshot["openInterest"]),
        time=raw_snapshot.get("time"),
    )


def _parse_symbol_list(symbols: str | None) -> list[str]:
    if symbols is None or not symbols.strip():
        return [item.symbol for item in SUPPORTED_SYMBOLS]

    parsed_symbols = [item.strip().upper() for item in symbols.split(",") if item.strip()]
    if not parsed_symbols:
        return [item.symbol for item in SUPPORTED_SYMBOLS]

    unsupported = [symbol for symbol in parsed_symbols if symbol not in SUPPORTED_SYMBOL_SET]
    if unsupported:
        detail = f"Unsupported symbols: {', '.join(unsupported)}"
        raise HTTPException(status_code=400, detail=detail)

    return parsed_symbols


def _normalize_symbol(symbol: str) -> str:
    normalized_symbol = symbol.upper()
    if normalized_symbol not in SUPPORTED_SYMBOL_SET:
        raise HTTPException(status_code=400, detail=f"Unsupported symbol: {normalized_symbol}")
    return normalized_symbol


def _to_market_ticker(raw_ticker: dict[str, Any]) -> MarketTicker:
    return MarketTicker(
        symbol=raw_ticker["symbol"],
        price=float(raw_ticker["lastPrice"]),
        price_change_percent=float(raw_ticker["priceChangePercent"]),
        volume=float(raw_ticker["volume"]),
        quote_volume=float(raw_ticker["quoteVolume"]),
        close_time=raw_ticker.get("closeTime"),
    )


def _to_market_kline(symbol: str, interval: str, raw_kline: list[Any]) -> MarketKline:
    return MarketKline(
        symbol=symbol,
        interval=interval,
        open_time=raw_kline[0],
        open=float(raw_kline[1]),
        high=float(raw_kline[2]),
        low=float(raw_kline[3]),
        close=float(raw_kline[4]),
        volume=float(raw_kline[5]),
        close_time=raw_kline[6],
        quote_volume=float(raw_kline[7]),
        trade_count=int(raw_kline[8]),
    )
