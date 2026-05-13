from typing import Literal

from pydantic import BaseModel

EmaAlignment = Literal["bullish", "bearish", "mixed"]
MacdSignal = Literal["bullish_cross", "bearish_cross", "bullish", "bearish", "neutral"]
TrendState = Literal["bullish", "bearish", "neutral"]


class EmaSummary(BaseModel):
    ema9: float
    ema21: float
    ema55: float
    alignment: EmaAlignment


class MacdSummary(BaseModel):
    dif: float
    dea: float
    histogram: float
    signal: MacdSignal


class IndicatorSummary(BaseModel):
    symbol: str
    interval: str
    latest_close: float
    ema: EmaSummary
    macd: MacdSummary
    trend: TrendState
    score: int
    source_bars: int
