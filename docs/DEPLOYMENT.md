# Production Deployment

Same-origin architecture: one process serves both the built frontend and the
`/api/v1/*` API from a single origin, so **no CORS configuration is required**. See
`backend/app/main.py` - if `dashboard/dist/` exists (built by CI/Docker), it's mounted
at `/`; otherwise `/` returns a plain JSON status response, which is what happens in
local development (the frontend is served separately by the Vite dev server instead).

## Required environment variables

Set these through your platform's secret manager - never via a checked-in `.env` file.
See `.env.example` for the full annotated list. Summary:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db`. Add `?sslmode=require` if your provider needs it. |
| `JWT_SECRET_KEY` | Yes | Generate a fresh value for production: `python -c "import secrets; print(secrets.token_hex(32))"`. Never reuse the CI value (`.github/workflows/ci.yml`) or a dev value. |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | No | Defaults to 60. |
| `ANTHROPIC_API_KEY` | Only if using the AI Insight feature | Server-side only - never sent to the frontend. The rest of the API works without it. |
| `AI_MODEL`, `AI_REQUEST_TIMEOUT_SECONDS` | No | Defaults are `claude-sonnet-5` / `20`. |
| `SEED_DEMO_DATA` | No - **only for demo/portfolio deployments** | See "Schema and demo data initialization" below. Never set this for a deployment that holds, or will ever hold, real data. |

## Schema and demo data initialization

Two independent, both-safe-by-default mechanisms, both in `backend/app/main.py`'s
FastAPI lifespan hook (run on every process start, including Render free-tier
spin-down/spin-up cycles):

**1. Schema - always automatic, always safe.**
`backend.app.database.initialize_schema()` applies `database/schema.sql` only if
the `users` table doesn't already exist; otherwise it's a no-op. Never drops or
alters anything. Runs unconditionally - no environment variable needed - so a brand
new database is initialized on first boot with no manual step and no pre-deploy
hook, working identically on Render's free plan and any paid plan.

**2. Demo/portfolio seed data - opt-in, one-time, and clearly separated.**
`backend.app.demo_seed.apply_demo_seed_data()` applies `database/seed.sql`
(fictional accounts, customers, sites, devices, and events - see
`docs/AUTH_DEMO_CREDENTIALS.md`) but **only when the `SEED_DEMO_DATA` environment
variable is explicitly set to `true`**, and even then only if the `users` table is
still empty. Deliberately kept in its own module, separate from schema
initialization, so "always-safe real schema" and "opt-in fake demo data" can never
be confused. Safety guarantees:
- **Never applied by default.** Unset (the default on a fresh Render deploy from
  `render.yaml`) means schema-only, zero rows, on every restart.
- **Never duplicates.** If any row already exists in `users` - whether from a
  previous run of this loader or real accounts created some other way - it does
  nothing. Safe to leave `SEED_DEMO_DATA=true` set indefinitely; it only ever loads
  data the first time.
- **Never drops or overwrites anything.** `database/seed.sql` is exclusively
  `INSERT` statements.

Both paths are also available without starting the full app, e.g. for local setup
or the `docker-compose.yml` workflow below:

```
DATABASE_URL=postgresql://... python -m scripts.init_db          # schema only
DATABASE_URL=postgresql://... python -m scripts.seed_demo_data   # + demo data
```

## Building and running the production image

```
docker build -t ai-secureiot .
docker run -p 8000:8000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET_KEY=... \
  -e ANTHROPIC_API_KEY=...  \
  ai-secureiot
