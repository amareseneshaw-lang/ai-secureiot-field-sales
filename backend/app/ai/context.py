from backend.app.database import get_connection

FIELD_VISITS_LIMIT = 10
ACTIVITIES_LIMIT = 20
SIBLING_OPPORTUNITIES_LIMIT = 10


def _customer_row(cursor, customer_id: int):
    cursor.execute(
        """
        SELECT customer_id, company_name, industry, employee_count, account_status
        FROM customers
        WHERE customer_id = %s;
        """,
        (customer_id,),
    )
    return cursor.fetchone()


def _opportunity_row(cursor, opportunity_id: int):
    cursor.execute(
        """
        SELECT
            opportunity_id, customer_id, opportunity_name, description, sales_stage,
            estimated_value, probability, expected_close_date, competitor, priority
        FROM opportunities
        WHERE opportunity_id = %s;
        """,
        (opportunity_id,),
    )
    return cursor.fetchone()


def _opportunities_for_customer(cursor, customer_id: int, exclude_opportunity_id: int | None, limit: int):
    cursor.execute(
        """
        SELECT opportunity_name, sales_stage, estimated_value, probability, competitor, priority
        FROM opportunities
        WHERE customer_id = %s AND (%s::int IS NULL OR opportunity_id != %s)
        ORDER BY updated_at DESC
        LIMIT %s;
        """,
        (customer_id, exclude_opportunity_id, exclude_opportunity_id, limit),
    )
    return cursor.fetchall()


def _field_visits_for_customer(cursor, customer_id: int, limit: int):
    cursor.execute(
        """
        SELECT
            visit_date, visit_type, purpose, customer_needs, pain_points, existing_system,
            technical_requirements, recommended_solution, next_action, follow_up_date
        FROM field_visits
        WHERE customer_id = %s
        ORDER BY visit_date DESC
        LIMIT %s;
        """,
        (customer_id, limit),
    )
    return cursor.fetchall()


def _activities_for_customer(cursor, customer_id: int, limit: int):
    cursor.execute(
        """
        SELECT a.activity_type, a.subject, a.description, a.activity_timestamp, a.outcome, a.next_action
        FROM activities a
        LEFT JOIN opportunities o ON o.opportunity_id = a.opportunity_id
        WHERE a.customer_id = %s OR o.customer_id = %s
        ORDER BY a.activity_timestamp DESC
        LIMIT %s;
        """,
        (customer_id, customer_id, limit),
    )
    return cursor.fetchall()


def _activities_for_opportunity(cursor, opportunity_id: int, customer_id: int, limit: int):
    cursor.execute(
        """
        SELECT activity_type, subject, description, activity_timestamp, outcome, next_action
        FROM activities
        WHERE opportunity_id = %s OR customer_id = %s
        ORDER BY activity_timestamp DESC
        LIMIT %s;
        """,
        (opportunity_id, customer_id, limit),
    )
    return cursor.fetchall()


def _serialize_customer(row) -> dict:
    return {
        "company_name": row[1],
        "industry": row[2],
        "employee_count": row[3],
        "account_status": row[4],
    }


def _serialize_field_visit(row) -> dict:
    return {
        "visit_date": row[0],
        "visit_type": row[1],
        "purpose": row[2],
        "customer_needs": row[3],
        "pain_points": row[4],
        "existing_system": row[5],
        "technical_requirements": row[6],
        "recommended_solution": row[7],
        "next_action": row[8],
        "follow_up_date": row[9],
    }


def _serialize_activity(row) -> dict:
    return {
        "activity_type": row[0],
        "subject": row[1],
        "description": row[2],
        "activity_timestamp": row[3],
        "outcome": row[4],
        "next_action": row[5],
    }


def _serialize_sibling_opportunity(row) -> dict:
    return {
        "name": row[0],
        "sales_stage": row[1],
        "estimated_value": float(row[2]) if row[2] is not None else None,
        "probability": float(row[3]) if row[3] is not None else None,
        "competitor": row[4],
        "priority": row[5],
    }


def build_opportunity_context(opportunity_id: int) -> dict | None:
    """Returns the CRM data needed to reason about one opportunity, or None if it does not exist.

    Only business-relevant fields are included - no contact PII, no credentials, no internal
    user identifiers beyond what is already customer-facing.
    """
    with get_connection() as connection:
        with connection.cursor() as cursor:
            opportunity = _opportunity_row(cursor, opportunity_id)
            if opportunity is None:
                return None

            customer_id = opportunity[1]
            customer = _customer_row(cursor, customer_id)
            field_visits = _field_visits_for_customer(cursor, customer_id, FIELD_VISITS_LIMIT)
            activities = _activities_for_opportunity(
                cursor, opportunity_id, customer_id, ACTIVITIES_LIMIT
            )
            siblings = _opportunities_for_customer(
                cursor, customer_id, opportunity_id, SIBLING_OPPORTUNITIES_LIMIT
            )

    return {
        "customer_id": customer_id,
        "opportunity": {
            "name": opportunity[2],
            "description": opportunity[3],
            "sales_stage": opportunity[4],
            "estimated_value": float(opportunity[5]) if opportunity[5] is not None else None,
            "probability": float(opportunity[6]) if opportunity[6] is not None else None,
            "expected_close_date": opportunity[7],
            "competitor": opportunity[8],
            "priority": opportunity[9],
        },
        "customer": _serialize_customer(customer) if customer else None,
        "field_visits": [_serialize_field_visit(row) for row in field_visits],
        "activities": [_serialize_activity(row) for row in activities],
        "other_opportunities_for_this_customer": [
            _serialize_sibling_opportunity(row) for row in siblings
        ],
    }


def build_customer_context(customer_id: int) -> dict | None:
    """Returns the CRM data needed to summarize one customer, or None if it does not exist."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            customer = _customer_row(cursor, customer_id)
            if customer is None:
                return None

            opportunities = _opportunities_for_customer(
                cursor, customer_id, None, SIBLING_OPPORTUNITIES_LIMIT * 2
            )
            field_visits = _field_visits_for_customer(cursor, customer_id, FIELD_VISITS_LIMIT)
            activities = _activities_for_customer(cursor, customer_id, ACTIVITIES_LIMIT)

    return {
        "customer": _serialize_customer(customer),
        "opportunities": [_serialize_sibling_opportunity(row) for row in opportunities],
        "field_visits": [_serialize_field_visit(row) for row in field_visits],
        "activities": [_serialize_activity(row) for row in activities],
    }
