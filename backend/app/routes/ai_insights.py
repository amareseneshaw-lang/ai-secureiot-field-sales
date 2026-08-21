import logging

from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.ai.client import AIServiceError, generate_customer_summary, generate_opportunity_insight
from backend.app.ai.context import build_customer_context, build_opportunity_context
from backend.app.ai.schemas import CustomerSummary, OpportunityInsight
from backend.app.ai.storage import store_customer_summary, store_opportunity_insight
from backend.app.auth.dependencies import require_role

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/ai",
    tags=["AI Insights"],
    dependencies=[Depends(require_role("SYSTEM_ADMIN", "SALES_MANAGER", "FIELD_SALES"))],
)


@router.get("/opportunities/{opportunity_id}/insight", response_model=OpportunityInsight)
def get_opportunity_insight(opportunity_id: int):
    context = build_opportunity_context(opportunity_id)
    if context is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Opportunity {opportunity_id} was not found.",
        )

    try:
        insight = generate_opportunity_insight(context)
    except AIServiceError as error:
        logger.warning(
            "Opportunity insight generation failed for opportunity_id=%s: %s",
            opportunity_id,
            error,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error

    store_opportunity_insight(opportunity_id, context["customer_id"], insight)
    return insight


@router.get("/customers/{customer_id}/summary", response_model=CustomerSummary)
def get_customer_ai_summary(customer_id: int):
    context = build_customer_context(customer_id)
    if context is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {customer_id} was not found.",
        )

    try:
        summary = generate_customer_summary(context)
    except AIServiceError as error:
        logger.warning(
            "Customer summary generation failed for customer_id=%s: %s", customer_id, error
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error

    store_customer_summary(customer_id, summary)
    return summary
