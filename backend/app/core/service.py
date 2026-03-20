"""
Auth module — business logic (register, login, refresh, logout, profile).
==========================================================================
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuthenticationError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.core.models import EmailVerification, OAuthAccount, RefreshToken, User, UserPermission
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expires_at,
    verify_password,
)

logger = logging.getLogger(__name__)

VERIFICATION_CODE_TTL_MINUTES = 10


def _user_permissions_list(user: User) -> list[str]:
    """Extract permission names from a User's relationships."""
    return [p.permission for p in user.permissions]


def _build_access_token(user: User) -> str:
    """Create an access token from a User model."""
    return create_access_token(
        user_id=user.id,
        role=user.role,
        permissions=_user_permissions_list(user),
    )


def _hash_code(code: str) -> str:
    """SHA-256 hash of a verification code."""
    return hashlib.sha256(code.encode()).hexdigest()


def _generate_code() -> str:
    """Generate a cryptographically secure 6-digit code."""
    return f"{secrets.randbelow(1_000_000):06d}"


# ──────────────────────────────────────────────────────────────
# Register  (now returns pending state — no tokens yet)
# ──────────────────────────────────────────────────────────────

async def register_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    nickname: str | None = None,
    language: str = "en",
) -> str:
    """
    Register a new user.

    - If email is new → create user (email_verified=False) + send code.
    - If email exists but NOT verified → update password/nickname, resend code.
      This handles the case where the code never arrived and the user tries again.
    - If email exists and IS verified → raise ConflictError.

    Returns the pending email address.
    """
    from app.core.email import send_verification_email

    existing_result = await db.execute(select(User).where(User.email == email))
    existing_user = existing_result.scalar_one_or_none()

    if existing_user is not None:
        if existing_user.email_verified:
            raise ConflictError("Email already registered")

        # Account exists but unverified — update credentials and resend code
        existing_user.password_hash = hash_password(password)
        if nickname:
            existing_user.nickname = nickname
        existing_user.language = language

        # Invalidate all previous codes
        await db.execute(
            update(EmailVerification)
            .where(EmailVerification.user_id == existing_user.id)
            .values(used=True)
        )

        code = _generate_code()
        ev = EmailVerification(
            user_id=existing_user.id,
            code_hash=_hash_code(code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES),
        )
        db.add(ev)
        await db.flush()

        logger.info("Re-sent verification code to existing unverified account: %s", email)
        await send_verification_email(email, code)
        return email

    user = User(
        email=email,
        password_hash=hash_password(password),
        nickname=nickname,
        language=language,
        role="user",
        email_verified=False,
    )
    db.add(user)
    await db.flush()  # get user.id

    # Generate and store verification code
    code = _generate_code()
    ev = EmailVerification(
        user_id=user.id,
        code_hash=_hash_code(code),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES),
    )
    db.add(ev)
    await db.flush()

    logger.info("User registered (pending verification): %s", email)
    await send_verification_email(email, code)
    return email


# ──────────────────────────────────────────────────────────────
# Verify email
# ──────────────────────────────────────────────────────────────

async def verify_email_code(
    db: AsyncSession,
    *,
    email: str,
    code: str,
) -> tuple[User, str, str]:
    """
    Verify the email code, mark user as verified, issue tokens, send welcome email.

    Returns (user, access_token, refresh_token_raw).
    """
    from app.core.email import send_welcome_email

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        raise AuthenticationError("Invalid email or code")

    if user.email_verified:
        raise ConflictError("Email already verified — please log in")

    if not user.is_active:
        raise AuthenticationError("Account is deactivated")

    code_hash = _hash_code(code)
    now = datetime.now(timezone.utc)

    ev_result = await db.execute(
        select(EmailVerification).where(
            EmailVerification.user_id == user.id,
            EmailVerification.code_hash == code_hash,
            EmailVerification.used == False,  # noqa: E712
            EmailVerification.expires_at > now,
        )
    )
    ev = ev_result.scalar_one_or_none()

    if ev is None:
        raise AuthenticationError("Invalid or expired verification code")

    # Mark code as used and activate email
    ev.used = True
    user.email_verified = True
    await db.flush()

    # Issue tokens
    await _cleanup_old_tokens(db, user.id)
    raw_token = generate_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=refresh_token_expires_at(),
    )
    db.add(rt)
    await db.flush()
    await db.refresh(user, ["permissions"])

    access_token = _build_access_token(user)

    logger.info("Email verified for user: %s", email)

    # Send welcome email (best-effort)
    await send_welcome_email(email, user.nickname)

    return user, access_token, raw_token


