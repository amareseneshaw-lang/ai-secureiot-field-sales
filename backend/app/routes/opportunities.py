from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.app.auth.dependencies import require_role
from backend.app.database import get_connection


router = APIRouter(
    prefix="/api/v1/opportunities",
    tags=["Opportunities"],
    dependencies=[Depends(require_role("SYSTEM_ADMIN", "SALES_MANAGER", "FIELD_SALES"))],
)


SALES_STAGES = frozenset(
    {
        "LEAD",
        "QUALIFICATION",
        "DISCOVERY",
        "FIELD_VISIT",
        "SITE_ASSESSMENT",
        "TECHNICAL_DISCOVERY",
        "SOLUTION_RECOMMENDATION",
        "PROPOSAL",
        "NEGOTIATION",
        "CLOSED_WON",
        "CLOSED_LOST",
    }
)


class OpportunityCreate(BaseModel):
    customer_id: int
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    site_id: int | None = None
    sales_rep_id: int | None = None
    sales_stage: str = "LEAD"
    estimated_value: Decimal | None = Field(default=None, ge=0)
    probability: Decimal | None = Field(default=None, ge=0, le=100)
    expected_close_date: date | None = None
    competitor: str | None = Field(default=None, max_length=255)
    priority: str | None = Field(default=None, max_length=30)


class OpportunityUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    site_id: int | None = None
    sales_rep_id: int | None = None
    sales_stage: str | None = None
    estimated_value: Decimal | None = Field(default=None, ge=0)
    probability: Decimal | None = Field(default=None, ge=0, le=100)
    expected_close_date: date | None = None
    competitor: str | None = Field(default=None, max_length=255)
    priority: str | None = Field(default=None, max_length=30)


OPPORTUNITY_COLUMNS = """
    opportunity_id,
    customer_id,
    site_id,
    opportunity_name,
    description,
    sales_stage,
    estimated_value,
    probability,
    expected_close_date,
    sales_rep_id,
    competitor,
    priority,
    created_at,
    updated_at
"""


def _serialize_opportunity(row):
    return {
        "opportunity_id": row[0],
        "customer_id": row[1],
        "site_id": row[2],
        "name": row[3],
        "description": row[4],
        "sales_stage": row[5],
        "estimated_value": row[6],
        "probability": row[7],
        "expected_close_date": row[8],
        "sales_rep_id": row[9],
        "competitor": row[10],
        "priority": row[11],
        "created_at": row[12],
        "updated_at": row[13],
    }


def _require_sales_stage(sales_stage: str) -> None:
    if sales_stage not in SALES_STAGES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "sales_stage is invalid.",
                "allowed_values": sorted(SALES_STAGES),
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
                detail="site_id must identify a site owned by the opportunity customer.",
            )

    if sales_rep_id is not None:
        cursor.execute("SELECT 1 FROM users WHERE user_id = %s;", (sales_rep_id,))
        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"sales_rep_id {sales_rep_id} does not identify a user.",
            )


