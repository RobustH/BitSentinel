from collections.abc import Sequence
from typing import Any

from app.models.indicator import IndicatorSummary


def ema(values: Sequence[float], period: int) -> list[float]:
    if period <= 0:
        raise ValueError("period must be greater than zero")
    if len(values) == 0:
        return []

    multiplier = 2 / (period + 1)
    result = [float(values[0])]

    for value in values[1:]:
        result.append((float(value) - result[-1]) * multiplier + result[-1])

    return result


def macd(
    values: Sequence[float],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> dict[str, list[float]]:
    if slow_period <= fast_period:
        raise ValueError("slow_period must be greater than fast_period")

    fast = ema(values, fast_period)
    slow = ema(values, slow_period)
    macd_line = [
        fast_value - slow_value
        for fast_value, slow_value in zip(fast, slow, strict=False)
    ]
    signal_line = ema(macd_line, signal_period)
    histogram = [
        macd_value - signal_value
        for macd_value, signal_value in zip(macd_line, signal_line, strict=False)
    ]
    return {
        "macd": macd_line,
        "signal": signal_line,
        "histogram": histogram,
    }


def build_indicator_summary(
    symbol: str,
    interval: str,
    klines: Sequence[Sequence[Any]],
) -> IndicatorSummary:
    if len(klines) < 55:
        raise ValueError("at least 55 klines are required")

    closes = [float(item[4]) for item in klines]
    ema9_values = ema(closes, 9)
    ema21_values = ema(closes, 21)
    ema55_values = ema(closes, 55)
    macd_values = macd(closes)

    ema9 = ema9_values[-1]
    ema21 = ema21_values[-1]
    ema55 = ema55_values[-1]
    latest_close = closes[-1]

    if ema9 > ema21 > ema55:
        ema_alignment = "bullish"
    elif ema9 < ema21 < ema55:
        ema_alignment = "bearish"
    else:
        ema_alignment = "mixed"

    dif = macd_values["macd"][-1]
    dea = macd_values["signal"][-1]
    histogram = macd_values["histogram"][-1]
    previous_dif = macd_values["macd"][-2]
    previous_dea = macd_values["signal"][-2]

    if previous_dif <= previous_dea and dif > dea:
        macd_signal = "bullish_cross"
    elif previous_dif >= previous_dea and dif < dea:
        macd_signal = "bearish_cross"
    elif dif > dea and histogram > 0:
        macd_signal = "bullish"
    elif dif < dea and histogram < 0:
        macd_signal = "bearish"
    else:
        macd_signal = "neutral"

    score = _trend_score(ema_alignment, macd_signal, latest_close, ema55)
    trend = _trend_state(score, ema_alignment, macd_signal)

    return IndicatorSummary(
        symbol=symbol,
        interval=interval,
        latest_close=latest_close,
        ema={
            "ema9": round(ema9, 6),
            "ema21": round(ema21, 6),
            "ema55": round(ema55, 6),
            "alignment": ema_alignment,
        },
        macd={
            "dif": round(dif, 6),
            "dea": round(dea, 6),
            "histogram": round(histogram, 6),
            "signal": macd_signal,
        },
        trend=trend,
        score=score,
        source_bars=len(klines),
    )


def _trend_score(ema_alignment: str, macd_signal: str, latest_close: float, ema55: float) -> int:
    score = 0
    score += 45 if ema_alignment == "bullish" else 20 if ema_alignment == "bearish" else 10
    if macd_signal in {"bullish", "bullish_cross"}:
        score += 35
    elif macd_signal in {"bearish", "bearish_cross"}:
        score += 10
    else:
        score += 15
    score += 20 if latest_close > ema55 else 5
    return min(100, max(0, score))


def _trend_state(score: int, ema_alignment: str, macd_signal: str) -> str:
    if score >= 75 and ema_alignment == "bullish" and macd_signal in {"bullish", "bullish_cross"}:
        return "bullish"
    if score <= 45 and ema_alignment == "bearish" and macd_signal in {"bearish", "bearish_cross"}:
        return "bearish"
    return "neutral"