# ──────────────────────────────────────────────────────────────
# Resend verification code
# ──────────────────────────────────────────────────────────────

async def resend_verification_code(
    db: AsyncSession,
    *,
    email: str,
) -> None:
    """
    Generate a new verification code and resend it.
    Invalidates all previous unused codes for this user.
    """
    from app.core.email import send_verification_email

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or user.email_verified:
        # Silently succeed to avoid email enumeration
        return

    # Invalidate previous codes
    await db.execute(
        update(EmailVerification)
        .where(EmailVerification.user_id == user.id, EmailVerification.used == False)  # noqa: E712
        .values(used=True)
    )

    code = _generate_code()
    ev = EmailVerification(
        user_id=user.id,
        code_hash=_hash_code(code),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES),
    )
    db.add(ev)
    await db.flush()

    await send_verification_email(email, code)
    logger.info("Verification code resent to: %s", email)


# ──────────────────────────────────────────────────────────────
# OAuth — login or create user
# ──────────────────────────────────────────────────────────────

async def login_or_create_oauth_user(
    db: AsyncSession,
    *,
    provider: str,
    provider_user_id: str,
    provider_email: str,
    nickname: str | None = None,
) -> tuple[User, str, str]:
    """
    Find existing OAuth account or create a new user linked to the provider.
    Email is considered verified for OAuth users (trusted from provider).

    Returns (user, access_token, refresh_token_raw).
    """
    from app.core.email import send_welcome_email

    # 1. Look up existing OAuth account
    oa_result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == provider_user_id,
        )
    )
    existing_oa = oa_result.scalar_one_or_none()

    if existing_oa:
        # Load associated user
        user_result = await db.execute(
            select(User).where(User.id == existing_oa.user_id)
        )
        user = user_result.scalar_one()
        is_new = False
    else:
        # 2. Check if there's an existing user with this email
        user_result = await db.execute(
            select(User).where(User.email == provider_email)
        )
        user = user_result.scalar_one_or_none()
        is_new_user = user is None

        if is_new_user:
            user = User(
                email=provider_email,
                password_hash=None,  # OAuth user — no password
                nickname=nickname,
                language="en",
                role="user",
                email_verified=True,  # trusted OAuth email
            )
            db.add(user)
            await db.flush()

        # Link the OAuth account
        oa = OAuthAccount(
            user_id=user.id,
            provider=provider,
            provider_user_id=provider_user_id,
            provider_email=provider_email,
        )
        db.add(oa)

        # If existing email user — mark email as verified now that they used OAuth
        if not is_new_user and not user.email_verified:
            user.email_verified = True

        await db.flush()
        is_new = is_new_user

    if not user.is_active:
        raise AuthenticationError("Account is deactivated")

    # Issue tokens
    await _cleanup_old_tokens(db, user.id)
    raw_token = generate_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=refresh_token_expires_at(),
    )
    db.add(rt)
    await db.flush()
    await db.refresh(user, ["permissions"])

    access_token = _build_access_token(user)

    logger.info("OAuth login (%s): %s [new=%s]", provider, provider_email, is_new)

    if is_new:
        await send_welcome_email(provider_email, user.nickname)

    return user, access_token, raw_token


# ──────────────────────────────────────────────────────────────
# Login
# ──────────────────────────────────────────────────────────────

