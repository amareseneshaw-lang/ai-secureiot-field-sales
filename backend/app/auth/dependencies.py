from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.auth.security import InvalidTokenError, decode_access_token
from backend.app.database import get_connection

bearer_scheme = HTTPBearer(auto_error=False)

_UNAUTHORIZED_HEADERS = {"WWW-Authenticate": "Bearer"}


class CurrentUser:
    def __init__(self, user_id: int, username: str, roles: list[str]):
        self.user_id = user_id
        self.username = username
        self.roles = roles


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers=_UNAUTHORIZED_HEADERS,
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers=_UNAUTHORIZED_HEADERS,
        )

    user_id = int(payload["sub"])

    # Re-check account status on every request so a deactivated/locked account
    # loses access immediately rather than waiting for its token to expire.
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT status FROM users WHERE user_id = %s;", (user_id,))
            row = cursor.fetchone()

    if row is None or row[0] != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is not active.",
            headers=_UNAUTHORIZED_HEADERS,
        )

    return CurrentUser(
        user_id=user_id,
        username=payload["username"],
        roles=payload.get("roles", []),
    )


def require_role(*allowed_roles: str):
    def dependency(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not set(current_user.roles) & set(allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return dependency
