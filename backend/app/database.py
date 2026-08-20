import os
from urllib.parse import urlparse

import psycopg


class DatabaseConfigurationError(RuntimeError):
    """Raised when the PostgreSQL connection configuration is unusable."""


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise DatabaseConfigurationError(
            "DATABASE_URL is required. Set it in the application environment before "
            "starting the API (see .env.example)."
        )

    parsed_url = urlparse(database_url)
    if (
        parsed_url.scheme not in {"postgresql", "postgres"}
        or not parsed_url.hostname
        or not parsed_url.path.strip("/")
    ):
        raise DatabaseConfigurationError(
            "DATABASE_URL must be a valid PostgreSQL URL, for example "
            "postgresql://user:password@host:5432/database."
        )

    try:
        port = parsed_url.port
    except ValueError as error:
        raise DatabaseConfigurationError(
            "DATABASE_URL contains an invalid port."
        ) from error

    if port is not None and not 1 <= port <= 65535:
        raise DatabaseConfigurationError(
            "DATABASE_URL contains an invalid port."
        )

    return database_url


# Resolve and validate configuration during application startup/import, rather
# than silently attempting to connect with an unsafe default.
DATABASE_URL = get_database_url()


def get_connection():
    return psycopg.connect(DATABASE_URL)
