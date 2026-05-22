import json

from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.database import create_database_engine
from app.services.database.initializer import initialize_database


def main() -> int:
    settings = get_settings()
    engine = create_database_engine(settings)
    try:
        result = initialize_database(engine, settings.database_url)
    except SQLAlchemyError as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": exc.__class__.__name__,
                },
                ensure_ascii=False,
            )
        )
        return 1
    finally:
        engine.dispose()

    print(
        json.dumps(
            {
                "ok": True,
                "target": result.target.model_dump(),
                "managed_tables": result.managed_tables,
                "existing_tables": result.existing_tables,
                "created_tables": result.created_tables,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
