from fastapi import FastAPI

from backend.app.routes.customers import router as customers_router


app = FastAPI(
    title="AI SecureIoT Field Sales Platform",
    description="Enterprise-style CRM, IoT, access-control, AI, and field-sales platform.",
    version="1.0.0",
)

app.include_router(customers_router)


@app.get("/")
def root():
    return {
        "application": "AI SecureIoT Field Sales Platform",
        "status": "online",
        "version": "1.0.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }