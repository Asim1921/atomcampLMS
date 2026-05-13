from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.db.seed import seed_from_files
from app.db.session import SessionLocal, init_db
from app.services.embeddings import ensure_course_embeddings


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    init_db()
    with SessionLocal() as db:
        seed_from_files(db)
    with SessionLocal() as db:
        await ensure_course_embeddings(db)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="AtomAdapt API", version="0.2.0", lifespan=lifespan)

    allow_origins = [
        settings.frontend_origin,
        "http://127.0.0.1:3000",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    app.mount(
        "/uploads",
        StaticFiles(directory=settings.uploads_dir),
        name="uploads",
    )

    app.include_router(api_router)
    return app


app = create_app()
