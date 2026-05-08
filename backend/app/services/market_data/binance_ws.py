from collections.abc import Awaitable, Callable


TickerHandler = Callable[[dict[str, str]], Awaitable[None]]


class BinanceStreamWorker:
    def __init__(self, ws_base_url: str) -> None:
        self._ws_base_url = ws_base_url
        self._running = False

    @property
    def running(self) -> bool:
        return self._running

    async def start_ticker_stream(
        self,
        symbols: list[str],
        handler: TickerHandler,
    ) -> None:
        self._running = True
        # Real WebSocket subscription is implemented in the market collection task.
        await handler(
            {
                "type": "ticker_stream_started",
                "symbols": ",".join(symbols),
                "base_url": self._ws_base_url,
            }
        )

    async def stop(self) -> None:
        self._running = False
