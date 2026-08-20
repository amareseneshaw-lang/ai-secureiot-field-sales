from datetime import date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.app.database import get_connection


router = APIRouter(
    prefix="/api/v1/field-visits",
    tags=["Field Visits"],
)


VISIT_TYPES = frozenset(
    {
        "DISCOVERY",
        "FIELD_VISIT",
        "SITE_ASSESSMENT",
        "TECHNICAL_DISCOVERY",
        "FOLLOW_UP",
    }
)


class FieldVisitCreate(BaseModel):
    customer_id: int
    visit_date: datetime
    site_id: int | None = None
    sales_rep_id: int | None = None
    visit_type: str | None = None
    purpose: str | None = None
    customer_needs: str | None = None
    pain_points: str | None = None
    existing_system: str | None = None
    door_count: int | None = Field(default=None, ge=0)
    employee_count: int | None = Field(default=None, ge=0)
    technical_requirements: str | None = None
    recommended_solution: str | None = None
    next_action: str | None = None
    follow_up_date: date | None = None


class FieldVisitUpdate(BaseModel):
    site_id: int | None = None
    sales_rep_id: int | None = None
    visit_date: datetime | None = None
    visit_type: str | None = None
    purpose: str | None = None
    customer_needs: str | None = None
    pain_points: str | None = None
    existing_system: str | None = None
    door_count: int | None = Field(default=None, ge=0)
    employee_count: int | None = Field(default=None, ge=0)
    technical_requirements: str | None = None
    recommended_solution: str | None = None
    next_action: str | None = None
    follow_up_date: date | None = None


FIELD_VISIT_COLUMNS = """
    visit_id,
    customer_id,
    site_id,
    sales_rep_id,
    visit_date,
    visit_type,
    purpose,
    customer_needs,
    pain_points,
    existing_system,
    door_count,
    employee_count,
    technical_requirements,
    recommended_solution,
    next_action,
    follow_up_date,
    created_at,
    updated_at
"""


def _serialize_field_visit(row):
    return {
        "visit_id": row[0],
        "customer_id": row[1],
        "site_id": row[2],
        "sales_rep_id": row[3],
        "visit_date": row[4],
        "visit_type": row[5],
        "purpose": row[6],
        "customer_needs": row[7],
        "pain_points": row[8],
        "existing_system": row[9],
        "door_count": row[10],
        "employee_count": row[11],
        "technical_requirements": row[12],
        "recommended_solution": row[13],
        "next_action": row[14],
        "follow_up_date": row[15],
        "created_at": row[16],
        "updated_at": row[17],
    }


def _require_visit_type(visit_type: str) -> None:
    if visit_type not in VISIT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "visit_type is invalid.",
                "allowed_values": sorted(VISIT_TYPES),
            },
        )


def _validate_relationships(
    cursor,
    customer_id: int,
    site_id: int | None,
    sales_rep_id: int | None,
) -> None:
    cursor.execute("SELECT 1 FROM customers WHERE customer_id = %s;", (customer_id,))
    if cursor.fetchone() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {customer_id} was not found.",
        )

    if site_id is not None:
        cursor.execute(
            "SELECT 1 FROM sites WHERE site_id = %s AND customer_id = %s;",
            (site_id, customer_id),
        )
        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="site_id must identify a site owned by the field-visit customer.",
            )

    if sales_rep_id is not None:
        cursor.execute("SELECT 1 FROM users WHERE user_id = %s;", (sales_rep_id,))
        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"sales_rep_id {sales_rep_id} does not identify a user.",
            )


