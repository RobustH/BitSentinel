from collections.abc import Sequence


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
