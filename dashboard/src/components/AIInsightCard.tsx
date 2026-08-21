import { useEffect, useState } from "react";

import {
  ApiError,
  crmApi,
  type CustomerAiSummary,
  type DataSufficiency,
  type OpportunityInsight,
} from "../api/client";

type LoadState = "loading" | "ready" | "error";

type AIInsightCardProps =
  | { variant: "opportunity"; opportunityId: number }
  | { variant: "customer"; customerId: number };

function riskModifier(riskLevel: string): string {
  return riskLevel.toLowerCase();
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function DataSufficiencyNotice({
  dataSufficiency,
  caveats,
}: {
  dataSufficiency: DataSufficiency;
  caveats: string[];
}) {
  if (dataSufficiency === "SUFFICIENT") return null;

  return (
    <div className="ai-insight-notice" role="note">
      <strong>{dataSufficiency === "INSUFFICIENT" ? "Limited data:" : "Data gaps:"}</strong>{" "}
      {caveats.length > 0
        ? caveats.join(" ")
        : "There isn't enough recorded CRM history yet to fully support this insight."}
    </div>
  );
}

export function AIInsightCard(props: AIInsightCardProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [opportunityInsight, setOpportunityInsight] = useState<OpportunityInsight | null>(null);
  const [customerSummary, setCustomerSummary] = useState<CustomerAiSummary | null>(null);

  const entityId = props.variant === "opportunity" ? props.opportunityId : props.customerId;

  const load = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      if (props.variant === "opportunity") {
        setOpportunityInsight(await crmApi.getOpportunityInsight(props.opportunityId));
      } else {
        setCustomerSummary(await crmApi.getCustomerAiSummary(props.customerId));
      }
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to generate an AI insight.",
      );
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.variant, entityId]);

  const title = props.variant === "opportunity" ? "AI Sales Insight" : "AI Customer Summary";

  return (
    <section className="ai-insight-card" aria-labelledby={`ai-insight-title-${props.variant}-${entityId}`}>
      <div className="ai-insight-heading">
        <p className="eyebrow ai-insight-eyebrow" id={`ai-insight-title-${props.variant}-${entityId}`}>
          <span className="ai-badge">AI</span> {title}
        </p>
        {loadState === "ready" && (
          <button className="secondary-button" type="button" onClick={() => void load()}>
            Regenerate
          </button>
        )}
      </div>

      {loadState === "loading" && (
        <div className="ai-insight-state" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <p>Generating AI insight from CRM data…</p>
        </div>
      )}

      {loadState === "error" && (
        <div className="ai-insight-state ai-insight-state--error" role="alert">
          <p>{errorMessage}</p>
          <button className="secondary-button" type="button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && props.variant === "opportunity" && opportunityInsight && (
        <div className="ai-insight-body">
          <div className="ai-insight-summary">
            <span className={`risk-badge risk-badge--${riskModifier(opportunityInsight.risk_level)}`}>
              {opportunityInsight.risk_level} risk
            </span>
            <span className="ai-confidence">
              {formatPercent(opportunityInsight.confidence)} confidence
            </span>
          </div>

          <p className="ai-insight-action">
            <strong>Recommended action:</strong> {opportunityInsight.recommended_action}
          </p>

          {opportunityInsight.reasoning.length > 0 && (
            <ul className="ai-reasoning-list">
              {opportunityInsight.reasoning.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          )}

          <p className="ai-follow-up">
            <strong>Suggested follow-up:</strong> {opportunityInsight.suggested_follow_up}
          </p>

          <DataSufficiencyNotice
            dataSufficiency={opportunityInsight.data_sufficiency}
            caveats={opportunityInsight.caveats}
          />
        </div>
      )}

      {loadState === "ready" && props.variant === "customer" && customerSummary && (
        <div className="ai-insight-body">
          <div className="ai-insight-summary">
            <span className="ai-confidence">
              {formatPercent(customerSummary.confidence)} confidence
            </span>
          </div>

          <p>{customerSummary.summary}</p>
          <p className="ai-current-situation">
            <strong>Current situation:</strong> {customerSummary.current_situation}
          </p>

          {customerSummary.key_risks.length > 0 && (
            <div className="ai-insight-column">
              <p className="ai-column-label">Key risks</p>
              <ul className="ai-reasoning-list">
                {customerSummary.key_risks.map((risk, index) => (
                  <li key={index}>{risk}</li>
                ))}
              </ul>
            </div>
          )}

          {customerSummary.key_opportunities.length > 0 && (
            <div className="ai-insight-column">
              <p className="ai-column-label">Key opportunities</p>
              <ul className="ai-reasoning-list">
                {customerSummary.key_opportunities.map((opportunity, index) => (
                  <li key={index}>{opportunity}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="ai-follow-up">
            <strong>Recommended next step:</strong> {customerSummary.recommended_next_step}
          </p>

          <DataSufficiencyNotice
            dataSufficiency={customerSummary.data_sufficiency}
            caveats={customerSummary.caveats}
          />
        </div>
      )}
    </section>
  );
}
