"""Manual/local CLI wrapper for the schema initializer.

The application itself now applies database/schema.sql automatically and
idempotently on startup (see backend.app.database.initialize_schema, called
from backend.app.main's lifespan hook) - this script exists for cases where you
want to initialize a database without starting the full app, e.g. local setup
or the docker-compose workflow in docs/DEPLOYMENT.md.

Deliberately never applies database/seed.sql - that file contains fictional
demo accounts and passwords (see docs/AUTH_DEMO_CREDENTIALS.md) for local
development only and must never be loaded into a production database.

Usage (run from the repository root, so backend.app.database is importable):
    DATABASE_URL=postgresql://user:pass@host:5432/db python -m scripts.init_db
"""

import sys

from backend.app.database import SCHEMA_FILE, initialize_schema


def main() -> None:
    if initialize_schema():
        print(f"Schema applied successfully from {SCHEMA_FILE}.")
    else:
        print("Schema already applied (users table exists) - nothing to do.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Database initialization failed: {error}", file=sys.stderr)
        sys.exit(1)
