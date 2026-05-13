from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class GoogleLoginRequest(BaseModel):
    credential: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    name: str
    role: str
    avatar_url: str | None = None
    bio: str = ""
    interests: list[str] = Field(default_factory=list)
    learner_id: str | None = None
    auth_provider: str
    onboarding_completed: bool
    created_at: datetime


class UpdateProfileRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    bio: str | None = Field(default=None, max_length=4000)
    interests: list[str] | None = Field(default=None, max_length=24)


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class MessageResponse(BaseModel):
    message: str
    # Legacy fields — no longer populated by current routes.
    debug_reset_token: str | None = None
    debug_otp: str | None = None
