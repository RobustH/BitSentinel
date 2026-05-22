from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.engine import Engine

from app.core.config import get_settings
from app.core.database import get_database_engine
from app.models.system import DatabaseConnectionTestResult
from app.services.database.connection import check_database_connection

router = APIRouter(prefix="/system", tags=["system"])
DatabaseEngineDep = Annotated[Engine, Depends(get_database_engine)]


@router.get("/database/test", response_model=DatabaseConnectionTestResult)
def test_configured_database_connection(engine: DatabaseEngineDep) -> DatabaseConnectionTestResult:
    settings = get_settings()
    return check_database_connection(engine, settings.database_url)
