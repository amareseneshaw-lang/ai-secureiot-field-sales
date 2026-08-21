from fastapi import APIRouter, Depends, Query

from backend.app.auth.dependencies import require_role
from backend.app.database import get_connection

router = APIRouter(
    prefix="/api/v1/security-events",
    tags=["SecureIoT Security Events"],
    dependencies=[
        Depends(
            require_role(
                "SYSTEM_ADMIN", "SECURITY_ADMIN", "TECHNICIAN", "SALES_MANAGER", "FIELD_SALES"
            )
        )
    ],
)


# Security events are composed at the API layer from three real, existing sources rather
# than a new table: device/sensor events (iot_events, which already has severity), door
# access attempts (access_events, which has no severity/status so both are derived from
# `result`), and devices currently reporting OFFLINE (a derived "device offline" event,
# since there is no dedicated offline-event log table). Severity/status here are computed,
# not stored - per the decision to avoid a schema migration for this phase.
SECURITY_EVENTS_CTE = """
    WITH security_events AS (
        SELECT
            'IOT' AS source,
            ie.iot_event_id AS source_id,
            ie.device_id,
            ie.site_id,
            ie.event_type,
            ie.severity,
            CASE WHEN ie.processed THEN 'RESOLVED' ELSE 'OPEN' END AS status,
            ie.event_timestamp,
            ie.description
        FROM iot_events ie

        UNION ALL

        SELECT
            'ACCESS' AS source,
            ae.access_event_id AS source_id,
            NULL AS device_id,
            b.site_id,
            ae.event_type,
            CASE WHEN ae.result = 'DENIED' THEN 'MEDIUM' ELSE 'INFO' END AS severity,
            CASE WHEN ae.result = 'DENIED' THEN 'OPEN' ELSE 'RESOLVED' END AS status,
            ae.event_timestamp,
            'Access ' || lower(COALESCE(ae.result, 'unknown'))
                || COALESCE(' at ' || d.door_name, '') AS description
        FROM access_events ae
        LEFT JOIN doors d ON d.door_id = ae.door_id
        LEFT JOIN buildings b ON b.building_id = d.building_id

        UNION ALL

        SELECT
            'DEVICE_STATUS' AS source,
            dv.device_id AS source_id,
            dv.device_id,
            dv.site_id,
            'DEVICE_OFFLINE' AS event_type,
            CASE WHEN dv.health_status <> 'HEALTHY' THEN 'HIGH' ELSE 'MEDIUM' END AS severity,
            'OPEN' AS status,
            COALESCE(dv.last_seen_at, dv.updated_at) AS event_timestamp,
            dv.device_name || ' is reporting OFFLINE' AS description
        FROM devices dv
        WHERE dv.status = 'OFFLINE'
    )
"""


def _serialize_security_event(row) -> dict:
    return {
        "source": row[0],
        "source_id": row[1],
        "device_id": row[2],
        "site_id": row[3],
        "event_type": row[4],
        "severity": row[5],
        "status": row[6],
        "event_timestamp": row[7],
        "description": row[8],
    }


@router.get("/")
def list_security_events(
    site_id: int | None = None,
    severity: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    source: str | None = None,
    event_type: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    filters = []
    parameters = []
    for column, value in (
        ("site_id", site_id),
        ("severity", severity),
        ("status", status_filter),
        ("source", source),
        ("event_type", event_type),
    ):
        if value is not None:
            filters.append(f"{column} = %s")
            parameters.append(value)

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"{SECURITY_EVENTS_CTE} SELECT COUNT(*) FROM security_events{where_clause};",
                parameters,
            )
            total_count = cursor.fetchone()[0]

            cursor.execute(
                f"""
                {SECURITY_EVENTS_CTE}
                SELECT
                    source, source_id, device_id, site_id, event_type, severity, status,
                    event_timestamp, description
                FROM security_events
                {where_clause}
                ORDER BY event_timestamp DESC
                LIMIT %s OFFSET %s;
                """,
                [*parameters, limit, offset],
            )
            events = [_serialize_security_event(row) for row in cursor.fetchall()]

    return {
        "count": len(events),
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "security_events": events,
    }


@router.get("/summary")
def get_security_events_summary(site_id: int | None = None):
    where_clause = " WHERE site_id = %s" if site_id is not None else ""
    parameters = [site_id] if site_id is not None else []

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                {SECURITY_EVENTS_CTE}
                SELECT
                    severity,
                    status,
                    COUNT(*)
                FROM security_events
                {where_clause}
                GROUP BY severity, status
                ORDER BY severity, status;
                """,
                parameters,
            )
            breakdown = [
                {"severity": row[0], "status": row[1], "count": row[2]}
                for row in cursor.fetchall()
            ]

            cursor.execute(
                f"""
                {SECURITY_EVENTS_CTE}
                SELECT
                    COUNT(*) FILTER (WHERE status = 'OPEN') AS open_count,
                    COUNT(*) FILTER (WHERE severity IN ('HIGH', 'CRITICAL') AND status = 'OPEN')
                        AS critical_open_count
                FROM security_events
                {where_clause};
                """,
                parameters,
            )
            open_count, critical_open_count = cursor.fetchone()

    return {
        "open_count": open_count,
        "critical_open_count": critical_open_count,
        "breakdown": breakdown,
    }
