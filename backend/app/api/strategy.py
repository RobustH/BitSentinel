from fastapi import APIRouter

from app.models.strategy import (
    StrategyEvaluationRequest,
    StrategyEvaluationResponse,
    StrategyWorkerRunRequest,
    StrategyWorkerRunResponse,
)
from app.services.strategy_engine.evaluator import StrategyEvaluator
from app.services.strategy_engine.worker import StrategyWorker

router = APIRouter(prefix="/strategy", tags=["strategy"])


@router.post("/evaluate", response_model=StrategyEvaluationResponse)
def evaluate_strategy(request: StrategyEvaluationRequest) -> StrategyEvaluationResponse:
    evaluator = StrategyEvaluator()
    return StrategyEvaluationResponse(results=evaluator.evaluate_all(request))


@router.post("/worker/run-once", response_model=StrategyWorkerRunResponse)
def run_strategy_worker_once(request: StrategyWorkerRunRequest) -> StrategyWorkerRunResponse:
    worker = StrategyWorker(StrategyEvaluator())
    return worker.run_once(request)
