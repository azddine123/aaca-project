"""Authentication & account routes: register/login/refresh, password reset
(OTP), signup email verification (OTP) and user profile management."""

import hashlib
import logging
import secrets as _secrets
from datetime import datetime, timedelta, timezone

import anyio
from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.models.schemas import (
    ForgotPasswordRequest,
    PasswordChangeSchema,
    ResendVerificationRequest,
    ResetPasswordRequest,
    User,
    UserCreate,
    UserUpdateSchema,
    VerifyEmailRequest,
    VerifyResetCodeRequest,
)
from app.api.routers.common import limiter
from app.services.mongodb_service import mongodb_service

logger = logging.getLogger("aaca")
router = APIRouter(tags=["auth"])


class RefreshRequest(BaseModel):
    refresh_token: str


# =============================================================================
# Register / Login / Refresh
# =============================================================================

@router.post("/auth/register", response_model=dict, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def register(request: Request, user_data: UserCreate) -> dict:
    """Register a new user. Requires explicit privacy consent."""
    if not user_data.privacy_consent:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le consentement à la politique de confidentialité est obligatoire.",
        )

    existing = await mongodb_service.get_user_by_email(user_data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user_dict = user_data.model_dump()
    user_dict["password_hash"] = get_password_hash(user_dict.pop("password"))
    user_dict["privacy_consent_at"] = datetime.now(timezone.utc)
    user_dict["email_verified"] = False

    user_id = await mongodb_service.create_user(user_dict)

    await _issue_verification_otp(user_data.email)

    return {
        "user_id": user_id,
        "email": user_data.email,
        "verification_required": True,
        "message": "Un code de confirmation a été envoyé à votre adresse email.",
    }


@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, email: str = Form(...), password: str = Form(...)) -> dict:
    """Login user and return tokens."""
    user = await mongodb_service.get_user_by_email(email)
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Accounts created before email verification existed have no flag → allowed
    if user.get("email_verified") is False:
        await _issue_verification_otp(email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email non vérifié. Un nouveau code de confirmation vient de vous être envoyé.",
        )

    user_id = user["id"]
    tv = user.get("token_version", 0)
    access_token = create_access_token({"sub": user_id, "tv": tv})
    refresh_token = create_refresh_token({"sub": user_id, "tv": tv})

    return {
        "user_id": user_id,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "email": user["email"],
            "full_name": user["full_name"],
            "cognitive_level": user.get("cognitive_level", "beginner"),
            "preferred_language": user.get("preferred_language", "fr"),
        },
    }


@router.post("/auth/refresh")
@limiter.limit("10/minute")
async def refresh_token_endpoint(request: Request, body: RefreshRequest):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid refresh token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Invalid token payload")
    # Reject refresh tokens minted before the last password change
    user = await mongodb_service.get_user(user_id)
    if user is not None and user.get("token_version", 0) != payload.get("tv", 0):
        raise HTTPException(401, "Token has been revoked")
    new_access = create_access_token({"sub": user_id, "tv": payload.get("tv", 0)})
    return {"access_token": new_access, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# Password-reset helpers (OTP hashing — no bcrypt dependency)
# ---------------------------------------------------------------------------

def _generate_otp() -> str:
    return str(_secrets.randbelow(10 ** 6)).zfill(6)


def _hash_otp(otp: str) -> tuple[str, str]:
    """Return (salt, sha256_hex)."""
    salt = _secrets.token_hex(16)
    digest = hashlib.sha256(f"{salt}{otp}".encode()).hexdigest()
    return salt, digest


def _verify_otp(otp: str, salt: str, otp_hash: str) -> bool:
    digest = hashlib.sha256(f"{salt}{otp}".encode()).hexdigest()
    return _secrets.compare_digest(digest, otp_hash)


_RESET_NEUTRAL = "Si un compte existe avec cet email, un code de vérification a été envoyé."
_RESET_CODE_ERR = "Code invalide ou expiré."


@router.post("/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest) -> dict:
    """Initiate password reset — always returns a neutral message."""
    from app.services.email_service import send_password_reset_otp

    user = await mongodb_service.get_user_by_email(body.email)
    if user:
        otp = _generate_otp()
        salt, otp_hash = _hash_otp(otp)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.PASSWORD_RESET_OTP_EXPIRE_MINUTES
        )
        await mongodb_service.create_password_reset_otp(
            email=body.email,
            otp_hash=otp_hash,
            otp_salt=salt,
            expires_at=expires_at,
        )
        # smtplib is blocking (up to 10s) — run it off the event loop
        await anyio.to_thread.run_sync(send_password_reset_otp, body.email, otp)

    return {"message": _RESET_NEUTRAL}


@router.post("/auth/verify-reset-code")
@limiter.limit("5/minute")
async def verify_reset_code(request: Request, body: VerifyResetCodeRequest) -> dict:
    """Verify the OTP code — returns verified:true or raises 400."""
    record = await mongodb_service.get_valid_password_reset_otp(body.email)
    if not record:
        raise HTTPException(status_code=400, detail=_RESET_CODE_ERR)

    if not _verify_otp(body.code, record["otp_salt"], record["otp_hash"]):
        await mongodb_service.increment_password_reset_attempts(record["id"])
        raise HTTPException(status_code=400, detail=_RESET_CODE_ERR)

    return {"verified": True}


@router.post("/auth/reset-password")
@limiter.limit("3/minute")
async def reset_password(request: Request, body: ResetPasswordRequest) -> dict:
    """Reset password after OTP verification."""
    record = await mongodb_service.get_valid_password_reset_otp(body.email)
    if not record:
        raise HTTPException(status_code=400, detail=_RESET_CODE_ERR)

    if not _verify_otp(body.code, record["otp_salt"], record["otp_hash"]):
        await mongodb_service.increment_password_reset_attempts(record["id"])
        raise HTTPException(status_code=400, detail=_RESET_CODE_ERR)

    user = await mongodb_service.get_user_by_email(body.email)
    if not user:
        raise HTTPException(status_code=400, detail=_RESET_CODE_ERR)

    new_hash = get_password_hash(body.new_password)
    await mongodb_service.update_user(user["id"], {
        "password_hash": new_hash,
        # Revoke every session opened before this reset
        "token_version": user.get("token_version", 0) + 1,
    })
    await mongodb_service.mark_password_reset_otp_used(record["id"])

    return {"message": "Mot de passe réinitialisé avec succès."}


# ---------------------------------------------------------------------------
# Email verification (signup) — reuses the OTP infrastructure above
# ---------------------------------------------------------------------------

_VERIFY_NEUTRAL = "Si un compte non vérifié existe avec cet email, un nouveau code a été envoyé."


async def _issue_verification_otp(email: str) -> None:
    """Generate, store and send an email-verification OTP."""
    from app.services.email_service import send_email_verification_otp

    otp = _generate_otp()
    salt, otp_hash = _hash_otp(otp)
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.PASSWORD_RESET_OTP_EXPIRE_MINUTES
    )
    await mongodb_service.create_password_reset_otp(
        email=email,
        otp_hash=otp_hash,
        otp_salt=salt,
        expires_at=expires_at,
        purpose="email_verification",
    )
    # smtplib is blocking (up to 10s) — run it off the event loop
    await anyio.to_thread.run_sync(send_email_verification_otp, email, otp)


