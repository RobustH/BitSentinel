from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "BitSentinel API"
    environment: str = "local"
    api_prefix: str = "/api"
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5176,http://127.0.0.1:5176"
    )

    database_url: str = (
        "postgresql+psycopg://bitsentinel:bitsentinel@localhost:5432/bitsentinel"
    )
    redis_url: str = "redis://localhost:6379/0"

    binance_spot_base_url: str = "https://api.binance.com"
    binance_futures_base_url: str = "https://fapi.binance.com"
    binance_ws_base_url: str = "wss://stream.binance.com:9443"

    email_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    alert_from_email: str = ""
    alert_to_email: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="BITSENTINEL_",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
