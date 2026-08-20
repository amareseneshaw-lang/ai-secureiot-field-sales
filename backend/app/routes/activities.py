from datetime import date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from backend.app.database import get_connection


router = APIRouter(
    prefix="/api/v1/activities",
    tags=["Activities"],
)


ACTIVITY_TYPES = frozenset(
    {
        "MEETING",
        "FIELD_VISIT",
        "SITE_ASSESSMENT",
        "TECHNICAL_DISCOVERY",
        "FOLLOW_UP",
        "SERVICE_ACTIVITY",
    }
)


class ActivityCreate(BaseModel):
    customer_id: int | None = None
    opportunity_id: int | None = None
    user_id: int | None = None
    activity_type: str
    subject: str | None = Field(default=None, max_length=255)
    description: str | None = None
    activity_timestamp: datetime
    outcome: str | None = None
    next_action: str | None = None

    @field_validator("subject")
    @classmethod
    def subject_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("subject must contain non-whitespace content.")
        return value


class ActivityUpdate(BaseModel):
    customer_id: int | None = None
    opportunity_id: int | None = None
    user_id: int | None = None
    activity_type: str | None = None
    subject: str | None = Field(default=None, max_length=255)
    description: str | None = None
    activity_timestamp: datetime | None = None
    outcome: str | None = None
    next_action: str | None = None

    @field_validator("subject")
    @classmethod
    def subject_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("subject must contain non-whitespace content.")
        return value


ACTIVITY_COLUMNS = """
    activity_id,
    customer_id,
    opportunity_id,
    user_id,
    activity_type,
    subject,
    description,
    activity_timestamp,
    outcome,
    next_action,
    created_at
"""


def _serialize_activity(row):
    return {
        "activity_id": row[0],
        "customer_id": row[1],
        "opportunity_id": row[2],
        "user_id": row[3],
        "activity_type": row[4],
        "subject": row[5],
        "description": row[6],
        "activity_timestamp": row[7],
        "outcome": row[8],
        "next_action": row[9],
        "created_at": row[10],
    }


def _require_activity_type(activity_type: str) -> None:
    if activity_type not in ACTIVITY_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "activity_type is invalid.",
                "allowed_values": sorted(ACTIVITY_TYPES),
            },
        )


def _validate_relationships(
    cursor,
    customer_id: int | None,
    opportunity_id: int | None,
    user_id: int | None,
) -> None:
    if customer_id is None and opportunity_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one of customer_id or opportunity_id is required.",
        )

    if customer_id is not None:
        cursor.execute("SELECT 1 FROM customers WHERE customer_id = %s;", (customer_id,))
        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} was not found.",
            )

    if opportunity_id is not None:
        cursor.execute(
            "SELECT customer_id FROM opportunities WHERE opportunity_id = %s;",
            (opportunity_id,),
        )
        opportunity = cursor.fetchone()
        if opportunity is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"opportunity_id {opportunity_id} does not identify an opportunity.",
            )
        if customer_id is not None and opportunity[0] != customer_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="opportunity_id must identify an opportunity owned by customer_id.",
            )

    if user_id is not None:
        cursor.execute("SELECT 1 FROM users WHERE user_id = %s;", (user_id,))
        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"user_id {user_id} does not identify a user.",
            )


def _get_activity_row(cursor, activity_id: int):
    cursor.execute(
        f"SELECT {ACTIVITY_COLUMNS} FROM activities WHERE activity_id = %s;",
        (activity_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity {activity_id} was not found.",
        )
    return row


@router.get("/")
def list_activities(
    customer_id: int | None = None,
    opportunity_id: int | None = None,
    user_id: int | None = None,
    activity_type: str | None = None,
    activity_timestamp_from: date | None = None,
    activity_timestamp_to: date | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    if activity_timestamp_from and activity_timestamp_to:
        if activity_timestamp_from > activity_timestamp_to:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="activity_timestamp_from must be on or before activity_timestamp_to.",
            )
    if activity_type is not None:
        _require_activity_type(activity_type)

    filters = []
    parameters = []
    for column, value in (
        ("customer_id", customer_id),
        ("opportunity_id", opportunity_id),
        ("user_id", user_id),
        ("activity_type", activity_type),
    ):
        if value is not None:
            filters.append(f"{column} = %s")
            parameters.append(value)
    if activity_timestamp_from is not None:
        filters.append("activity_timestamp >= %s")
        parameters.append(activity_timestamp_from)
    if activity_timestamp_to is not None:
        filters.append("activity_timestamp < %s")
        parameters.append(activity_timestamp_to + timedelta(days=1))

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT COUNT(*) FROM activities{where_clause};",
                parameters,
            )
            total_count = cursor.fetchone()[0]
            cursor.execute(
                f"""
                SELECT {ACTIVITY_COLUMNS}
                FROM activities
                {where_clause}
                ORDER BY activity_timestamp DESC, activity_id DESC
                LIMIT %s OFFSET %s;
                """,
                [*parameters, limit, offset],
            )
            activities = [_serialize_activity(row) for row in cursor.fetchall()]

    return {
        "count": len(activities),
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "activities": activities,
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_activity(activity: ActivityCreate):
    _require_activity_type(activity.activity_type)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            _validate_relationships(
                cursor,
                activity.customer_id,
                activity.opportunity_id,
                activity.user_id,
            )
            cursor.execute(
                f"""
                INSERT INTO activities
                (
                    customer_id, opportunity_id, user_id, activity_type, subject,
                    description, activity_timestamp, outcome, next_action
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING {ACTIVITY_COLUMNS};
                """,
                (
                    activity.customer_id,
                    activity.opportunity_id,
                    activity.user_id,
                    activity.activity_type,
                    activity.subject,
                    activity.description,
                    activity.activity_timestamp,
                    activity.outcome,
                    activity.next_action,
                ),
            )
            row = cursor.fetchone()
        connection.commit()

    return _serialize_activity(row)


@router.get("/{activity_id}")
def get_activity(activity_id: int):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            row = _get_activity_row(cursor, activity_id)
    return _serialize_activity(row)


@router.patch("/{activity_id}")
def update_activity(activity_id: int, activity: ActivityUpdate):
    updates = activity.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one updatable field is required.",
        )
    if "activity_type" in updates:
        if updates["activity_type"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="activity_type cannot be null.",
            )
        _require_activity_type(updates["activity_type"])
    if "activity_timestamp" in updates and updates["activity_timestamp"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="activity_timestamp cannot be null.",
        )

    assignments = [f"{column} = %s" for column in updates]
    values = list(updates.values())

    with get_connection() as connection:
        with connection.cursor() as cursor:
            current = _get_activity_row(cursor, activity_id)
            _validate_relationships(
                cursor,
                updates.get("customer_id", current[1]),
                updates.get("opportunity_id", current[2]),
                updates.get("user_id", current[3]),
            )
            cursor.execute(
                f"""
                UPDATE activities
                SET {', '.join(assignments)}
                WHERE activity_id = %s
                RETURNING {ACTIVITY_COLUMNS};
                """,
                [*values, activity_id],
            )
            row = cursor.fetchone()
        connection.commit()

    return _serialize_activity(row)