```

The image is a multi-stage build: stage 1 builds the frontend (`pnpm build`), stage 2 is
a slim Python runtime that copies in the built `dashboard/dist/` alongside the backend
code, so the same-origin static mount activates automatically. Nothing in the image
contains secrets - all three variables above are supplied at run time only.

`docker-compose.yml` is provided for local testing of this same image against a real
Postgres container (`docker compose up --build`, then `docker compose exec app python -m
scripts.init_db`) - it is not a deployment mechanism.

## Deploying on Render

`render.yaml` at the repo root is a Render Blueprint that defines exactly this
architecture: one Docker web service (frontend + `/api/*` same-origin, per
`backend/app/main.py`) plus one managed PostgreSQL database, wired together
automatically.

**First-deployment procedure:**
1. In the Render dashboard: **New +** → **Blueprint** → point it at this repo/branch.
   Render reads `render.yaml` and proposes the `ai-secureiot-db` database and
   `ai-secureiot-field-sales` web service, both on the **free** plan (no billing).
2. Apply the blueprint. Render provisions the database first, then builds the web
   service from `Dockerfile`.
3. `DATABASE_URL` is wired automatically (`fromDatabase: ai-secureiot-db` →
   `connectionString`) - Render's managed Postgres exposes both an internal and
   external connection string; the blueprint uses the internal one, which is correct
   for the web service reaching the database over Render's private network.
4. `JWT_SECRET_KEY` is generated automatically by Render (`generateValue: true`) on
   first deploy - a real, random, production-only secret, never a value from this
   repo, `.env`, or CI.
5. On this first boot, the app's startup hook applies `database/schema.sql`
   automatically (see "Schema and demo data initialization" above) - no action
   needed, works on the free plan with no `preDeployCommand`.
6. **This is a demo/portfolio deployment, so you'll usually want the demo data
   visible.** In the web service's **Environment** tab, add `SEED_DEMO_DATA` = `true`,
   then save. Render redeploys automatically; on that redeploy, the startup hook loads
   `database/seed.sql` exactly once (empty-`users`-table guard - see above). Skip this
   step entirely if you want an empty schema instead.
7. *(Optional)* Add `ANTHROPIC_API_KEY` the same way in the **Environment** tab to
   enable the AI Insight feature - left unset by the blueprint (`sync: false`), never
   written to `render.yaml` or any other file.
8. **Build command / start command**: not set separately - Render's `runtime: docker`
   builds `Dockerfile` directly, so the build command is Docker's own multi-stage
   build (`pnpm build` for the frontend, `pip install` for the backend) and the start
   command is the Dockerfile's `CMD` (`uvicorn ... --port "${PORT:-8000}"`, reading
   Render's dynamically assigned `PORT`).

No `preDeployCommand`, no Shell/SSH, and no step above requires anything beyond the
Render dashboard's standard Environment tab - all compatible with the free plan.

**Proxy headers on Render (resolved):** the `Dockerfile`'s `CMD` already sets
`--forwarded-allow-ips='*'` alongside `--proxy-headers`. This is safe specifically on
Render (and equivalent single-ingress PaaS platforms) because the container has no
network path reachable except through Render's own edge proxy - there is no way for a
client to reach the app directly and spoof `X-Forwarded-For`. This makes
`request.client.host` (used by the login audit log in `backend/app/routes/auth.py`)
reflect the real client IP correctly. If you ever deploy the same image behind a
*different* topology where the container is also directly reachable, revisit this - it
would no longer be safe there.

## Alternative platforms

Railway or Fly.io both also provision managed Postgres and can build the same
`Dockerfile` directly; `render.yaml` is Render-specific, but nothing about the
`Dockerfile` or application code is Render-only.

## CI

`.github/workflows/ci.yml` runs the backend test suite against a real ephemeral
`postgres:16` service container with schema + seed data applied before `pytest` runs,
using throwaway credentials scoped to that workflow run only - unrelated to and never
reused by the Render deployment above.

## Known gaps not addressed by this deployment plumbing

These were flagged in the production-readiness audit and intentionally left as-is here,
since they're operational/scaling decisions rather than blockers for a first deploy:

- **No DB connection pooling** (`backend/app/database.py` opens a new connection per
  request) - fine at low traffic, worth revisiting under real load.
- **No rate limiting** on `/api/v1/auth/login`.
- **No migration framework** - schema changes are still hand-written SQL files with no
  version tracking beyond `git log`.
- **`/docs` and `/redoc`** (FastAPI's interactive API docs) are public by default -
  decide deliberately whether to disable them (`docs_url=None` in `main.py`) for
  production.