@router.post("/auth/verify-email")
@limiter.limit("5/minute")
async def verify_email(request: Request, body: VerifyEmailRequest) -> dict:
    """Confirm the signup OTP, activate the account and log the user in."""
    record = await mongodb_service.get_valid_password_reset_otp(
        body.email, purpose="email_verification"
    )
    if not record:
        raise HTTPException(status_code=400, detail=_RESET_CODE_ERR)

    if not _verify_otp(body.code, record["otp_salt"], record["otp_hash"]):
        await mongodb_service.increment_password_reset_attempts(record["id"])
        raise HTTPException(status_code=400, detail=_RESET_CODE_ERR)

    user = await mongodb_service.get_user_by_email(body.email)
    if not user:
        raise HTTPException(status_code=400, detail=_RESET_CODE_ERR)

    await mongodb_service.update_user(user["id"], {"email_verified": True})
    await mongodb_service.mark_password_reset_otp_used(record["id"])

    user_id = user["id"]
    tv = user.get("token_version", 0)
    access_token = create_access_token({"sub": user_id, "tv": tv})
    refresh_token = create_refresh_token({"sub": user_id, "tv": tv})

    return {
        "user_id": user_id,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "email": user["email"],
            "full_name": user["full_name"],
            "cognitive_level": user.get("cognitive_level", "beginner"),
            "preferred_language": user.get("preferred_language", "fr"),
        },
    }


@router.post("/auth/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(request: Request, body: ResendVerificationRequest) -> dict:
    """Send a fresh signup OTP — always returns a neutral message."""
    user = await mongodb_service.get_user_by_email(body.email)
    if user and user.get("email_verified") is False:
        await _issue_verification_otp(body.email)
    return {"message": _VERIFY_NEUTRAL}


# =============================================================================
# User profile
# =============================================================================

@router.get("/user/me", response_model=User)
async def get_me(current_user: str = Depends(get_current_user)) -> User:
    """Get current user profile."""
    user = await mongodb_service.get_user(current_user)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return User(**user)


@router.patch("/user/me")
async def update_profile(data: UserUpdateSchema,
                         current_user: str = Depends(get_current_user)):
    user = await mongodb_service.get_user(current_user)
    if not user:
        raise HTTPException(404, "User not found")
    update = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if update:
        await mongodb_service.update_user(current_user, update)
    return {"message": "Profile updated"}


@router.patch("/user/password")
async def change_password(data: PasswordChangeSchema,
                          current_user: str = Depends(get_current_user)):
    user = await mongodb_service.get_user(current_user)
    if not user:
        raise HTTPException(404, "User not found")
    if not verify_password(data.current_password, user.get("password_hash", "")):
        raise HTTPException(400, "Current password is incorrect")
    await mongodb_service.update_user(current_user, {
        "password_hash": get_password_hash(data.new_password),
        # Revoke every session opened before this change (re-login required)
        "token_version": user.get("token_version", 0) + 1,
    })
    return {"message": "Password updated"}
