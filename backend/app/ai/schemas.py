from typing import Literal

from pydantic import BaseModel, Field

RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
DataSufficiency = Literal["SUFFICIENT", "LIMITED", "INSUFFICIENT"]


class OpportunityInsight(BaseModel):
    risk_level: RiskLevel = Field(
        description=(
            "Overall risk that this opportunity stalls or is lost, based only on the "
            "supplied CRM data."
        )
    )
    recommended_action: str = Field(
        description="A single, concrete next action for the sales rep."
    )
    reasoning: list[str] = Field(
        description=(
            "Bullet points citing specific facts from the supplied CRM data that support "
            "the risk level and recommendation. Never include a fact not present in the "
            "supplied data."
        )
    )
    suggested_follow_up: str = Field(
        description="A specific, time-bound follow-up suggestion."
    )
    confidence: float = Field(
        description=(
            "Confidence in this insight from 0.0 to 1.0, reflecting how much supporting "
            "data was available."
        )
    )
    data_sufficiency: DataSufficiency = Field(
        description=(
            "Whether enough CRM data (field visits, activities) was available to support "
            "a confident recommendation."
        )
    )
    caveats: list[str] = Field(
        default_factory=list,
        description=(
            "Gaps in the available data that limit this insight, e.g. 'No field visits "
            "recorded for this account.' Empty if the data was sufficient."
        ),
    )


class CustomerSummary(BaseModel):
    summary: str = Field(
        description=(
            "2-4 sentence narrative summary of the customer relationship based only on "
            "the supplied CRM data."
        )
    )
    current_situation: str = Field(
        description=(
            "Where the account currently stands in the sales funnel and why, based only "
            "on the supplied data."
        )
    )
    key_risks: list[str] = Field(
        default_factory=list,
        description="Risks to the relationship or open opportunities, grounded only in supplied data.",
    )
    key_opportunities: list[str] = Field(
        default_factory=list,
        description="Positive signals or growth opportunities, grounded only in supplied data.",
    )
    recommended_next_step: str = Field(
        description="A single concrete next step for the account owner."
    )
    confidence: float = Field(
        description=(
            "Confidence in this summary from 0.0 to 1.0, reflecting how much supporting "
            "data was available."
        )
    )
    data_sufficiency: DataSufficiency = Field(
        description="Whether enough CRM data was available to support a confident summary."
    )
    caveats: list[str] = Field(
        default_factory=list,
        description="Gaps in the available data that limit this summary. Empty if the data was sufficient.",
    )
