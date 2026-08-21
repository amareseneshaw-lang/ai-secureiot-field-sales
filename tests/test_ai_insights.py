from fastapi.testclient import TestClient

from backend.app.ai import client as ai_client
from backend.app.ai.schemas import CustomerSummary, OpportunityInsight
from backend.app.auth.security import create_access_token
from backend.app.main import app

client = TestClient(app)

SEEDED_OPPORTUNITY_ID = 1
SEEDED_CUSTOMER_ID = 1
UNKNOWN_ID = 999999

# Real seeded users (see database/seed.sql / docs/AUTH_DEMO_CREDENTIALS.md). Tokens are
# minted directly here rather than via POST /auth/login to avoid coupling these tests to
# the login endpoint's audit-log write, which starlette's TestClient cannot satisfy (it
# sends request.client.host as the literal string "testclient", which the audit_logs.ip_address
# INET column rejects - a pre-existing quirk of the test client against real HTTP clients,
# unrelated to the AI feature under test). Login itself is covered by the app's own auth tests.
ADMIN_USER = (1, "admin_demo", ["SYSTEM_ADMIN"])
SECURITY_ADMIN_USER = (4, "security_admin_demo", ["SECURITY_ADMIN"])
TECHNICIAN_USER = (5, "technician_demo", ["TECHNICIAN"])


def _token_for(user: tuple) -> str:
    user_id, username, roles = user
    return create_access_token(subject=str(user_id), username=username, roles=roles)


def _auth_headers(user: tuple) -> dict:
    return {"Authorization": f"Bearer {_token_for(user)}"}


def _admin_headers() -> dict:
    return _auth_headers(ADMIN_USER)


# ---------------------------------------------------------------------------
# Authentication / authorization
# ---------------------------------------------------------------------------


def test_opportunity_insight_requires_authentication():
    response = client.get(f"/api/v1/ai/opportunities/{SEEDED_OPPORTUNITY_ID}/insight")
    assert response.status_code == 401


def test_customer_summary_requires_authentication():
    response = client.get(f"/api/v1/ai/customers/{SEEDED_CUSTOMER_ID}/summary")
    assert response.status_code == 401


def test_opportunity_insight_rejects_role_without_crm_access():
    # security_admin_demo has no CRM access per docs/AUTH_DEMO_CREDENTIALS.md.
    response = client.get(
        f"/api/v1/ai/opportunities/{SEEDED_OPPORTUNITY_ID}/insight",
        headers=_auth_headers(SECURITY_ADMIN_USER),
    )
    assert response.status_code == 403


def test_customer_summary_rejects_role_without_crm_access():
    response = client.get(
        f"/api/v1/ai/customers/{SEEDED_CUSTOMER_ID}/summary",
        headers=_auth_headers(TECHNICIAN_USER),
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Not found
# ---------------------------------------------------------------------------


def test_opportunity_insight_404_for_unknown_opportunity():
    response = client.get(
        f"/api/v1/ai/opportunities/{UNKNOWN_ID}/insight", headers=_admin_headers()
    )
    assert response.status_code == 404


def test_customer_summary_404_for_unknown_customer():
    response = client.get(f"/api/v1/ai/customers/{UNKNOWN_ID}/summary", headers=_admin_headers())
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Safe failure handling when the AI provider is not configured
# ---------------------------------------------------------------------------


def test_opportunity_insight_returns_503_when_ai_not_configured(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(ai_client, "_client", None)

    response = client.get(
        f"/api/v1/ai/opportunities/{SEEDED_OPPORTUNITY_ID}/insight", headers=_admin_headers()
    )

    assert response.status_code == 503
    detail = response.json()["detail"]
    assert "not configured" in detail.lower()
    # The error must never leak provider/internal details.
    assert "ANTHROPIC_API_KEY" not in detail
    assert "Traceback" not in detail


# ---------------------------------------------------------------------------
# Success path against real seeded CRM data (AI provider mocked)
# ---------------------------------------------------------------------------


def test_opportunity_insight_uses_real_seeded_crm_data(monkeypatch):
    captured_context: dict = {}

    def fake_generate(context: dict) -> OpportunityInsight:
        captured_context.update(context)
        return OpportunityInsight(
            risk_level="LOW",
            recommended_action="Schedule a technical demonstration.",
            reasoning=[
                "Site assessment completed",
                "Technical requirements documented",
                "Opportunity is in Technical Discovery",
            ],
            suggested_follow_up="Contact the decision maker within 2 business days.",
            confidence=0.78,
            data_sufficiency="SUFFICIENT",
            caveats=[],
        )

    monkeypatch.setattr(
        "backend.app.routes.ai_insights.generate_opportunity_insight", fake_generate
    )

    response = client.get(
        f"/api/v1/ai/opportunities/{SEEDED_OPPORTUNITY_ID}/insight", headers=_admin_headers()
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["risk_level"] == "LOW"
    assert body["recommended_action"] == "Schedule a technical demonstration."
    assert body["data_sufficiency"] == "SUFFICIENT"

    # The context handed to the model must be built entirely from real seeded rows -
    # nothing fabricated, nothing PII beyond what's already business-facing.
    assert captured_context["opportunity"]["name"] == "Access Control Modernization"
    assert captured_context["opportunity"]["sales_stage"] == "TECHNICAL_DISCOVERY"
    assert captured_context["opportunity"]["estimated_value"] == 185000.0
    assert captured_context["opportunity"]["probability"] == 78.0
    assert captured_context["customer"]["company_name"] == "Northstar Manufacturing"
    assert any(
        "Legacy access system" in (visit.get("pain_points") or "")
        for visit in captured_context["field_visits"]
    )
    assert "password_hash" not in captured_context["customer"]
    assert "email" not in captured_context["customer"]
    assert "phone" not in captured_context["customer"]


def test_customer_summary_uses_real_seeded_crm_data(monkeypatch):
    captured_context: dict = {}

    def fake_generate(context: dict) -> CustomerSummary:
        captured_context.update(context)
        return CustomerSummary(
            summary="Northstar Manufacturing is progressing through a modernization deal.",
            current_situation="One opportunity is in Technical Discovery.",
            key_risks=[],
            key_opportunities=["Site assessment already completed."],
            recommended_next_step="Schedule a technical demonstration.",
            confidence=0.7,
            data_sufficiency="SUFFICIENT",
            caveats=[],
        )

    monkeypatch.setattr(
        "backend.app.routes.ai_insights.generate_customer_summary", fake_generate
    )

    response = client.get(
        f"/api/v1/ai/customers/{SEEDED_CUSTOMER_ID}/summary", headers=_admin_headers()
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["data_sufficiency"] == "SUFFICIENT"
    assert captured_context["customer"]["company_name"] == "Northstar Manufacturing"
    assert any(
        opp["name"] == "Access Control Modernization" for opp in captured_context["opportunities"]
    )
