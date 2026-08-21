import os

AI_MODEL = os.getenv("AI_MODEL", "claude-sonnet-5")
AI_REQUEST_TIMEOUT_SECONDS = float(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "20"))


class AIConfigurationError(RuntimeError):
    """Raised when the AI provider configuration is missing or unusable."""


def get_ai_api_key() -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise AIConfigurationError(
            "ANTHROPIC_API_KEY is required for AI insight endpoints. Set it in the "
            "application environment (see .env.example)."
        )
    return api_key