async def login_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
) -> tuple[User, str, str]:
    """
    Authenticate a user by email/password.

    Returns (user, access_token, refresh_token_raw).
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or user.password_hash is None:
        raise AuthenticationError("Invalid email or password")

    if not verify_password(password, user.password_hash):
        raise AuthenticationError("Invalid email or password")

    if not user.is_active:
        raise AuthenticationError("Account is deactivated")

    if not user.email_verified:
        raise ForbiddenError("Email not verified")

    # Revoke old refresh tokens (keep max 5)
    await _cleanup_old_tokens(db, user.id)

    # Create new refresh token
    raw_token = generate_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=refresh_token_expires_at(),
    )
    db.add(rt)
    await db.flush()
    await db.refresh(user, ["permissions"])

    access_token = _build_access_token(user)

    logger.info("User logged in: %s", email)
    return user, access_token, raw_token


# ──────────────────────────────────────────────────────────────
# Refresh
# ──────────────────────────────────────────────────────────────

async def refresh_access_token(
    db: AsyncSession,
    *,
    raw_refresh_token: str,
) -> tuple[User, str, str]:
    """
    Validate a refresh token and issue a new access + refresh pair (rotation).

    Returns (user, new_access_token, new_refresh_token_raw).
    """
    token_hash = hash_refresh_token(raw_refresh_token)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,  # noqa: E712
        )
    )
    rt = result.scalar_one_or_none()

    if rt is None:
        raise AuthenticationError("Invalid refresh token")

    if rt.expires_at < datetime.now(timezone.utc):
        rt.revoked = True
        raise AuthenticationError("Refresh token expired")

    # Revoke old token
    rt.revoked = True

    # Load user
    user_result = await db.execute(select(User).where(User.id == rt.user_id))
    user = user_result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise AuthenticationError("User not found or deactivated")

    # Issue new refresh token (rotation)
    new_raw = generate_refresh_token()
    new_rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(new_raw),
        expires_at=refresh_token_expires_at(),
    )
    db.add(new_rt)
    await db.flush()
    await db.refresh(user, ["permissions"])

    access_token = _build_access_token(user)
    return user, access_token, new_raw


# ──────────────────────────────────────────────────────────────
# Logout
# ──────────────────────────────────────────────────────────────

async def logout_user(
    db: AsyncSession,
    *,
    raw_refresh_token: str | None,
    user_id: UUID,
) -> None:
    """Revoke the given refresh token (or all tokens for the user)."""
    if raw_refresh_token:
        token_hash = hash_refresh_token(raw_refresh_token)
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .values(revoked=True)
        )
    else:
        # Revoke all tokens for this user
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .values(revoked=True)
        )

    logger.info("User logged out: %s", user_id)


# ──────────────────────────────────────────────────────────────
# Profile
# ──────────────────────────────────────────────────────────────

async def update_profile(
    db: AsyncSession,
    *,
    user: User,
    nickname: str | None = None,
    language: str | None = None,
    timezone_str: str | None = None,
) -> User:
    """Update user profile fields."""
    if nickname is not None:
        user.nickname = nickname
    if language is not None:
        user.language = language
    if timezone_str is not None:
        user.timezone = timezone_str
    return user


async def change_password(
    db: AsyncSession,
    *,
    user: User,
    current_password: str,
    new_password: str,
) -> None:
    """Change user password, revoking all refresh tokens."""
    if not user.password_hash:
        raise ValidationError("OAuth accounts cannot set a password through this endpoint")

    if not verify_password(current_password, user.password_hash):
        raise ValidationError("Current password is incorrect")

    user.password_hash = hash_password(new_password)

    # Revoke all refresh tokens (force re-login)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .values(revoked=True)
    )

    logger.info("Password changed for user %s", user.email)


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

async def _cleanup_old_tokens(db: AsyncSession, user_id: UUID, keep: int = 5) -> None:
    """Revoke excess refresh tokens, keeping only the latest N."""
    result = await db.execute(
        select(RefreshToken.id)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked == False)  # noqa: E712
        .order_by(RefreshToken.created_at.desc())
        .offset(keep)
    )
    old_ids = result.scalars().all()
    if old_ids:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.id.in_(old_ids))
            .values(revoked=True)
        )