def _get_opportunity_row(cursor, opportunity_id: int):
    cursor.execute(
        f"SELECT {OPPORTUNITY_COLUMNS} FROM opportunities WHERE opportunity_id = %s;",
        (opportunity_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Opportunity {opportunity_id} was not found.",
        )
    return row


@router.get("/pipeline/summary")
def get_pipeline_summary():
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    sales_stage,
                    COUNT(*) AS opportunity_count,
                    COALESCE(SUM(estimated_value), 0) AS total_estimated_value,
                    COALESCE(SUM(estimated_value * probability / 100), 0)
                        AS weighted_pipeline_value
                FROM opportunities
                GROUP BY sales_stage
                ORDER BY sales_stage;
                """
            )
            stages = [
                {
                    "sales_stage": row[0],
                    "opportunity_count": row[1],
                    "total_estimated_value": row[2],
                    "weighted_pipeline_value": row[3],
                }
                for row in cursor.fetchall()
            ]

            cursor.execute(
                """
                SELECT
                    COUNT(*),
                    COALESCE(SUM(estimated_value), 0),
                    COALESCE(SUM(estimated_value * probability / 100), 0)
                FROM opportunities;
                """
            )
            totals = cursor.fetchone()

    return {
        "stages": stages,
        "totals": {
            "opportunity_count": totals[0],
            "total_estimated_value": totals[1],
            "weighted_pipeline_value": totals[2],
        },
    }


@router.get("/")
def list_opportunities(
    customer_id: int | None = None,
    sales_rep_id: int | None = None,
    sales_stage: str | None = None,
    priority: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    filters = []
    parameters = []
    for column, value in (
        ("customer_id", customer_id),
        ("sales_rep_id", sales_rep_id),
        ("sales_stage", sales_stage),
        ("priority", priority),
    ):
        if value is not None:
            filters.append(f"{column} = %s")
            parameters.append(value)

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT COUNT(*) FROM opportunities{where_clause};",
                parameters,
            )
            total_count = cursor.fetchone()[0]
            cursor.execute(
                f"""
                SELECT {OPPORTUNITY_COLUMNS}
                FROM opportunities
                {where_clause}
                ORDER BY opportunity_id
                LIMIT %s OFFSET %s;
                """,
                [*parameters, limit, offset],
            )
            opportunities = [_serialize_opportunity(row) for row in cursor.fetchall()]

    return {
        "count": len(opportunities),
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "opportunities": opportunities,
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_opportunity(opportunity: OpportunityCreate):
    _require_sales_stage(opportunity.sales_stage)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            _validate_relationships(
                cursor,
                opportunity.customer_id,
                opportunity.site_id,
                opportunity.sales_rep_id,
            )
            cursor.execute(
                f"""
                INSERT INTO opportunities
                (
                    customer_id, site_id, opportunity_name, description, sales_stage,
                    estimated_value, probability, expected_close_date, sales_rep_id,
                    competitor, priority
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING {OPPORTUNITY_COLUMNS};
                """,
                (
                    opportunity.customer_id,
                    opportunity.site_id,
                    opportunity.name,
                    opportunity.description,
                    opportunity.sales_stage,
                    opportunity.estimated_value,
                    opportunity.probability,
                    opportunity.expected_close_date,
                    opportunity.sales_rep_id,
                    opportunity.competitor,
                    opportunity.priority,
                ),
            )
            row = cursor.fetchone()
        connection.commit()

    return _serialize_opportunity(row)


@router.get("/{opportunity_id}")
def get_opportunity(opportunity_id: int):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            row = _get_opportunity_row(cursor, opportunity_id)
    return _serialize_opportunity(row)


@router.patch("/{opportunity_id}")
def update_opportunity(opportunity_id: int, opportunity: OpportunityUpdate):
    updates = opportunity.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one updatable field is required.",
        )

    if "sales_stage" in updates:
        if updates["sales_stage"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="sales_stage cannot be null.",
            )
        _require_sales_stage(updates["sales_stage"])
    if "name" in updates and updates["name"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="name cannot be null.",
        )

    column_map = {"name": "opportunity_name", **{key: key for key in updates if key != "name"}}
    assignments = [f"{column_map[key]} = %s" for key in updates]
    values = list(updates.values())

    with get_connection() as connection:
        with connection.cursor() as cursor:
            current = _get_opportunity_row(cursor, opportunity_id)
            current_customer_id = current[1]
            _validate_relationships(
                cursor,
                current_customer_id,
                updates.get("site_id", current[2]),
                updates.get("sales_rep_id", current[9]),
            )
            cursor.execute(
                f"""
                UPDATE opportunities
                SET {', '.join(assignments)}, updated_at = CURRENT_TIMESTAMP
                WHERE opportunity_id = %s
                RETURNING {OPPORTUNITY_COLUMNS};
                """,
                [*values, opportunity_id],
            )
            row = cursor.fetchone()
        connection.commit()

    return _serialize_opportunity(row)
