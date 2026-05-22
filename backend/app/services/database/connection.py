from sqlalchemy import text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.exc import SQLAlchemyError

from app.models.system import DatabaseConnectionTarget, DatabaseConnectionTestResult


def describe_database_target(database_url: str) -> DatabaseConnectionTarget:
    url = make_url(database_url)
    return DatabaseConnectionTarget(
        driver=url.drivername,
        host=url.host,
        port=url.port,
        database=url.database,
    )


def check_database_connection(
    engine: Engine,
    database_url: str,
) -> DatabaseConnectionTestResult:
    target = describe_database_target(database_url)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        return DatabaseConnectionTestResult(
            connected=False,
            message=f"Database connection failed: {exc.__class__.__name__}",
            target=target,
        )

    return DatabaseConnectionTestResult(
        connected=True,
        message="Database connection succeeded",
        target=target,
    )
