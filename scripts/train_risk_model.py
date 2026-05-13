"""
Train ML artifacts for AtomAdapt (hackathon / Level-4 demo).

1) At-risk: HistGradientBoostingClassifier on engagement features (tabular; strong default vs linear).
2) Recommendations: sklearn TfidfVectorizer + cosine similarity corpus (offline semantic-ish retrieval).

Run from repo root:
  python scripts/train_risk_model.py
"""

from __future__ import annotations

import json
import pickle
import random
from pathlib import Path

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ROOT = Path(__file__).resolve().parents[1]


def _course_text(c: dict) -> str:
    prereq = c.get("prerequisites", [])
    if isinstance(prereq, str):
        prereq = [prereq]
    parts = [
        c.get("title", ""),
        c.get("description", ""),
        c.get("audience", ""),
        " ".join(prereq),
    ]
    return "\n".join(p for p in parts if p).strip()


def train_risk_model() -> None:
    rows = json.loads((ROOT / "data" / "learners.json").read_text(encoding="utf-8"))
    X: list[list[float]] = []
    y: list[int] = []
    for row in rows:
        e = row["engagement"]
        X.append(
            [
                float(e["logins_last_14d"]),
                float(e["avg_session_min"]),
                float(e["quiz_avg"]),
                float(row["confidence_score"]),
            ]
        )
        y.append(1 if (e["quiz_avg"] < 55 or e["logins_last_14d"] < 4) else 0)

    rng = random.Random(42)
    for _ in range(220):
        logins = rng.randint(1, 12)
        quiz = rng.randint(40, 92)
        sess = rng.randint(10, 55)
        conf = rng.uniform(0.3, 0.92)
        X.append([float(logins), float(sess), float(quiz), conf])
        y.append(1 if quiz < 54 or logins < 4 else 0)

    X_arr = np.array(X, dtype=np.float64)
    y_arr = np.array(y, dtype=np.int64)

    clf = HistGradientBoostingClassifier(
        max_depth=7,
        learning_rate=0.07,
        max_iter=250,
        random_state=42,
        class_weight="balanced",
        early_stopping=True,
        validation_fraction=0.12,
        n_iter_no_change=15,
    )
    clf.fit(X_arr, y_arr)

    out_dir = ROOT / "ml" / "artifacts"
    out_dir.mkdir(parents=True, exist_ok=True)
    risk_path = out_dir / "risk_model.pkl"
    with open(risk_path, "wb") as f:
        pickle.dump(clf, f)
    print(f"Wrote {risk_path} (train acc ~{clf.score(X_arr, y_arr):.3f}) — HistGradientBoostingClassifier")


def train_tfidf_recommender() -> None:
    courses = json.loads((ROOT / "data" / "courses.json").read_text(encoding="utf-8"))
    texts = [_course_text(c) for c in courses]
    ids = [c["id"] for c in courses]

    vec = TfidfVectorizer(
        max_features=12_000,
        ngram_range=(1, 2),
        min_df=1,
        sublinear_tf=True,
    )
    X = vec.fit_transform(texts)

    out_dir = ROOT / "ml" / "artifacts"
    out_dir.mkdir(parents=True, exist_ok=True)
    rec_path = out_dir / "recommend_tfidf.pkl"
    with open(rec_path, "wb") as f:
        pickle.dump({"vectorizer": vec, "course_ids": ids, "X": X}, f)
    print(f"Wrote {rec_path} — TfidfVectorizer ({X.shape[0]} courses × {X.shape[1]} features)")


def main() -> None:
    train_risk_model()
    train_tfidf_recommender()


if __name__ == "__main__":
    main()
