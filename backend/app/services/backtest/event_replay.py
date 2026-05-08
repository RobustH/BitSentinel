from collections.abc import Iterable
from dataclasses import dataclass, field

from app.models.domain import Kline, SignalRecord


@dataclass(frozen=True)
class ReplayResult:
    processed_bars: int
    signals: list[SignalRecord] = field(default_factory=list)


class EventReplayBacktester:
    def replay(self, klines: Iterable[Kline]) -> ReplayResult:
        processed_bars = sum(1 for _ in klines)
        return ReplayResult(processed_bars=processed_bars)
