import os
from pathlib import Path
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


# --- Schema initialization -----------------------------------------------------
#
# Idempotent, non-destructive schema bootstrap - safe to call on every process
# start. Used by backend.app.main's startup hook (so a fresh database is
# initialized automatically on first deploy with no manual step and no reliance
# on a paid-plan pre-deploy command) and by scripts/init_db.py (manual/local use).
# Never applies database/seed.sql - demo data is never loaded automatically.

SCHEMA_FILE = Path(__file__).resolve().parents[2] / "database" / "schema.sql"


def schema_is_initialized() -> bool:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'users'
                );
                """
            )
            row = cursor.fetchone()
            return bool(row and row[0])


def initialize_schema() -> bool:
    """Applies database/schema.sql if it hasn't been applied yet.

    Returns True if it applied the schema, False if it was already present (a
    no-op skip, not an error) - never re-runs schema.sql against an existing
    schema, so it never risks a destructive "relation already exists" failure
    or any drop/alter of existing data.
    """
    if schema_is_initialized():
        return False

    schema_sql = SCHEMA_FILE.read_text(encoding="utf-8")
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(schema_sql)
        connection.commit()
    return True
