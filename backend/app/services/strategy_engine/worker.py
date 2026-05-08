from app.services.strategy_engine.evaluator import StrategyEvaluator


class StrategyWorker:
    def __init__(self, evaluator: StrategyEvaluator) -> None:
        self._evaluator = evaluator
        self._running = False

    @property
    def running(self) -> bool:
        return self._running

    async def start(self) -> None:
        self._running = True

    async def stop(self) -> None:
        self._running = False
