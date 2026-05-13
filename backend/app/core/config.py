import os
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_CFG = Path(__file__).resolve()


def _repo_root() -> Path:
    env = os.getenv("ATOMADAPT_ROOT")
    if env:
        return Path(env)
    # backend/app/core/config.py -> parents[3] = monorepo root
    return _CFG.parents[3]


_REPO_ROOT = _repo_root()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    backend_port: int = 8000
    frontend_origin: str = "http://localhost:3000"

    # ----- Gemini (primary LLM provider) -----
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_tutor_model: str | None = Field(default=None)  # falls back to gemini_model
    gemini_embedding_model: str = "gemini-embedding-001"

    @field_validator("gemini_model", "gemini_tutor_model", mode="before")
    @classmethod
    def _normalize_gemini_generative_model(cls, v: object) -> str | None:
        """Map legacy model IDs that return 404 on current v1beta to a supported Flash model."""
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        if not isinstance(v, str):
            return None
        s = v.strip().removeprefix("models/").strip().strip('"').strip("'")
        low = s.lower()
        if "gemini-1.5" in low or low in ("gemini-pro", "gemini-1.0-pro", "gemini-pro-vision"):
            return "gemini-2.5-flash"
        return s

    @field_validator("gemini_embedding_model", mode="before")
    @classmethod
    def _normalize_gemini_embedding_model(cls, v: object) -> str:
        """Use a model id that embed_content accepts (see genai.list_models())."""
        if v is None or (isinstance(v, str) and not v.strip()):
            return "gemini-embedding-001"
        if not isinstance(v, str):
            return "gemini-embedding-001"
        s = v.strip().removeprefix("models/").strip().strip('"').strip("'")
        if not s:
            return "gemini-embedding-001"
        key = s.lower().replace("_", "").replace("-", "")
        if key in ("textembedding004", "textembedding004latest", "embedding001"):
            return "gemini-embedding-001"
        return s

    # ----- Ollama (local LLM — preferred for onboarding diagnostic) -----
    # Default points at a local server. Set OLLAMA_BASE_URL=disabled to force-skip Ollama.
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:latest"
    # Seconds before we give up waiting on Ollama (an 8B model on a typical laptop can take 30-90s).
    ollama_timeout_seconds: float = 180.0

    # ----- OpenAI (deprecated — kept for backward compatibility; unused by Gemini code paths) -----
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_tutor_model: str | None = Field(default=None)
    openai_embedding_model: str = "text-embedding-3-small"

    sqlite_path: str = str(_REPO_ROOT / "data" / "atomadapt.sqlite3")
    uploads_dir: str = str(_REPO_ROOT / "data" / "uploads")
    risk_model_path: str = str(_REPO_ROOT / "ml" / "artifacts" / "risk_model.pkl")
    # sklearn TF–IDF + cosine recommendations when API embeddings are unavailable (still real ML)
    recommend_tfidf_path: str = str(_REPO_ROOT / "ml" / "artifacts" / "recommend_tfidf.pkl")
    courses_json_path: str = str(_REPO_ROOT / "data" / "courses.json")
    learners_json_path: str = str(_REPO_ROOT / "data" / "learners.json")

    # --- Auth ---
    auth_secret_key: str = "change-me-in-prod-please-32-bytes-min-aurex-atomadapt"
    auth_token_ttl_minutes: int = 60 * 24 * 7  # 7 days
    password_reset_ttl_minutes: int = 30

    # Google OAuth 2.0 — set GOOGLE_CLIENT_ID for the Web app credentials in Google Cloud.
    google_client_id: str | None = None

    # --- SMTP (Gmail app password works here) ---
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None  # Gmail App Password
    smtp_from: str | None = None
    smtp_from_name: str = "AtomAdapt"
    smtp_use_tls: bool = True

    @field_validator("smtp_host", "smtp_user", "smtp_password", "smtp_from", mode="before")
    @classmethod
    def _strip_smtp_strings(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip().strip('"').strip("'")
            return s if s else None
        return v  # type: ignore[return-value]

    @field_validator("smtp_password")
    @classmethod
    def _compact_gmail_app_password(cls, v: str | None) -> str | None:
        # Gmail shows app passwords in groups; SMTP expects the compact 16-character token.
        return "".join(v.split()) if v else v

    @model_validator(mode="after")
    def _smtp_from_defaults_to_user(self):
        if self.smtp_user and not self.smtp_from:
            object.__setattr__(self, "smtp_from", self.smtp_user)
        return self


settings = Settings()
