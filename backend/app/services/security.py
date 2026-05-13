"""Cryptographic helpers — password hashing, JWT-style signed tokens, reset tokens.

Stdlib-only (hashlib + hmac + json + base64) to avoid extra dependencies; not a
full JWT library, but cryptographically equivalent for HS256-style auth tokens
in a hackathon-grade LMS demo.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from app.core.config import settings


# ---------- base64url ----------
def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(s: str) -> bytes:
    padding = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)


# ---------- passwords (PBKDF2-HMAC-SHA256) ----------
_PBKDF_ITER = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF_ITER)
    return f"pbkdf2_sha256${_PBKDF_ITER}${_b64encode(salt)}${_b64encode(dk)}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algo, iters_s, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        iters = int(iters_s)
        salt = _b64decode(salt_b64)
        expected = _b64decode(hash_b64)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iters)
        return hmac.compare_digest(dk, expected)
    except (ValueError, AttributeError):
        return False


# ---------- session token (HS256 JWT-compatible) ----------
def _sign(message: bytes) -> bytes:
    return hmac.new(settings.auth_secret_key.encode("utf-8"), message, hashlib.sha256).digest()


def create_session_token(user_id: str, email: str, role: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + settings.auth_token_ttl_minutes * 60,
    }
    h_b64 = _b64encode(json.dumps(header, separators=(",", ":")).encode())
    p_b64 = _b64encode(json.dumps(payload, separators=(",", ":")).encode())
    sig = _sign(f"{h_b64}.{p_b64}".encode())
    return f"{h_b64}.{p_b64}.{_b64encode(sig)}"


def decode_session_token(token: str) -> dict[str, Any] | None:
    try:
        h_b64, p_b64, s_b64 = token.split(".")
        expected = _sign(f"{h_b64}.{p_b64}".encode())
        if not hmac.compare_digest(_b64decode(s_b64), expected):
            return None
        payload = json.loads(_b64decode(p_b64))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except (ValueError, json.JSONDecodeError):
        return None


# ---------- password reset tokens / OTP codes ----------
def new_reset_otp() -> tuple[str, str]:
    """Generate a 6-digit numeric OTP and its SHA-256 hash for storage."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    return code, hash_reset_token(code)


def hash_reset_token(plain: str) -> str:
    return hashlib.sha256(plain.encode("utf-8")).hexdigest()


# Back-compat alias (older imports may still reference this name).
def new_reset_token() -> tuple[str, str]:
    return new_reset_otp()
