from pydantic import BaseModel, Field


class MarketSymbol(BaseModel):
    symbol: str
    base_asset: str
    quote_asset: str
    market_type: str = "spot"


class MarketTicker(BaseModel):
    symbol: str
    price: float
    price_change_percent: float
    volume: float
    quote_volume: float
    close_time: int | None = None


class MarketKline(BaseModel):
    symbol: str
    interval: str
    open_time: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    close_time: int
    quote_volume: float
    trade_count: int


class FundingRateSnapshot(BaseModel):
    symbol: str
    mark_price: float
    index_price: float
    last_funding_rate: float
    next_funding_time: int | None = None


class OpenInterestSnapshot(BaseModel):
    symbol: str
    open_interest: float
    time: int | None = Field(default=None, description="Exchange source timestamp in milliseconds.")
