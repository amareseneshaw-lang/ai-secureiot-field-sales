"""Production-safe database initializer.

Applies database/schema.sql to the database at DATABASE_URL. Safe to run on every
deploy: if the schema already exists (checked by looking for the `users` table),
it does nothing and exits cleanly instead of failing on "relation already exists".

Deliberately never applies database/seed.sql - that file contains fictional demo
accounts and passwords (see docs/AUTH_DEMO_CREDENTIALS.md) for local development
only and must never be loaded into a production database. Seed a real production
database with real accounts through your own admin tooling, not this script.

Usage (run from the repository root, so backend.app.database is importable):
    DATABASE_URL=postgresql://user:pass@host:5432/db python -m scripts.init_db
"""

import sys
from pathlib import Path

import psycopg

from backend.app.database import DATABASE_URL

SCHEMA_FILE = Path(__file__).resolve().parent.parent / "database" / "schema.sql"


def _schema_already_applied(cursor: psycopg.Cursor) -> bool:
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


def main() -> None:
    schema_sql = SCHEMA_FILE.read_text(encoding="utf-8")

    with psycopg.connect(DATABASE_URL) as connection:
        with connection.cursor() as cursor:
            if _schema_already_applied(cursor):
                print("Schema already applied (users table exists) - nothing to do.")
                return

        with connection.cursor() as cursor:
            cursor.execute(schema_sql)
        connection.commit()
        print(f"Schema applied successfully from {SCHEMA_FILE}.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Database initialization failed: {error}", file=sys.stderr)
        sys.exit(1)
