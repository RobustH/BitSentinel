from pydantic import BaseModel


class DatabaseConnectionTarget(BaseModel):
    driver: str
    host: str | None = None
    port: int | None = None
    database: str | None = None


class DatabaseConnectionTestResult(BaseModel):
    connected: bool
    message: str
    target: DatabaseConnectionTarget
