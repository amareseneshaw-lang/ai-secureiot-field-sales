from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from backend.app.auth.dependencies import CurrentUser, get_current_user
from backend.app.auth.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    verify_password,
)
from backend.app.database import get_connection

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthenticatedUser(BaseModel):
    user_id: int
    username: str
    email: str
    first_name: str
    last_name: str
    roles: list[str]


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthenticatedUser


def _get_roles(cursor, user_id: int) -> list[str]:
    cursor.execute(
        """
        SELECT r.role_name
        FROM roles r
        JOIN user_roles ur ON ur.role_id = r.role_id
        WHERE ur.user_id = %s
        ORDER BY r.role_name;
        """,
        (user_id,),
    )
    return [row[0] for row in cursor.fetchall()]


def _log_auth_event(cursor, user_id, result, ip_address) -> None:
    cursor.execute(
        """
        INSERT INTO audit_logs (user_id, action, resource_type, result, ip_address)
        VALUES (%s, 'LOGIN', 'auth', %s, %s);
        """,
        (user_id, result, ip_address),
    )


@router.post("/login", response_model=LoginResponse)
def login(credentials: LoginRequest, request: Request):
    client_ip = request.client.host if request.client else None

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, username, email, password_hash, first_name, last_name, status
                FROM users
                WHERE username = %s;
                """,
                (credentials.username,),
            )
            row = cursor.fetchone()

            # Same generic failure for "no such user", "wrong password", and
            # "inactive account" so a caller can't enumerate valid usernames.
            authenticated = (
                row is not None
                and row[6] == "ACTIVE"
                and verify_password(credentials.password, row[3])
            )

            if not authenticated:
                _log_auth_event(cursor, row[0] if row else None, "FAILURE", client_ip)
                connection.commit()
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect username or password.",
                )

            user_id, username, email, _password_hash, first_name, last_name, _status = row
            roles = _get_roles(cursor, user_id)

            cursor.execute(
                "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = %s;",
                (user_id,),
            )
            _log_auth_event(cursor, user_id, "SUCCESS", client_ip)
        connection.commit()

    access_token = create_access_token(subject=str(user_id), username=username, roles=roles)

    return LoginResponse(
        access_token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=AuthenticatedUser(
            user_id=user_id,
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            roles=roles,
        ),
    )


@router.get("/me", response_model=AuthenticatedUser)
def me(current_user: CurrentUser = Depends(get_current_user)):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, username, email, first_name, last_name
                FROM users
                WHERE user_id = %s;
                """,
                (current_user.user_id,),
            )
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="User not found.")
            roles = _get_roles(cursor, current_user.user_id)

    return AuthenticatedUser(
        user_id=row[0],
        username=row[1],
        email=row[2],
        first_name=row[3],
        last_name=row[4],
        roles=roles,
    )
