from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.models.strategy import (
    PersistedStrategySignal,
    PersistedStrategyState,
    StrategyEvaluationRequest,
    StrategyEvaluationResponse,
    StrategyPersistenceResult,
    StrategyWorkerRunRequest,
    StrategyWorkerRunResponse,
)
from app.services.strategy_engine.evaluator import StrategyEvaluator
from app.services.strategy_engine.repository import StrategyPersistenceRepository
from app.services.strategy_engine.worker import StrategyWorker

router = APIRouter(prefix="/strategy", tags=["strategy"])
DbSessionDep = Annotated[Session, Depends(get_db_session)]


@router.post("/evaluate", response_model=StrategyEvaluationResponse)
def evaluate_strategy(request: StrategyEvaluationRequest) -> StrategyEvaluationResponse:
    evaluator = StrategyEvaluator()
    return StrategyEvaluationResponse(results=evaluator.evaluate_all(request))


@router.post("/worker/run-once", response_model=StrategyWorkerRunResponse)
def run_strategy_worker_once(
    request: StrategyWorkerRunRequest,
    db: DbSessionDep,
    persist: bool = False,
) -> StrategyWorkerRunResponse:
    worker = StrategyWorker(StrategyEvaluator())
    response = worker.run_once(request)
    if not persist:
        return response

    summary = StrategyPersistenceRepository(db).apply_worker_run(response)
    db.commit()
    response.persistence = StrategyPersistenceResult(
        upserted_state_count=summary.upserted_state_count,
        inserted_signal_count=summary.inserted_signal_count,
    )
    return response


@router.get("/states", response_model=list[PersistedStrategyState])
def list_strategy_states(
    db: DbSessionDep,
    instance_id: str | None = None,
    symbol: str | None = None,
) -> list[PersistedStrategyState]:
    return StrategyPersistenceRepository(db).list_states(instance_id=instance_id, symbol=symbol)


@router.get("/signals", response_model=list[PersistedStrategySignal])
def list_strategy_signals(
    db: DbSessionDep,
    instance_id: str | None = None,
    symbol: str | None = None,
) -> list[PersistedStrategySignal]:
    return StrategyPersistenceRepository(db).list_signals(instance_id=instance_id, symbol=symbol)