def _get_field_visit_row(cursor, visit_id: int):
    cursor.execute(
        f"SELECT {FIELD_VISIT_COLUMNS} FROM field_visits WHERE visit_id = %s;",
        (visit_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field visit {visit_id} was not found.",
        )
    return row


@router.get("/")
def list_field_visits(
    customer_id: int | None = None,
    site_id: int | None = None,
    sales_rep_id: int | None = None,
    visit_type: str | None = None,
    visit_date_from: date | None = None,
    visit_date_to: date | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    if visit_date_from and visit_date_to and visit_date_from > visit_date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="visit_date_from must be on or before visit_date_to.",
        )

    filters = []
    parameters = []
    for column, value in (
        ("customer_id", customer_id),
        ("site_id", site_id),
        ("sales_rep_id", sales_rep_id),
        ("visit_type", visit_type),
    ):
        if value is not None:
            filters.append(f"{column} = %s")
            parameters.append(value)
    if visit_date_from is not None:
        filters.append("visit_date >= %s")
        parameters.append(visit_date_from)
    if visit_date_to is not None:
        filters.append("visit_date < %s")
        parameters.append(visit_date_to + timedelta(days=1))

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT COUNT(*) FROM field_visits{where_clause};",
                parameters,
            )
            total_count = cursor.fetchone()[0]
            cursor.execute(
                f"""
                SELECT {FIELD_VISIT_COLUMNS}
                FROM field_visits
                {where_clause}
                ORDER BY visit_date DESC, visit_id DESC
                LIMIT %s OFFSET %s;
                """,
                [*parameters, limit, offset],
            )
            field_visits = [_serialize_field_visit(row) for row in cursor.fetchall()]

    return {
        "count": len(field_visits),
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "field_visits": field_visits,
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_field_visit(field_visit: FieldVisitCreate):
    if field_visit.visit_type is not None:
        _require_visit_type(field_visit.visit_type)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            _validate_relationships(
                cursor,
                field_visit.customer_id,
                field_visit.site_id,
                field_visit.sales_rep_id,
            )
            cursor.execute(
                f"""
                INSERT INTO field_visits
                (
                    customer_id, site_id, sales_rep_id, visit_date, visit_type, purpose,
                    customer_needs, pain_points, existing_system, door_count,
                    employee_count, technical_requirements, recommended_solution,
                    next_action, follow_up_date
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING {FIELD_VISIT_COLUMNS};
                """,
                (
                    field_visit.customer_id,
                    field_visit.site_id,
                    field_visit.sales_rep_id,
                    field_visit.visit_date,
                    field_visit.visit_type,
                    field_visit.purpose,
                    field_visit.customer_needs,
                    field_visit.pain_points,
                    field_visit.existing_system,
                    field_visit.door_count,
                    field_visit.employee_count,
                    field_visit.technical_requirements,
                    field_visit.recommended_solution,
                    field_visit.next_action,
                    field_visit.follow_up_date,
                ),
            )
            row = cursor.fetchone()
        connection.commit()

    return _serialize_field_visit(row)


@router.get("/{visit_id}")
def get_field_visit(visit_id: int):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            row = _get_field_visit_row(cursor, visit_id)
    return _serialize_field_visit(row)


@router.patch("/{visit_id}")
def update_field_visit(visit_id: int, field_visit: FieldVisitUpdate):
    updates = field_visit.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one updatable field is required.",
        )
    if "visit_date" in updates and updates["visit_date"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="visit_date cannot be null.",
        )
    if "visit_type" in updates:
        if updates["visit_type"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="visit_type cannot be null.",
            )
        _require_visit_type(updates["visit_type"])

    assignments = [f"{column} = %s" for column in updates]
    values = list(updates.values())

    with get_connection() as connection:
        with connection.cursor() as cursor:
            current = _get_field_visit_row(cursor, visit_id)
            _validate_relationships(
                cursor,
                current[1],
                updates.get("site_id", current[2]),
                updates.get("sales_rep_id", current[3]),
            )
            cursor.execute(
                f"""
                UPDATE field_visits
                SET {', '.join(assignments)}, updated_at = CURRENT_TIMESTAMP
                WHERE visit_id = %s
                RETURNING {FIELD_VISIT_COLUMNS};
                """,
                [*values, visit_id],
            )
            row = cursor.fetchone()
        connection.commit()

    return _serialize_field_visit(row)
