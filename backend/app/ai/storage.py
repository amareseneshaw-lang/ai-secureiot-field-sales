import json
import logging

from backend.app.ai.config import AI_MODEL
from backend.app.ai.schemas import CustomerSummary, OpportunityInsight
from backend.app.database import get_connection

logger = logging.getLogger(__name__)


def store_opportunity_insight(
    opportunity_id: int, customer_id: int, insight: OpportunityInsight
) -> None:
    """Persists a generated opportunity insight into ai_predictions/ai_recommendations.

    Best-effort: a storage failure is logged and swallowed rather than failing the request,
    since the insight was already generated successfully and is what the caller asked for.
    """
    explanation = json.dumps(
        {
            "risk_level": insight.risk_level,
            "reasoning": insight.reasoning,
            "data_sufficiency": insight.data_sufficiency,
            "caveats": insight.caveats,
        }
    )

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO ai_predictions
                        (customer_id, opportunity_id, model_name, prediction_type,
                         confidence_score, explanation)
                    VALUES (%s, %s, %s, 'opportunity_risk', %s, %s)
                    RETURNING prediction_id;
                    """,
                    (customer_id, opportunity_id, AI_MODEL, insight.confidence, explanation),
                )
                prediction_id = cursor.fetchone()[0]

                cursor.execute(
                    """
                    INSERT INTO ai_recommendations
                        (customer_id, opportunity_id, prediction_id, recommendation_type,
                         recommendation_text, priority, reason)
                    VALUES (%s, %s, %s, 'next_action', %s, %s, %s);
                    """,
                    (
                        customer_id,
                        opportunity_id,
                        prediction_id,
                        insight.recommended_action,
                        insight.risk_level,
                        insight.suggested_follow_up,
                    ),
                )
            connection.commit()
    except Exception:
        logger.exception(
            "Failed to persist opportunity insight for opportunity_id=%s", opportunity_id
        )


def store_customer_summary(customer_id: int, summary: CustomerSummary) -> None:
    explanation = json.dumps(
        {
            "summary": summary.summary,
            "current_situation": summary.current_situation,
            "key_risks": summary.key_risks,
            "key_opportunities": summary.key_opportunities,
            "data_sufficiency": summary.data_sufficiency,
            "caveats": summary.caveats,
        }
    )

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO ai_predictions
                        (customer_id, opportunity_id, model_name, prediction_type,
                         confidence_score, explanation)
                    VALUES (%s, NULL, %s, 'customer_summary', %s, %s)
                    RETURNING prediction_id;
                    """,
                    (customer_id, AI_MODEL, summary.confidence, explanation),
                )
                prediction_id = cursor.fetchone()[0]

                cursor.execute(
                    """
                    INSERT INTO ai_recommendations
                        (customer_id, opportunity_id, prediction_id, recommendation_type,
                         recommendation_text, reason)
                    VALUES (%s, NULL, %s, 'next_step', %s, %s);
                    """,
                    (
                        customer_id,
                        prediction_id,
                        summary.recommended_next_step,
                        summary.current_situation,
                    ),
                )
            connection.commit()
    except Exception:
        logger.exception("Failed to persist customer summary for customer_id=%s", customer_id)
