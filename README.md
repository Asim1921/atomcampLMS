# AtomAdapt — Smart Adaptive LMS for atomcamp

> Inter-University National AI Hackathon submission — Bahria School of Engineering and Applied Sciences.

## The Problem

atomcamp learners are treated identically despite vastly different goals, paces, and backgrounds. Instructors lack visibility into who is struggling. AtomAdapt unifies goals, progress, feedback, and outcomes into a single AI-driven system.

## Our Solution: Learner DNA

Every learner has a continuously updated profile — an embedding plus structured attributes — that powers personalization across every surface: recommendations, AI tutoring, instructor alerts, and admin analytics.

## Features (AI/ML)

| Feature | AI component |
|--------|----------------|
| Onboarding diagnostic | OpenAI chat (JSON quiz + scoring) with offline quiz fallback |
| Personalized course feed | OpenAI `text-embedding-3-small` + cosine; else **TF–IDF** + cosine; else keyword |
| AI Tutor | Streaming chat with Learner DNA in system prompt |
| At-risk scoring | **scikit-learn** `HistGradientBoostingClassifier` (`ml/artifacts/risk_model.pkl`) |
| Course match (no API) | **scikit-learn** `TfidfVectorizer` + cosine (`ml/artifacts/recommend_tfidf.pkl`) |
| Instructor intervention | LLM draft from DNA + risk context |
| Admin weekly insight | LLM summary of cohort aggregates (structured fallback) |

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind, Radix-based UI, Recharts, TanStack Query, Zustand
- **Backend:** FastAPI, SQLAlchemy, SQLite
- **AI/ML:** OpenAI API, scikit-learn, numpy/pandas

## Monorepo

```
/backend/app     FastAPI routers + services + prompts.py
/frontend        Next.js 14
/ml/artifacts    risk_model.pkl + recommend_tfidf.pkl (train: `python scripts/train_risk_model.py`)
/data            courses.json, learners.json, SQLite DB (generated)
/scripts         Windows helpers + model training
```

## Environment

Copy `.env.example` to `.env` at the **repo root** and set:

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Enables LLM + embeddings + streaming tutor (optional for demo; fallbacks exist) |
| `OPENAI_MODEL` | Default `gpt-4o-mini` (onboarding, interventions, admin) |
| `OPENAI_TUTOR_MODEL` | Optional; if unset, tutor uses `OPENAI_MODEL`. Set `gpt-4o` for higher-quality tutoring (cost/latency). |
| `OPENAI_EMBEDDING_MODEL` | Default `text-embedding-3-small` |
| `FRONTEND_ORIGIN` | CORS, default `http://localhost:3000` |
| `ATOMADAPT_ROOT` | **Docker only** — repo root inside container (`/repo`) |
| `AUTH_SECRET_KEY` | HMAC secret for signed session tokens — **change in prod** |
| `GOOGLE_CLIENT_ID` | Web client ID from Google Cloud Console (also set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the frontend) |
| `SMTP_HOST/PORT/USER/PASSWORD/FROM` | Email config for forgot-password. Gmail App Password works out of the box. |

### Google OAuth setup

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** (Web application).
2. Add `http://localhost:3000` to **Authorized JavaScript origins**.
3. Copy the client ID into both `GOOGLE_CLIENT_ID` (backend `.env`) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend env).
4. The frontend renders the official Google Identity Services button, which sends a verified ID token to `POST /api/auth/google`.

### Forgot-password email setup

1. Use a Gmail account with 2-Step Verification enabled.
2. Generate an App Password at <https://myaccount.google.com/apppasswords>.
3. Set `SMTP_USER` to the gmail address, `SMTP_PASSWORD` to the 16-char app password, and `SMTP_FROM` to the same address.
4. If SMTP is **not** configured, `/api/auth/forgot-password` returns a one-time `debug_reset_token` so the demo flow stays end-to-end.

## Quick Start (Windows)

### PowerShell execution policy

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
# or one-shot:
powershell -ExecutionPolicy Bypass -File D:\Aurex2k26\scripts\run-dev.ps1
```

### Train / refresh risk model (optional)

```powershell
cd D:\Aurex2k26
python scripts/train_risk_model.py
```

### Run backend + frontend

```powershell
cd D:\Aurex2k26
.\scripts\run-dev.ps1
```

- **Site:** http://localhost:3000  
- **API docs:** http://localhost:8000/docs  
- **Health:** http://localhost:8000/api/status  

### Docker (backend only)

```powershell
cd D:\Aurex2k26
docker compose up --build
```

Mounts `./data` to `/repo/data` so SQLite persists.

## Manual dev

**Backend**

```powershell
cd D:\Aurex2k26\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH="D:\Aurex2k26\backend"
uvicorn app.main:app --reload --port 8000
```

**Frontend**

```powershell
cd D:\Aurex2k26\frontend
npm install
npm run dev
```

## Architecture (ASCII)

```
┌──────────────┐     REST/SSE      ┌─────────────────────────────────┐
│  Next.js UI  │ ◄──────────────► │ FastAPI                          │
│ 3 dashboards │                  │ ├─ SQLite (learners, courses)    │
│ + onboarding │                  │ ├─ OpenAI (LLM, embeddings)      │
└──────────────┘                  │ ├─ sklearn (HGBDT + TF–IDF)      │
                                  │ └─ prompts.py (central prompts)  │
                                  └─────────────────────────────────┘
```

## UI / Brand

Visual language is inspired by [atomcamp.com](https://www.atomcamp.com/): deep navy canvas, teal/cyan accents, crisp data-product typography, subtle grid texture.

## Organizer datasets

See `data/DATASETS.md` — wire official files when provided.

## Team

TODO

## Demo Video

TODO
