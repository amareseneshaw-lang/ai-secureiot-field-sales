from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.app.routes.activities import router as activities_router
from backend.app.routes.ai_insights import router as ai_insights_router
from backend.app.routes.auth import router as auth_router
from backend.app.routes.customers import router as customers_router
from backend.app.routes.devices import router as devices_router
from backend.app.routes.field_visits import router as field_visits_router
from backend.app.routes.opportunities import router as opportunities_router
from backend.app.routes.secureiot_dashboard import router as secureiot_dashboard_router
from backend.app.routes.security_events import router as security_events_router
from backend.app.routes.sites import router as sites_router


app = FastAPI(
    title="AI SecureIoT Field Sales Platform",
    description="Enterprise-style CRM, IoT, access-control, AI, and field-sales platform.",
    version="1.0.0",
)

app.include_router(auth_router)
app.include_router(customers_router)
app.include_router(field_visits_router)
app.include_router(opportunities_router)
app.include_router(activities_router)
app.include_router(ai_insights_router)
app.include_router(sites_router)
app.include_router(devices_router)
app.include_router(security_events_router)
app.include_router(secureiot_dashboard_router)


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


# Same-origin production serving: if the frontend has been built (dashboard/dist exists,
# e.g. via `pnpm build` in CI/the Docker image), serve it directly from this app so the
# browser never needs a cross-origin request and no CORS configuration is required. This
# is intentionally conditional - in local development the frontend is served by the
# separate Vite dev server (see dashboard/vite.config.ts's proxy), and dashboard/dist
# typically doesn't exist, so "/" keeps returning the plain API status response below.
# Routes registered above (including /health and every /api/v1/* router) are matched
# before this mount, so they are never shadowed by static file serving.
FRONTEND_DIST_DIR = Path(__file__).resolve().parents[2] / "dashboard" / "dist"

if FRONTEND_DIST_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST_DIR, html=True), name="frontend")
else:

    @app.get("/")
    def root():
        return {
            "application": "AI SecureIoT Field Sales Platform",
            "status": "online",
            "version": "1.0.0",
        }
