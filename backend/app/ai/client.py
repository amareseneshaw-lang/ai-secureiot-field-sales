import logging

import anthropic

from backend.app.ai import prompts
from backend.app.ai.config import (
    AI_MODEL,
    AI_REQUEST_TIMEOUT_SECONDS,
    AIConfigurationError,
    get_ai_api_key,
)
from backend.app.ai.schemas import CustomerSummary, OpportunityInsight

logger = logging.getLogger(__name__)

_MAX_TOKENS = 2048


class AIServiceError(RuntimeError):
    """Raised when the AI provider cannot fulfill a request.

    Messages on this exception are written to be safe to return to API clients directly -
    they never include provider internals, request bodies, or credentials.
    """


_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=get_ai_api_key(), timeout=AI_REQUEST_TIMEOUT_SECONDS)
    return _client


def _parse(system_prompt: str, user_prompt: str, output_format):
    try:
        client = _get_client()
    except AIConfigurationError as error:
        logger.error("AI service misconfigured: %s", error)
        raise AIServiceError("AI insight is not configured on this server.") from error

    try:
        response = client.messages.parse(
            model=AI_MODEL,
            max_tokens=_MAX_TOKENS,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            output_format=output_format,
        )
    except anthropic.RateLimitError as error:
        logger.warning("AI provider rate limited: %s", error)
        raise AIServiceError(
            "AI insight is temporarily unavailable (rate limited). Please try again shortly."
        ) from error
    except anthropic.AuthenticationError as error:
        logger.error("AI provider rejected credentials: %s", error)
        raise AIServiceError("AI insight is not configured correctly on this server.") from error
    except anthropic.APIConnectionError as error:
        logger.warning("AI provider connection error: %s", error)
        raise AIServiceError(
            "Unable to reach the AI provider. Please try again shortly."
        ) from error
    except anthropic.APIStatusError as error:
        logger.warning("AI provider error (%s): %s", error.status_code, error.message)
        raise AIServiceError(
            "AI insight is temporarily unavailable. Please try again shortly."
        ) from error

    return response.parsed_output


def generate_opportunity_insight(context: dict) -> OpportunityInsight:
    return _parse(
        prompts.OPPORTUNITY_INSIGHT_SYSTEM_PROMPT,
        prompts.build_opportunity_prompt(context),
        OpportunityInsight,
    )


def generate_customer_summary(context: dict) -> CustomerSummary:
    return _parse(
        prompts.CUSTOMER_SUMMARY_SYSTEM_PROMPT,
        prompts.build_customer_prompt(context),
        CustomerSummary,
    )
