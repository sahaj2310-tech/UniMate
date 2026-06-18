from collections.abc import Generator
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine
from app.core.config import get_settings
from app.models import tables  # noqa: F401

settings = get_settings()
engine_kwargs = {"echo": settings.app_env == "development"}
if settings.database_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    if ":memory:" in settings.database_url:
        engine_kwargs["poolclass"] = StaticPool

engine = create_engine(settings.database_url, **engine_kwargs)


def create_db_and_tables() -> None:
    if engine.dialect.name != "sqlite":
        raise RuntimeError("Automatic table creation is disabled for PostgreSQL; run Alembic migrations instead.")
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
