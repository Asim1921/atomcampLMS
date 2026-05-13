from collections.abc import Generator

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.migrate import ensure_schema

_db_path = Path(settings.sqlite_path).resolve().as_posix()
engine = create_engine(
    f"sqlite:///{_db_path}",
    connect_args={"check_same_thread": False},
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # Add new columns to existing tables, then create any newly-defined tables.
    ensure_schema(engine)
    Base.metadata.create_all(bind=engine)
