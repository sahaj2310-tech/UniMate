from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
import sqlalchemy as sa
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlmodel import Session, select
from app.core.config import get_settings
from app.core.database import get_session
from app.models.tables import AdminUser

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
ALGORITHM = "HS256"
ADMIN_ROLES = {"admin", "reviewer"}
DEFAULT_ADMIN_PASSWORDS = {
    "admin",
    "admin123",
    "changeme",
    "change-me",
    "default",
    "password",
    "password123",
    "passw0rd",
    "passw0rd!",
    "passw0rd!234",
}
admin_scheme = HTTPBearer(auto_error=False)


def validate_admin_password_strength(password: str, email: str | None = None) -> None:
    normalized = password.strip()
    lowered = normalized.lower()
    email_local = email.split("@", 1)[0].lower() if email and "@" in email else None

    if len(normalized) < 12:
        raise ValueError("Admin password must be at least 12 characters long")
    if lowered in DEFAULT_ADMIN_PASSWORDS:
        raise ValueError("Admin password must not use a default password")
    if email_local and email_local and email_local in lowered:
        raise ValueError("Admin password must not contain the admin email name")
    if not any(character.islower() for character in normalized):
        raise ValueError("Admin password must include a lowercase letter")
    if not any(character.isupper() for character in normalized):
        raise ValueError("Admin password must include an uppercase letter")
    if not any(character.isdigit() for character in normalized):
        raise ValueError("Admin password must include a number")
    if not any(not character.isalnum() for character in normalized):
        raise ValueError("Admin password must include a symbol")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_access_token(subject: str, role: str) -> str:
    settings = get_settings()
    if role not in ADMIN_ROLES:
        raise ValueError("Unsupported admin role")
    issued_at = datetime.now(timezone.utc)
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "role": role, "iat": issued_at, "exp": expires, "typ": "access"}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    if payload.get("typ") != "access" or not payload.get("sub") or not payload.get("role"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token claims",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def get_admin_user_by_email(session: Session, email: str) -> AdminUser | None:
    normalized_email = email.strip().lower()
    return session.exec(select(AdminUser).where(sa.func.lower(AdminUser.email) == normalized_email)).first()


def authenticate_admin_user(session: Session, email: str, password: str) -> AdminUser | None:
    user = get_admin_user_by_email(session, email)
    if not user or not user.is_active or user.role not in ADMIN_ROLES:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def require_admin_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(admin_scheme),
    session: Session = Depends(get_session),
) -> AdminUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    user = get_admin_user_by_email(session, str(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin account is inactive or no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.role != payload.get("role") or user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role is not permitted")
    return user


def require_roles(*allowed_roles: str):
    allowed = set(allowed_roles)

    def dependency(user: AdminUser = Depends(require_admin_user)) -> AdminUser:
        if user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient admin role")
        return user

    return dependency
