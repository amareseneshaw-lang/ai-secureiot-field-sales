from fastapi.testclient import TestClient

from backend.app.auth.security import create_access_token
from backend.app.main import app

client = TestClient(app)

# Real seeded users (see database/seed.sql). Tokens are minted directly rather than via
# POST /auth/login - see tests/test_ai_insights.py for why (TestClient's synthetic
# request.client.host breaks the login endpoint's audit-log INET column write).
ADMIN_USER = (1, "admin_demo", ["SYSTEM_ADMIN"])
SALES_MANAGER_USER = (2, "sales_manager_demo", ["SALES_MANAGER"])
FIELD_SALES_USER = (3, "field_sales_demo", ["FIELD_SALES"])
SECURITY_ADMIN_USER = (4, "security_admin_demo", ["SECURITY_ADMIN"])
TECHNICIAN_USER = (5, "technician_demo", ["TECHNICIAN"])

ALL_USERS = [
    ADMIN_USER,
    SALES_MANAGER_USER,
    FIELD_SALES_USER,
    SECURITY_ADMIN_USER,
    TECHNICIAN_USER,
]

SEEDED_SITE_ID = 1
SEEDED_CUSTOMER_ID = 1
SEEDED_DEVICE_ID = 2
UNKNOWN_ID = 999999


def _token_for(user: tuple) -> str:
    user_id, username, roles = user
    return create_access_token(subject=str(user_id), username=username, roles=roles)


def _auth_headers(user: tuple) -> dict:
    return {"Authorization": f"Bearer {_token_for(user)}"}


def _admin_headers() -> dict:
    return _auth_headers(ADMIN_USER)


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


def test_sites_requires_authentication():
    assert client.get("/api/v1/sites/").status_code == 401


def test_devices_requires_authentication():
    assert client.get("/api/v1/devices/").status_code == 401


def test_security_events_requires_authentication():
    assert client.get("/api/v1/security-events/").status_code == 401


def test_secureiot_dashboard_requires_authentication():
    assert client.get("/api/v1/secureiot/dashboard/summary").status_code == 401


# ---------------------------------------------------------------------------
# Role access: per decision #3, every role has at least read access to SecureIoT
# ---------------------------------------------------------------------------


def test_all_five_roles_can_read_sites():
    for user in ALL_USERS:
        response = client.get("/api/v1/sites/", headers=_auth_headers(user))
        assert response.status_code == 200, f"{user[1]} got {response.status_code}"


def test_all_five_roles_can_read_devices():
    for user in ALL_USERS:
        response = client.get("/api/v1/devices/", headers=_auth_headers(user))
        assert response.status_code == 200, f"{user[1]} got {response.status_code}"


def test_all_five_roles_can_read_security_events():
    for user in ALL_USERS:
        response = client.get("/api/v1/security-events/", headers=_auth_headers(user))
        assert response.status_code == 200, f"{user[1]} got {response.status_code}"


def test_all_five_roles_can_read_secureiot_dashboard():
    for user in ALL_USERS:
        response = client.get(
            "/api/v1/secureiot/dashboard/summary", headers=_auth_headers(user)
        )
        assert response.status_code == 200, f"{user[1]} got {response.status_code}"


def test_security_admin_and_technician_still_lack_crm_access():
    # Unchanged pre-existing behavior: SecureIoT access is new, CRM access is not.
    for user in (SECURITY_ADMIN_USER, TECHNICIAN_USER):
        response = client.get("/api/v1/customers/", headers=_auth_headers(user))
        assert response.status_code == 403, f"{user[1]} got {response.status_code}"


# ---------------------------------------------------------------------------
# Not found
# ---------------------------------------------------------------------------


def test_site_404_for_unknown_site():
    response = client.get(f"/api/v1/sites/{UNKNOWN_ID}", headers=_admin_headers())
    assert response.status_code == 404


def test_device_404_for_unknown_device():
    response = client.get(f"/api/v1/devices/{UNKNOWN_ID}", headers=_admin_headers())
    assert response.status_code == 404


def test_site_buildings_404_for_unknown_site():
    response = client.get(
        f"/api/v1/sites/{UNKNOWN_ID}/buildings/", headers=_admin_headers()
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Real data, real behavior
# ---------------------------------------------------------------------------


def test_sites_list_uses_real_seeded_data_with_device_counts():
    response = client.get("/api/v1/sites/", headers=_admin_headers())
    assert response.status_code == 200
    body = response.json()
    assert body["total_count"] == 3
    site = next(s for s in body["sites"] if s["site_id"] == SEEDED_SITE_ID)
    assert site["site_name"] == "Northstar Main Facility"
    assert site["device_count"] >= 2


def test_customer_sites_nested_endpoint_matches_sites_api():
    response = client.get(
        f"/api/v1/customers/{SEEDED_CUSTOMER_ID}/sites/", headers=_admin_headers()
    )
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["sites"][0]["site_name"] == "Northstar Main Facility"
    assert "device_count" in body["sites"][0]


def test_site_doors_handles_nullable_reader_assignment():
    response = client.get(
        f"/api/v1/sites/{SEEDED_SITE_ID}/doors/", headers=_admin_headers()
    )
    assert response.status_code == 200
    body = response.json()
    assert body["count"] >= 1
    for door in body["doors"]:
        assert "reader" in door
        if door["reader"] is not None:
            assert "reader_id" in door["reader"]


def test_device_telemetry_returns_real_readings():
    response = client.get(
        f"/api/v1/devices/{SEEDED_DEVICE_ID}/telemetry/", headers=_admin_headers()
    )
    assert response.status_code == 200
    body = response.json()
    assert body["count"] >= 1
    assert body["telemetry"][0]["metric_name"] == "temperature"


def test_security_events_severity_and_status_are_api_computed():
    response = client.get("/api/v1/security-events/", headers=_admin_headers())
    assert response.status_code == 200
    events = response.json()["security_events"]
    assert len(events) >= 4

    sources = {event["source"] for event in events}
    assert {"IOT", "ACCESS", "DEVICE_STATUS"}.issubset(sources)

    denied = next(e for e in events if e["event_type"] == "ACCESS_DENIED")
    assert denied["severity"] == "MEDIUM"
    assert denied["status"] == "OPEN"

    granted = next(e for e in events if e["event_type"] == "ACCESS_GRANTED")
    assert granted["severity"] == "INFO"
    assert granted["status"] == "RESOLVED"

    offline_event = next(e for e in events if e["source"] == "DEVICE_STATUS")
    assert offline_event["status"] == "OPEN"
    assert offline_event["severity"] in ("MEDIUM", "HIGH")


def test_security_events_filter_by_severity():
    response = client.get(
        "/api/v1/security-events/?severity=HIGH", headers=_admin_headers()
    )
    assert response.status_code == 200
    events = response.json()["security_events"]
    assert len(events) >= 1
    assert all(event["severity"] == "HIGH" for event in events)


def test_secureiot_dashboard_summary_reflects_real_counts():
    response = client.get(
        "/api/v1/secureiot/dashboard/summary", headers=_admin_headers()
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total_sites"] == 3
    assert body["total_devices"] >= 5
    assert body["offline_devices"] >= 1
    assert body["critical_open_events"] >= 1
    assert body["health_status"] in ("HEALTHY", "AT_RISK", "CRITICAL")
    assert len(body["sites_with_open_events"]) >= 1
