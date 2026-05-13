"""Embedding pipeline: Gemini vectors + sklearn TF–IDF fallback; cosine recommendations."""

from __future__ import annotations

import json
import logging
import pickle
from pathlib import Path
from typing import Any, Sequence

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Course, Learner
from app.services import gemini_client as gem

logger = logging.getLogger(__name__)

_tfidf_loaded: bool = False
_tfidf_bundle: dict[str, Any] | None = None


def _l2_normalize(v: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(v)
    if n == 0:
        return v
    return v / n


def course_document(c: Course) -> str:
    parts = [c.title, c.description, c.audience, " ".join(c.prerequisites_list())]
    return "\n".join(p for p in parts if p).strip()


def learner_dna_document(learner: Learner) -> str:
    parts = [
        learner.goal,
        f"Level: {learner.current_skill_level}",
        f"Pace: {learner.pace}",
        f"Modality: {learner.preferred_modality}",
        "Struggles: " + ", ".join(learner.struggle_topics()),
    ]
    return "\n".join(parts).strip()


def _load_tfidf_bundle() -> dict[str, Any] | None:
    global _tfidf_loaded, _tfidf_bundle
    if _tfidf_loaded:
        return _tfidf_bundle
    _tfidf_loaded = True
    path = Path(settings.recommend_tfidf_path)
    if not path.exists():
        logger.info("TF–IDF recommender not found at %s — keyword fallback only", path)
        _tfidf_bundle = None
        return None
    try:
        with open(path, "rb") as f:
            _tfidf_bundle = pickle.load(f)
    except Exception as e:
        logger.warning("Could not load TF–IDF bundle: %s", e)
        _tfidf_bundle = None
    return _tfidf_bundle


def _recommend_from_embeddings(db: Session, learner: Learner) -> list[tuple[str, float]]:
    if not learner.dna_embedding_json:
        return []
    try:
        q = np.array(json.loads(learner.dna_embedding_json), dtype=np.float64)
    except (json.JSONDecodeError, TypeError):
        return []
    q = _l2_normalize(q)
    scored: list[tuple[str, float]] = []
    for c in db.query(Course).all():
        if not c.embedding_json:
            continue
        try:
            v = np.array(json.loads(c.embedding_json), dtype=np.float64)
        except (json.JSONDecodeError, TypeError):
            continue
        if q.shape != v.shape:
            continue
        v = _l2_normalize(v)
        scored.append((c.id, float(np.dot(q, v))))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


def _recommend_from_tfidf(db: Session, learner: Learner, top_k: int) -> list[tuple[str, float]] | None:
    bundle = _load_tfidf_bundle()
    if not bundle:
        return None
    vec = bundle["vectorizer"]
    course_ids: list[str] = bundle["course_ids"]
    X = bundle["X"]
    qtext = learner_dna_document(learner)
    q = vec.transform([qtext])
    sims = cosine_similarity(q, X)[0]
    id_to_idx = {cid: i for i, cid in enumerate(course_ids)}
    scored: list[tuple[str, float]] = []
    for c in db.query(Course).all():
        idx = id_to_idx.get(c.id)
        if idx is not None:
            scored.append((c.id, float(sims[idx])))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k] if scored else None


async def ensure_course_embeddings(db: Session) -> None:
    if not gem.is_available():
        logger.info("GEMINI_API_KEY missing — skipping course embedding warmup")
        return

    courses: Sequence[Course] = db.query(Course).all()
    for c in courses:
        if c.embedding_json:
            continue
        vec = await gem.embed_text(course_document(c), task_type="RETRIEVAL_DOCUMENT")
        if vec:
            c.embedding_json = json.dumps(vec)
            db.add(c)
    db.commit()


async def ensure_learner_dna_embedding(db: Session, learner: Learner) -> None:
    if not gem.is_available():
        return
    text = learner_dna_document(learner)
    vec = await gem.embed_text(text, task_type="RETRIEVAL_QUERY")
    if vec:
        learner.dna_embedding_json = json.dumps(vec)
        db.add(learner)
        db.commit()


def recommend_course_ids(db: Session, learner: Learner, top_k: int = 5) -> list[tuple[str, float]]:
    """Gemini cosine → sklearn TF–IDF cosine → keyword overlap."""
    emb = _recommend_from_embeddings(db, learner)
    if emb:
        return emb[:top_k]

    tf = _recommend_from_tfidf(db, learner, top_k)
    if tf:
        return tf

    return _keyword_fallback(db, learner, top_k)


def _keyword_fallback(db: Session, learner: Learner, top_k: int) -> list[tuple[str, float]]:
    blob = (learner.goal + " " + " ".join(learner.struggle_topics())).lower()
    words = set(blob.split())
    scored: list[tuple[str, float]] = []
    for c in db.query(Course).all():
        doc = course_document(c).lower()
        overlap = sum(1 for w in words if len(w) > 3 and w in doc)
        scored.append((c.id, float(overlap)))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k] if scored else [(c.id, 0.0) for c in db.query(Course).limit(top_k).all()]
