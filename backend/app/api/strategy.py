from fastapi import APIRouter

from app.models.strategy import StrategyEvaluationRequest, StrategyEvaluationResponse
from app.services.strategy_engine.evaluator import StrategyEvaluator

router = APIRouter(prefix="/strategy", tags=["strategy"])


@router.post("/evaluate", response_model=StrategyEvaluationResponse)
def evaluate_strategy(request: StrategyEvaluationRequest) -> StrategyEvaluationResponse:
    evaluator = StrategyEvaluator()
    return StrategyEvaluationResponse(results=evaluator.evaluate_all(request))
