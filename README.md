# AtomAdapt — Smart Adaptive LMS for atomcamp

> Inter-University National AI Hackathon submission — Bahria School of Engineering and Applied Sciences.


# Author Names
# Ahmed Asim Zaman
# Muhammad ABuzar



## The Problem

atomcamp learners are treated identically despite vastly different goals, paces, and backgrounds. Instructors lack visibility into who is struggling. AtomAdapt unifies goals, progress, feedback, and outcomes into a single AI-driven system.

## Our Solution: Learner DNA

Every learner has a continuously updated profile — an embedding plus structured attributes — that powers personalization across every surface: recommendations, AI tutoring, instructor alerts, and admin analytics.

## Features (AI/ML)

| Feature | AI component |
|--------|----------------|
| Onboarding diagnostic | Gemini chat (JSON quiz + scoring) with offline quiz fallback |
| Personalized course feed | Gemini `gemini-embedding-001` + cosine; else **TF–IDF** + cosine; else keyword |
| AI Tutor | Streaming chat with Learner DNA in system prompt |
| At-risk scoring | **scikit-learn** `HistGradientBoostingClassifier` (`ml/artifacts/risk_model.pkl`) |
| Course match (no API) | **scikit-learn** `TfidfVectorizer` + cosine (`ml/artifacts/recommend_tfidf.pkl`) |
| Instructor intervention | LLM draft from DNA + risk context |
| Admin weekly insight | LLM summary of cohort aggregates (structured fallback) |

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind, Radix-based UI, Recharts, TanStack Query, Zustand
- **Backend:** FastAPI, SQLAlchemy, SQLite
- **AI/ML:** Google Gemini API (+ optional local Ollama), scikit-learn, numpy/pandas

## Monorepo

```
/backend/app     FastAPI routers + services + prompts.py
/frontend        Next.js 14
/ml/artifacts    risk_model.pkl + recommend_tfidf.pkl (train: `python scripts/train_risk_model.py`)
/data            courses.json, learners.json, SQLite DB (generated)
/scripts         Windows helpers + model training
```

## Prerequisites

Install these before you run anything:

- **Python 3.11+** — <https://www.python.org/downloads/> (tick "Add python.exe to PATH")
- **Node.js 18+ LTS** — <https://nodejs.org/> (includes `npm`)
- **Git** — <https://git-scm.com/>
- *(Optional)* **Ollama** for local LLM — <https://ollama.com>, then `ollama pull llama3.1`

## Environment Setup

The backend reads a single `.env` file at the **repo root** (`d:\Aurex2k26\.env`).

```powershell
cd D:\Aurex2k26
Copy-Item .env.example .env
```

Open `.env` and fill in **at minimum**:

| Variable | Why you need it |
|----------|-----------------|
| `GEMINI_API_KEY` | Powers the AI tutor, onboarding diagnostic, and admin insights. Get a free key at <https://aistudio.google.com/apikey>. |
| `AUTH_SECRET_KEY` | Signs session tokens. The default works for local dev — **change for any deployment**. |
| `GOOGLE_CLIENT_ID` *(optional)* | Enables Google sign-in. Also paste the same value into `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. |
| `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` *(optional)* | Enables forgot-password emails. Use a Gmail App Password (<https://myaccount.google.com/apppasswords>). |
| `OLLAMA_BASE_URL` *(optional)* | Set to `http://localhost:11434` if running Ollama locally; set to `disabled` to force Gemini only. |

> No keys yet? You can still run the app — onboarding, recommendations, and risk scoring all have offline fallbacks (TF-IDF + sklearn).

---

## Run the App (Windows — one command)

From the repo root in PowerShell:

```powershell
cd D:\Aurex2k26
.\scripts\run-dev.ps1
```

This script will:

1. Create the Python venv at `backend\.venv` (first run only) and install requirements.
2. Install frontend `node_modules` (first run only).
3. Open a **new PowerShell window** running the backend (`uvicorn` on port 8000).
4. Run the frontend (`next dev` on port 3000) in the current window.

Once both are up, open:

- **App:** <http://localhost:3000>
- **API docs (Swagger):** <http://localhost:8000/docs>
- **Health check:** <http://localhost:8000/api/status>

**Seeded instructor login** (created automatically on first boot):

- Email: `staff@atomcamp.com`
- Password: `atomcamp-demo-2026`

### If PowerShell blocks the script

```powershell
# One-time fix (recommended):
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# Or run it once without changing policy:
powershell -ExecutionPolicy Bypass -File D:\Aurex2k26\scripts\run-dev.ps1
```

---

## Run the App (manual — two terminals)

Use this if you prefer to run the backend and frontend yourself, or you're not on Windows.

### Terminal 1 — Backend (FastAPI on port 8000)

```powershell
cd D:\Aurex2k26\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The first boot will:

- Create `data/aurex.db` (SQLite).
- Seed sample courses, learners, and the `staff@atomcamp.com` instructor.

### Terminal 2 — Frontend (Next.js on port 3000)

```powershell
cd D:\Aurex2k26\frontend
npm install
npm run dev
```

Now open <http://localhost:3000>.

---

## Optional: train / refresh the at-risk model

```powershell
cd D:\Aurex2k26
python scripts/train_risk_model.py
```

Writes `ml/artifacts/risk_model.pkl` and `ml/artifacts/recommend_tfidf.pkl`. The repo already ships trained artifacts — only re-run after changing the training data.

---

## Docker (backend only)

```powershell
cd D:\Aurex2k26
docker compose up --build
```

Mounts `./data` to `/repo/data` so SQLite persists between runs. The frontend still has to be started manually with `npm run dev`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `npm not found` | Install Node.js LTS, then **close and reopen** the terminal so `PATH` refreshes. |
| `python` opens the Microsoft Store | Install Python from python.org and check "Add to PATH", or run with the full path `C:\Users\<you>\AppData\Local\Programs\Python\Python311\python.exe`. |
| `ModuleNotFoundError: app` | Run `uvicorn` from `D:\Aurex2k26\backend`, not from the repo root. |
| Port 3000 / 8000 already in use | `Get-NetTCPConnection -LocalPort 3000` then `Stop-Process -Id <pid>`. |
| AI tutor returns generic text | Check `GEMINI_API_KEY` is set in the **repo-root** `.env` and restart the backend. |
| Google sign-in button missing | Set both `GOOGLE_CLIENT_ID` (backend) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend) to the same web client ID. |

## Architecture (ASCII)

```
┌──────────────┐     REST/SSE      ┌─────────────────────────────────┐
│  Next.js UI  │ ◄──────────────► │ FastAPI                          │
│ 3 dashboards │                  │ ├─ SQLite (learners, courses)    │
│ + onboarding │                  │ ├─ Gemini (LLM, embeddings)      │
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
