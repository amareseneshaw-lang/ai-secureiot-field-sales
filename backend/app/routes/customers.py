from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.database import get_connection


router = APIRouter(
    prefix="/api/v1/customers",
    tags=["Customers"],
)


class CustomerCreate(BaseModel):
    company_name: str
    industry: str | None = None
    employee_count: int | None = None
    account_status: str = "ACTIVE"


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