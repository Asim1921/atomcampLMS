"""Google ID-token verification.

Uses Google's tokeninfo endpoint to avoid bundling JWT/JWK parsing deps. This is
the documented public verification API and is sufficient for an OAuth login
flow where the frontend obtains an ID token via Google Identity Services.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any

from app.core.config import settings


GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo"


def verify_google_id_token(credential: str) -> dict[str, Any] | None:
    """Returns the claims dict if the credential is a valid Google ID token, else None."""

    if not credential:
        return None

    try:
        url = f"{GOOGLE_TOKENINFO}?{urllib.parse.urlencode({'id_token': credential})}"
        with urllib.request.urlopen(url, timeout=8) as resp:
            if resp.status != 200:
                return None
            claims: dict[str, Any] = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None

    if settings.google_client_id and claims.get("aud") != settings.google_client_id:
        return None

    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        return None

    if claims.get("email_verified") not in ("true", True):
        return None

    return claims
