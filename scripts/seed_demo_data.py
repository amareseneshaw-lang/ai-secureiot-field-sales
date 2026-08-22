"""Manual/local CLI wrapper for the demo/portfolio seed data loader.

Unlike scripts/init_db.py, this always applies database/seed.sql (subject to the
same idempotency guard as the app's own opt-in loader - see
backend.app.demo_seed) - it does not check the SEED_DEMO_DATA environment
variable, since running this script *is* the explicit action. Use this for local
setup or the docker-compose.yml workflow in docs/DEPLOYMENT.md; the running
application itself only loads demo data when SEED_DEMO_DATA=true is set in its
environment (see backend/app/main.py's startup hook).

Loads FICTIONAL demo accounts and passwords (see docs/AUTH_DEMO_CREDENTIALS.md).
Never run this against a database that holds, or will ever hold, real data.

Usage (run from the repository root, so backend.app is importable):
    DATABASE_URL=postgresql://user:pass@host:5432/db python -m scripts.seed_demo_data
"""

import sys

from backend.app.demo_seed import SEED_FILE, apply_demo_seed_data


def main() -> None:
    if apply_demo_seed_data():
        print(f"Demo seed data applied successfully from {SEED_FILE}.")
    else:
        print("Data already present (users table is non-empty) - nothing to do.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Demo seed data initialization failed: {error}", file=sys.stderr)
        sys.exit(1)
