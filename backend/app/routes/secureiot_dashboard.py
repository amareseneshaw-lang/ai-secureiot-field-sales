from fastapi import APIRouter, Depends

from backend.app.auth.dependencies import require_role
from backend.app.database import get_connection
from backend.app.routes.security_events import SECURITY_EVENTS_CTE

router = APIRouter(
    prefix="/api/v1/secureiot/dashboard",
    tags=["SecureIoT Dashboard"],
    dependencies=[
        Depends(
            require_role(
                "SYSTEM_ADMIN", "SECURITY_ADMIN", "TECHNICIAN", "SALES_MANAGER", "FIELD_SALES"
            )
        )
    ],
)


@router.get("/summary")
def get_secureiot_dashboard_summary():
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM sites;")
            total_sites = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT
                    COUNT(*) AS total_devices,
                    COUNT(*) FILTER (WHERE status = 'ONLINE') AS online_devices,
                    COUNT(*) FILTER (WHERE status = 'OFFLINE') AS offline_devices
                FROM devices;
                """
            )
            total_devices, online_devices, offline_devices = cursor.fetchone()

            cursor.execute(
                f"""
                {SECURITY_EVENTS_CTE}
                SELECT
                    COUNT(*) FILTER (WHERE status = 'OPEN') AS open_count,
                    COUNT(*) FILTER (WHERE severity IN ('HIGH', 'CRITICAL') AND status = 'OPEN')
                        AS critical_open_count
                FROM security_events;
                """
            )
            open_events, critical_open_events = cursor.fetchone()

            cursor.execute(
                f"""
                {SECURITY_EVENTS_CTE}
                SELECT s.site_id, s.site_name, COUNT(*) FILTER (WHERE se.status = 'OPEN')
                    AS open_count
                FROM security_events se
                JOIN sites s ON s.site_id = se.site_id
                GROUP BY s.site_id, s.site_name
                HAVING COUNT(*) FILTER (WHERE se.status = 'OPEN') > 0
                ORDER BY open_count DESC
                LIMIT 5;
                """
            )
            sites_with_open_events = [
                {"site_id": row[0], "site_name": row[1], "open_count": row[2]}
                for row in cursor.fetchall()
            ]

    # Health score/status are a simple, transparent v1 heuristic computed here at the API
    # layer (not stored) - offline devices and open/critical security events each reduce
    # the score. Not a predictive model; just a readable rollup for the dashboard tile.
    offline_ratio = (offline_devices / total_devices) if total_devices else 0
    health_score = max(
        0,
        round(100 - offline_ratio * 40 - critical_open_events * 20 - open_events * 5),
    )
    if critical_open_events > 0:
        health_status = "CRITICAL"
    elif open_events > 0 or offline_devices > 0:
        health_status = "AT_RISK"
    else:
        health_status = "HEALTHY"

    return {
        "total_sites": total_sites,
        "total_devices": total_devices,
        "online_devices": online_devices,
        "offline_devices": offline_devices,
        "open_security_events": open_events,
        "critical_open_events": critical_open_events,
        "health_score": health_score,
        "health_status": health_status,
        "sites_with_open_events": sites_with_open_events,
    }
