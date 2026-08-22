"""Optional, explicit, one-time demo/development seed data loader.

Applies database/seed.sql - fictional demo accounts, customers, sites, devices, and
events (see docs/AUTH_DEMO_CREDENTIALS.md) - for portfolio/demo deployments only.
This is kept in its own module, separate from backend.app.database's schema-init
logic, specifically to keep "real schema, always safe to ensure exists" and "fake
demo data, only ever loaded on deliberate request" architecturally distinct.

This is never applied automatically. backend.app.main's startup hook only calls
apply_demo_seed_data() when the SEED_DEMO_DATA environment variable is explicitly
set to a truthy value - a deliberate choice made in your deployment platform's
environment variable settings (see docs/DEPLOYMENT.md). Never set this for a
deployment that holds, or will ever hold, real customer/user data.

Safety guarantees:
- Idempotent: if the `users` table already has any row - whether from a previous
  run of this loader or from real accounts created some other way - this does
  nothing and returns False. It never inserts duplicate rows and never touches
  existing data. Safe to leave SEED_DEMO_DATA set across restarts/redeploys: it
  will only ever actually load data the first time.
- Never drops or alters existing tables/rows - database/seed.sql is exclusively
  INSERT statements.
- Requires the schema to already exist (see backend.app.database.initialize_schema,
  called first in the same startup hook) - this does not create tables itself.
"""

import os
from pathlib import Path

import psycopg

from backend.app.database import DATABASE_URL

SEED_FILE = Path(__file__).resolve().parents[2] / "database" / "seed.sql"

SEED_DEMO_DATA_ENV_VAR = "SEED_DEMO_DATA"


def demo_seed_requested() -> bool:
    """Whether SEED_DEMO_DATA is explicitly set to a truthy value.

    Must be a deliberate operator action (e.g. an env var set in the Render
    dashboard) - never inferred, never on by default.
    """
    return os.getenv(SEED_DEMO_DATA_ENV_VAR, "").strip().lower() in ("1", "true", "yes")


def _has_existing_data(cursor: psycopg.Cursor) -> bool:
    cursor.execute("SELECT EXISTS (SELECT 1 FROM users LIMIT 1);")
    row = cursor.fetchone()
    return bool(row and row[0])


def apply_demo_seed_data() -> bool:
    """Applies database/seed.sql if (and only if) the `users` table is empty.

    Returns True if it applied the seed data, False if it skipped because data
    already existed (a safe no-op, not an error).
    """
    with psycopg.connect(DATABASE_URL) as connection:
        with connection.cursor() as cursor:
            if _has_existing_data(cursor):
                return False

            seed_sql = SEED_FILE.read_text(encoding="utf-8")
            cursor.execute(seed_sql)
        connection.commit()
    return True
