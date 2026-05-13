"""Load trained classifier (HistGradientBoosting or LogisticRegression) for at-risk probability."""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import settings
from app.db.models import Learner

logger = logging.getLogger(__name__)

_model: Any | None = None


def _features(learner: Learner) -> np.ndarray:
    return np.array(
        [
            [
                float(learner.logins_last_14d),
                float(learner.avg_session_min),
                float(learner.quiz_avg),
                float(learner.confidence_score),
            ]
        ],
        dtype=np.float64,
    )


def load_model() -> Any | None:
    global _model
    if _model is not None:
        return _model
    path = Path(settings.risk_model_path)
    if not path.exists():
        logger.warning("Risk model missing at %s — using heuristic fallback", path)
        return None
    try:
        with open(path, "rb") as f:
            _model = pickle.load(f)
    except Exception as e:
        logger.warning("Could not load risk model: %s", e)
        _model = None
    return _model


def at_risk_probability(learner: Learner) -> float:
    """Return P(at-risk) in [0,1]."""
    m = load_model()
    X = _features(learner)
    if m is not None:
        try:
            if hasattr(m, "predict_proba"):
                proba = m.predict_proba(X)[0]
                return float(proba[1] if proba.shape[0] > 1 else proba[0])
        except Exception as e:
            logger.warning("predict_proba failed: %s", e)

    z = (
        -0.04 * learner.quiz_avg
        -0.12 * learner.logins_last_14d
        -0.01 * learner.avg_session_min
        + 0.5 * (1.0 - learner.confidence_score)
    )
    return float(1.0 / (1.0 + np.exp(-z)))
