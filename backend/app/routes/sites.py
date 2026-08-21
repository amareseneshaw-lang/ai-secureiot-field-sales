from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.auth.dependencies import require_role
from backend.app.database import get_connection
from backend.app.routes.devices import DEVICE_COLUMNS, _serialize_device

router = APIRouter(
    prefix="/api/v1/sites",
    tags=["SecureIoT Sites"],
    dependencies=[
        Depends(
            require_role(
                "SYSTEM_ADMIN", "SECURITY_ADMIN", "TECHNICIAN", "SALES_MANAGER", "FIELD_SALES"
            )
        )
    ],
)


SITE_COLUMNS = """
    site_id,
    customer_id,
    site_name,
    site_type,
    address,
    city,
    state,
    postal_code,
    country,
    latitude,
    longitude,
    status,
    assigned_technician_id,
    created_at,
    updated_at
"""


def _serialize_site(row) -> dict:
    return {
        "site_id": row[0],
        "customer_id": row[1],
        "site_name": row[2],
        "site_type": row[3],
        "address": row[4],
        "city": row[5],
        "state": row[6],
        "postal_code": row[7],
        "country": row[8],
        "latitude": float(row[9]) if row[9] is not None else None,
        "longitude": float(row[10]) if row[10] is not None else None,
        "status": row[11],
        "assigned_technician_id": row[12],
        "created_at": row[13],
        "updated_at": row[14],
    }


BUILDING_COLUMNS = """
    building_id,
    site_id,
    building_name,
    building_type,
    floor_count,
    description,
    created_at,
    updated_at
"""


def _serialize_building(row) -> dict:
    return {
        "building_id": row[0],
        "site_id": row[1],
        "building_name": row[2],
        "building_type": row[3],
        "floor_count": row[4],
        "description": row[5],
        "created_at": row[6],
        "updated_at": row[7],
    }


def _require_site(cursor, site_id: int) -> None:
    cursor.execute("SELECT 1 FROM sites WHERE site_id = %s;", (site_id,))
    if cursor.fetchone() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site {site_id} was not found.",
        )


def _get_site_row(cursor, site_id: int):
    cursor.execute(f"SELECT {SITE_COLUMNS} FROM sites WHERE site_id = %s;", (site_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site {site_id} was not found.",
        )
    return row


@router.get("/")
def list_sites(
    customer_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    site_type: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    filters = []
    parameters = []
    for column, value in (
        ("s.customer_id", customer_id),
        ("s.status", status_filter),
        ("s.site_type", site_type),
    ):
        if value is not None:
            filters.append(f"{column} = %s")
            parameters.append(value)

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT COUNT(*) FROM sites s{where_clause};",
                parameters,
            )
            total_count = cursor.fetchone()[0]

            site_columns = ", ".join(f"s.{column.strip()}" for column in SITE_COLUMNS.strip().split(","))
            cursor.execute(
                f"""
                SELECT
                    {site_columns},
                    COUNT(DISTINCT dv.device_id) AS device_count,
                    COUNT(DISTINCT dv.device_id) FILTER (WHERE dv.status = 'OFFLINE')
                        AS offline_device_count
                FROM sites s
                LEFT JOIN devices dv ON dv.site_id = s.site_id
                {where_clause}
                GROUP BY s.site_id
                ORDER BY s.site_id
                LIMIT %s OFFSET %s;
                """,
                [*parameters, limit, offset],
            )
            sites = []
            for row in cursor.fetchall():
                site = _serialize_site(row[:15])
                site["device_count"] = row[15]
                site["offline_device_count"] = row[16]
                sites.append(site)

    return {
        "count": len(sites),
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "sites": sites,
    }


@router.get("/{site_id}")
def get_site(site_id: int):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            row = _get_site_row(cursor, site_id)
    return _serialize_site(row)


@router.get("/{site_id}/buildings/")
def list_site_buildings(site_id: int):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            _require_site(cursor, site_id)
            cursor.execute(
                f"""
                SELECT {BUILDING_COLUMNS}
                FROM buildings
                WHERE site_id = %s
                ORDER BY building_id;
                """,
                (site_id,),
            )
            buildings = [_serialize_building(row) for row in cursor.fetchall()]

    return {
        "count": len(buildings),
        "buildings": buildings,
    }


@router.get("/{site_id}/doors/")
def list_site_doors(site_id: int):
    # readers.door_id is nullable (a reader can exist unassigned, e.g. newly installed
    # hardware not yet commissioned to a door), so this must LEFT JOIN readers rather than
    # INNER JOIN, or a door without its reader wired up yet would silently disappear.
    with get_connection() as connection:
        with connection.cursor() as cursor:
            _require_site(cursor, site_id)
            cursor.execute(
                """
                SELECT
                    d.door_id,
                    d.building_id,
                    d.door_name,
                    d.door_type,
                    d.location_description,
                    d.status,
                    d.controller_id,
                    r.reader_id,
                    r.reader_name,
                    r.reader_type,
                    r.status
                FROM doors d
                JOIN buildings b ON b.building_id = d.building_id
                LEFT JOIN readers r ON r.door_id = d.door_id
                WHERE b.site_id = %s
                ORDER BY d.door_id;
                """,
                (site_id,),
            )
            doors = [
                {
                    "door_id": row[0],
                    "building_id": row[1],
                    "door_name": row[2],
                    "door_type": row[3],
                    "location_description": row[4],
                    "status": row[5],
                    "controller_id": row[6],
                    "reader": (
                        None
                        if row[7] is None
                        else {
                            "reader_id": row[7],
                            "reader_name": row[8],
                            "reader_type": row[9],
                            "status": row[10],
                        }
                    ),
                }
                for row in cursor.fetchall()
            ]

    return {
        "count": len(doors),
        "doors": doors,
    }


@router.get("/{site_id}/devices/")
def list_site_devices(site_id: int):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            _require_site(cursor, site_id)
            cursor.execute(
                f"""
                SELECT {DEVICE_COLUMNS}
                FROM devices
                WHERE site_id = %s
                ORDER BY device_id;
                """,
                (site_id,),
            )
            devices = [_serialize_device(row) for row in cursor.fetchall()]

    return {
        "count": len(devices),
        "devices": devices,
    }
