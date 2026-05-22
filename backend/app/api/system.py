from fastapi import APIRouter

from app.core.config import get_settings
from app.core.database import create_database_engine
from app.models.system import DatabaseConnectionTestResult
from app.services.database.connection import check_database_connection

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/database/test", response_model=DatabaseConnectionTestResult)
def test_configured_database_connection() -> DatabaseConnectionTestResult:
    settings = get_settings()
    engine = create_database_engine(settings)
    try:
        return check_database_connection(engine, settings.database_url)
    finally:
        engine.dispose()
