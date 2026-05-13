"""Tiny ad-hoc SQLite migration helper.

For a hackathon we don't bring in Alembic — `Base.metadata.create_all` makes
new tables, and this module ALTERs existing ones to add missing columns. It is
idempotent and safe to call on every boot.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


def _columns(engine: Engine, table: str) -> set[str]:
    with engine.connect() as conn:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def _add(engine: Engine, table: str, column_sql: str) -> None:
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column_sql}"))


def ensure_schema(engine: Engine) -> None:
    """Add columns introduced after the initial Course schema."""

    try:
        existing = _columns(engine, "courses")
    except Exception:  # table doesn't exist yet — create_all will handle it
        existing = set()

    if existing:
        additions: list[tuple[str, str]] = [
            ("owner_user_id", "owner_user_id VARCHAR(64)"),
            ("level", "level VARCHAR(32) DEFAULT 'beginner'"),
            ("tags_json", "tags_json TEXT DEFAULT '[]'"),
            ("cover_emoji", "cover_emoji VARCHAR(8) DEFAULT '📘'"),
            ("duration_hours", "duration_hours INTEGER DEFAULT 6"),
            ("published", "published INTEGER DEFAULT 1"),
            ("created_at", "created_at DATETIME"),
            ("updated_at", "updated_at DATETIME"),
        ]
        for col, ddl in additions:
            if col not in existing:
                _add(engine, "courses", ddl)

    try:
        ucols = _columns(engine, "users")
    except Exception:
        ucols = set()
    if ucols:
        for col, ddl in [
            ("bio", "bio TEXT DEFAULT ''"),
            ("interests_json", "interests_json TEXT DEFAULT '[]'"),
        ]:
            if col not in ucols:
                _add(engine, "users", ddl)
