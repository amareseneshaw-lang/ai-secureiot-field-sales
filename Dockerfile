# Multi-stage build producing a single image that serves both the built frontend and
# the API from one process/origin (see backend/app/main.py's conditional StaticFiles
# mount) - no CORS configuration is required as a result.

# ---- Stage 1: build the frontend -------------------------------------------------
FROM node:22-slim AS frontend-build

# Pinned to match .github/workflows/ci.yml's pnpm/action-setup version exactly.
RUN corepack enable && corepack prepare pnpm@11 --activate

WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/pnpm-lock.yaml dashboard/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY dashboard/ ./
RUN pnpm build

# ---- Stage 2: runtime ---------------------------------------------------------
FROM python:3.11-slim AS runtime

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY database/ database/
COPY scripts/ scripts/
COPY --from=frontend-build /app/dashboard/dist dashboard/dist

# Runs as an unprivileged user rather than the container default root.
RUN useradd --create-home --shell /bin/false appuser \
    && chown -R appuser:appuser /app
USER appuser

# 8000 is the local/docker-compose default; PaaS platforms such as Render inject their
# own PORT env var at run time and the process must bind to *that* port instead (Render
# routes traffic to whatever port the container actually listens on, not to 8000).
ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ['PORT'] + '/health', timeout=3)" || exit 1

# DATABASE_URL, JWT_SECRET_KEY, and (optionally) ANTHROPIC_API_KEY must be provided as
# environment variables at run time - see .env.example. Nothing is baked into this image.
#
# --forwarded-allow-ips='*': trusts X-Forwarded-* headers from the immediate connecting
# peer unconditionally. This is only safe because on a PaaS like Render the container has
# no ingress path other than Render's own edge proxy (there is no way for an external
# client to connect to this process directly) - the same pattern Heroku's own deployment
# docs recommend for identical reasons. Without this, request.client.host (used by the
# login audit log in backend/app/routes/auth.py) would record Render's internal proxy
# address for every request instead of the real client IP.
#
# Shell form (not exec form) so $PORT is expanded at container start.
CMD uvicorn backend.app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
