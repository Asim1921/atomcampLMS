from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Learner, PasswordResetToken, User
from app.db.session import get_db
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    GoogleLoginRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    SignupRequest,
    UpdateProfileRequest,
    UserOut,
    VerifyOtpRequest,
)
from app.services.email import (
    render_otp_email,
    send_email,
    smtp_configured,
    smtp_configuration_hint,
    smtp_last_error,
)
from app.services.google_oauth import verify_google_id_token
from app.services.security import (
    create_session_token,
    decode_session_token,
    hash_password,
    hash_reset_token,
    new_reset_otp,
    verify_password,
)

router = APIRouter()


# ---------- helpers ----------
def _user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        email=u.email,
        name=u.name,
        role=u.role,
        avatar_url=u.avatar_url,
        bio=getattr(u, "bio", None) or "",
        interests=u.interests(),
        learner_id=u.learner_id,
        auth_provider=u.auth_provider,
        onboarding_completed=bool(u.onboarding_completed),
        created_at=u.created_at,
    )


def _sanitize_interests(raw: list[str] | None) -> list[str] | None:
    if raw is None:
        return None
    seen: set[str] = set()
    out: list[str] = []
    for s in raw[:24]:
        t = (s or "").strip()[:120]
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def _attach_learner(db: Session, user: User) -> None:
    """Create the linked Learner row if not yet present (placeholder DNA until onboarding)."""

    if user.learner_id:
        return
    lid = f"user_{user.id[:12]}"
    if not db.get(Learner, lid):
        db.add(
            Learner(
                id=lid,
                name=user.name,
                goal="",
                current_skill_level="beginner",
                pace="steady",
                preferred_modality="mixed",
                struggle_topics_json="[]",
                confidence_score=0.5,
                logins_last_14d=0,
                avg_session_min=20,
                quiz_avg=60,
                onboarding_completed=0,
            )
        )
    user.learner_id = lid


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_session_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(User, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


# ---------- routes ----------
@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(
        id=uuid.uuid4().hex,
        email=email,
        name=body.name.strip(),
        password_hash=hash_password(body.password),
        role="learner",
        auth_provider="password",
        onboarding_completed=0,
        created_at=datetime.utcnow(),
    )
    db.add(user)
    _attach_learner(db, user)
    db.commit()
    db.refresh(user)

    token = create_session_token(user.id, user.email, user.role)
    return AuthResponse(token=token, user=_user_out(user))


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.learner_id:
        _attach_learner(db, user)
        db.commit()
        db.refresh(user)

    token = create_session_token(user.id, user.email, user.role)
    return AuthResponse(token=token, user=_user_out(user))


@router.post("/google", response_model=AuthResponse)
def google_login(body: GoogleLoginRequest, db: Session = Depends(get_db)):
    claims = verify_google_id_token(body.credential)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid Google credential.")

    email = (claims.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=401, detail="Google account has no email.")

    sub = claims.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=uuid.uuid4().hex,
            email=email,
            name=claims.get("name") or email.split("@")[0],
            password_hash=None,
            role="learner",
            avatar_url=claims.get("picture"),
            auth_provider="google",
            google_sub=sub,
            onboarding_completed=0,
            created_at=datetime.utcnow(),
        )
        db.add(user)
        _attach_learner(db, user)
    else:
        # Backfill avatar / google_sub on first Google sign-in for an existing email.
        if sub and not user.google_sub:
            user.google_sub = sub
        if claims.get("picture") and not user.avatar_url:
            user.avatar_url = claims["picture"]
        if user.auth_provider == "password" and not user.password_hash:
            user.auth_provider = "google"
        if not user.learner_id:
            _attach_learner(db, user)

    db.commit()
    db.refresh(user)

    token = create_session_token(user.id, user.email, user.role)
    return AuthResponse(token=token, user=_user_out(user))


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    # Always respond with a generic message so we don't leak which emails are registered.
    generic = MessageResponse(
        message="If an account exists for that email, a verification code has been sent.",
    )

    if not user:
        return generic

    # Invalidate any prior unused codes for this user — fresh request, fresh code.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id, PasswordResetToken.used == 0
    ).delete(synchronize_session=False)

    code, hashed = new_reset_otp()
    db.add(
        PasswordResetToken(
            token_hash=hashed,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=settings.password_reset_ttl_minutes),
            used=0,
            created_at=datetime.utcnow(),
        )
    )
    db.commit()

    text, html = render_otp_email(user.name, code, settings.password_reset_ttl_minutes)
    sent = send_email(
        to=user.email,
        subject=f"Your AtomCamp LMS password reset code is {code}",
        text=text,
        html=html,
    )

    if not sent:
        # Never return the OTP in the API body — the user did not receive this email.
        row = db.get(PasswordResetToken, hashed)
        if row:
            db.delete(row)
            db.commit()
        if not smtp_configured():
            raise HTTPException(status_code=503, detail=smtp_configuration_hint())
        reason = smtp_last_error()
        raise HTTPException(
            status_code=503,
            detail=reason
            or (
                "We could not send the verification email. Check SMTP settings on the server "
                "(Gmail: app password for SMTP_USER, matching From address) and try again."
            ),
        )

    return generic


@router.post("/verify-otp", response_model=MessageResponse)
def verify_otp(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    """Optional pre-check the frontend can use before showing the new-password form."""
    email = body.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    hashed = hash_reset_token(body.code)
    row = db.get(PasswordResetToken, hashed)
    if not row or row.used or row.user_id != user.id or row.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")
    return MessageResponse(message="Code verified. You may set a new password now.")


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    hashed = hash_reset_token(body.code)
    row = db.get(PasswordResetToken, hashed)
    if not row or row.used or row.user_id != user.id or row.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    user.password_hash = hash_password(body.new_password)
    if user.auth_provider == "google":
        user.auth_provider = "hybrid"
    row.used = 1
    db.commit()
    return MessageResponse(message="Password updated. You can sign in now.")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return _user_out(user)


@router.patch("/me", response_model=UserOut)
def patch_me(
    body: UpdateProfileRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.name is None and body.bio is None and body.interests is None:
        raise HTTPException(status_code=400, detail="Nothing to update.")

    if body.name is not None:
        user.name = body.name.strip()
        if user.learner_id:
            learner = db.get(Learner, user.learner_id)
            if learner:
                learner.name = user.name
                db.add(learner)

    if body.bio is not None:
        user.bio = body.bio.strip()

    interests_clean = _sanitize_interests(body.interests)
    if interests_clean is not None:
        user.interests_json = json.dumps(interests_clean, ensure_ascii=False)

    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_out(user)


