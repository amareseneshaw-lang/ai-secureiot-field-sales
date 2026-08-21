from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from backend.app.auth.dependencies import require_role
from backend.app.database import get_connection
from backend.app.routes.activities import ACTIVITY_COLUMNS, _serialize_activity
from backend.app.routes.field_visits import (
    FIELD_VISIT_COLUMNS,
    _serialize_field_visit,
)
from backend.app.routes.opportunities import (
    OPPORTUNITY_COLUMNS,
    _serialize_opportunity,
)


router = APIRouter(
    prefix="/api/v1/customers",
    tags=["Customers"],
    dependencies=[Depends(require_role("SYSTEM_ADMIN", "SALES_MANAGER", "FIELD_SALES"))],
)


class CustomerCreate(BaseModel):
    company_name: str
    industry: str | None = None
    employee_count: int | None = None
    account_status: str = "ACTIVE"


CONTACT_COLUMNS = """
    contact_id,
    customer_id,
    first_name,
    last_name,
    job_title,
    email,
    phone,
    contact_type,
    is_primary,
    created_at,
    updated_at
"""


def _serialize_contact(row):
    return {
        "contact_id": row[0],
        "customer_id": row[1],
        "first_name": row[2],
        "last_name": row[3],
        "job_title": row[4],
        "email": row[5],
        "phone": row[6],
        "contact_type": row[7],
        "is_primary": row[8],
        "created_at": row[9],
        "updated_at": row[10],
    }


def _require_customer(cursor, customer_id: int) -> None:
    cursor.execute("SELECT 1 FROM customers WHERE customer_id = %s;", (customer_id,))
    if cursor.fetchone() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {customer_id} was not found.",
        )


@router.get("/")
def get_customers():
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    customer_id,
                    company_name,
                    industry,
                    employee_count,
                    account_status
                FROM customers
                ORDER BY customer_id;
                """
            )

            rows = cursor.fetchall()

    customers = [
        {
            "customer_id": row[0],
            "company_name": row[1],
            "industry": row[2],
            "employee_count": row[3],
            "account_status": row[4],
        }
        for row in rows
    ]

    return {
        "count": len(customers),
        "customers": customers,
    }


@router.get("/{customer_id}")
def get_customer(customer_id: int):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    customer_id,
                    company_name,
                    industry,
                    employee_count,
                    account_status
                FROM customers
                WHERE customer_id = %s;
                """,
                (customer_id,),
            )

            row = cursor.fetchone()

    if row is None:
        return {
            "error": "Customer not found",
            "customer_id": customer_id,
        }

    return {
        "customer_id": row[0],
        "company_name": row[1],
        "industry": row[2],
        "employee_count": row[3],
        "account_status": row[4],
    }


@router.post("/")
def create_customer(customer: CustomerCreate):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO customers
                (
                    company_name,
                    industry,
                    employee_count,
                    account_status
                )
                VALUES (%s, %s, %s, %s)
                RETURNING
                    customer_id,
                    company_name,
                    industry,
                    employee_count,
                    account_status;
                """,
                (
                    customer.company_name,
                    customer.industry,
                    customer.employee_count,
                    customer.account_status,
                ),
            )

            row = cursor.fetchone()

        connection.commit()

    return {
        "message": "Customer created successfully",
        "customer_id": row[0],
        "company_name": row[1],
        "industry": row[2],
        "employee_count": row[3],
        "account_status": row[4],
    }


@router.get("/{customer_id}/contacts/")
def list_customer_contacts(
    customer_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            _require_customer(cursor, customer_id)
            cursor.execute(
                "SELECT COUNT(*) FROM contacts WHERE customer_id = %s;",
                (customer_id,),
            )
            total_count = cursor.fetchone()[0]
            cursor.execute(
                f"""
                SELECT {CONTACT_COLUMNS}
                FROM contacts
                WHERE customer_id = %s
                ORDER BY is_primary DESC, last_name ASC, first_name ASC, contact_id ASC
                LIMIT %s OFFSET %s;
                """,
                (customer_id, limit, offset),
            )
            contacts = [_serialize_contact(row) for row in cursor.fetchall()]

    return {
        "count": len(contacts),
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "contacts": contacts,
    }


@router.get("/{customer_id}/opportunities/")
def list_customer_opportunities(
    customer_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            _require_customer(cursor, customer_id)
            cursor.execute(
                "SELECT COUNT(*) FROM opportunities WHERE customer_id = %s;",
                (customer_id,),
            )
            total_count = cursor.fetchone()[0]
            cursor.execute(
                f"""
                SELECT {OPPORTUNITY_COLUMNS}
                FROM opportunities
                WHERE customer_id = %s
                ORDER BY opportunity_id ASC
                LIMIT %s OFFSET %s;
                """,
                (customer_id, limit, offset),
            )
            opportunities = [
                _serialize_opportunity(row) for row in cursor.fetchall()
            ]

    return {
        "count": len(opportunities),
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "opportunities": opportunities,
    }


@router.get("/{customer_id}/field-visits/")
def list_customer_field_visits(
    customer_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            _require_customer(cursor, customer_id)
            cursor.execute(
                "SELECT COUNT(*) FROM field_visits WHERE customer_id = %s;",
                (customer_id,),
            )
            total_count = cursor.fetchone()[0]
            cursor.execute(
                f"""
                SELECT {FIELD_VISIT_COLUMNS}
                FROM field_visits
                WHERE customer_id = %s
                ORDER BY visit_date DESC, visit_id DESC
                LIMIT %s OFFSET %s;
                """,
                (customer_id, limit, offset),
            )
            field_visits = [
                _serialize_field_visit(row) for row in cursor.fetchall()
            ]

    return {
        "count": len(field_visits),
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "field_visits": field_visits,
    }


@router.get("/{customer_id}/activities/")
def list_customer_activities(
    customer_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            _require_customer(cursor, customer_id)
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM activities a
                LEFT JOIN opportunities o ON o.opportunity_id = a.opportunity_id
                WHERE a.customer_id = %s OR o.customer_id = %s;
                """,
                (customer_id, customer_id),
            )
            total_count = cursor.fetchone()[0]
            cursor.execute(
                f"""
                SELECT {ACTIVITY_COLUMNS}
                FROM (
                    SELECT a.*
                    FROM activities a
                    LEFT JOIN opportunities o ON o.opportunity_id = a.opportunity_id
                    WHERE a.customer_id = %s OR o.customer_id = %s
                ) AS activities
                ORDER BY activity_timestamp DESC, activity_id DESC
                LIMIT %s OFFSET %s;
                """,
                (customer_id, customer_id, limit, offset),
            )
            activities = [_serialize_activity(row) for row in cursor.fetchall()]

    return {
        "count": len(activities),
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "activities": activities,
    }
