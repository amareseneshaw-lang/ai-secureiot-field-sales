import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

ALGORITHM = "HS256"
DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES = 60


class AuthConfigurationError(RuntimeError):
    """Raised when the JWT signing configuration is unusable."""


class InvalidTokenError(RuntimeError):
    """Raised when a JWT is missing, malformed, expired, or has an invalid signature."""


def _get_secret_key() -> str:
    secret_key = os.getenv("JWT_SECRET_KEY")
    if not secret_key:
        raise AuthConfigurationError(
            "JWT_SECRET_KEY is required. Set it in the application environment "
            "before starting the API (see .env.example)."
        )
    return secret_key


# Resolved and validated at import time, matching DATABASE_URL's fail-fast pattern
# in backend/app/database.py rather than silently signing tokens with an unsafe default.
SECRET_KEY = _get_secret_key()
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES)
)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed/foreign hash (e.g. a placeholder value) is treated as a mismatch,
        # not a server error.
        return False


def create_access_token(subject: str, username: str, roles: list[str]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "username": username,
        "roles": roles,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError as error:
        raise InvalidTokenError(str(error)) from error
