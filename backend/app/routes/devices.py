from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.auth.dependencies import require_role
from backend.app.database import get_connection

router = APIRouter(
    prefix="/api/v1/devices",
    tags=["SecureIoT Devices"],
    dependencies=[
        Depends(
            require_role(
                "SYSTEM_ADMIN", "SECURITY_ADMIN", "TECHNICIAN", "SALES_MANAGER", "FIELD_SALES"
            )
        )
    ],
)


DEVICE_COLUMNS = """
    device_id,
    site_id,
    device_name,
    device_type,
    manufacturer,
    model,
    serial_number,
    firmware_version,
    status,
    health_status,
    last_seen_at,
    installed_at,
    created_at,
    updated_at
"""


def _serialize_device(row) -> dict:
    return {
        "device_id": row[0],
        "site_id": row[1],
        "device_name": row[2],
        "device_type": row[3],
        "manufacturer": row[4],
        "model": row[5],
        "serial_number": row[6],
        "firmware_version": row[7],
        "status": row[8],
        "health_status": row[9],
        "last_seen_at": row[10],
        "installed_at": row[11],
        "created_at": row[12],
        "updated_at": row[13],
    }


TELEMETRY_COLUMNS = """
    telemetry_id,
    device_id,
    timestamp,
    metric_name,
    metric_value,
    unit,
    quality
"""


def _serialize_telemetry(row) -> dict:
    return {
        "telemetry_id": row[0],
        "device_id": row[1],
        "timestamp": row[2],
        "metric_name": row[3],
        "metric_value": float(row[4]) if row[4] is not None else None,
        "unit": row[5],
        "quality": row[6],
    }


def _require_device(cursor, device_id: int) -> None:
    cursor.execute("SELECT 1 FROM devices WHERE device_id = %s;", (device_id,))
    if cursor.fetchone() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} was not found.",
        )


def _get_device_row(cursor, device_id: int):
    cursor.execute(f"SELECT {DEVICE_COLUMNS} FROM devices WHERE device_id = %s;", (device_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} was not found.",
        )
    return row


@router.get("/")
def list_devices(
    site_id: int | None = None,
    device_type: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    health_status: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    filters = []
    parameters = []
    for column, value in (
        ("site_id", site_id),
        ("device_type", device_type),
        ("status", status_filter),
        ("health_status", health_status),
    ):
        if value is not None:
            filters.append(f"{column} = %s")
            parameters.append(value)

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT COUNT(*) FROM devices{where_clause};",
                parameters,
            )
            total_count = cursor.fetchone()[0]
            cursor.execute(
                f"""
                SELECT {DEVICE_COLUMNS}
                FROM devices
                {where_clause}
                ORDER BY device_id
                LIMIT %s OFFSET %s;
                """,
                [*parameters, limit, offset],
            )
            devices = [_serialize_device(row) for row in cursor.fetchall()]

    return {
        "count": len(devices),
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "devices": devices,
    }


@router.get("/{device_id}")
def get_device(device_id: int):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            row = _get_device_row(cursor, device_id)
    return _serialize_device(row)


@router.get("/{device_id}/telemetry/")
def list_device_telemetry(
    device_id: int,
    limit: int = Query(default=20, ge=1, le=100),
):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            _require_device(cursor, device_id)
            cursor.execute(
                f"""
                SELECT {TELEMETRY_COLUMNS}
                FROM device_telemetry
                WHERE device_id = %s
                ORDER BY timestamp DESC
                LIMIT %s;
                """,
                (device_id, limit),
            )
            telemetry = [_serialize_telemetry(row) for row in cursor.fetchall()]

    return {
        "count": len(telemetry),
        "telemetry": telemetry,
    }
