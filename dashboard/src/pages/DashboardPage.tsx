import { useEffect, useState } from "react";

import {
  crmApi,
  type Activity,
  type Customer,
  type FieldVisit,
  type NumericValue,
  type PipelineSummary,
} from "../api/client";

type LoadState = "loading" | "ready" | "error";

type DashboardData = {
  pipeline: PipelineSummary;
  activities: Activity[];
  fieldVisits: FieldVisit[];
  customers: Customer[];
};

function formatCurrency(value: NumericValue): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatStage(stage: string): string {
  return stage.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const [pipeline, activitiesResponse, fieldVisitsResponse, customersResponse] = await Promise.all([
        crmApi.getPipelineSummary(),
        crmApi.getRecentActivities(),
        crmApi.getRecentFieldVisits(),
        crmApi.getCustomers(),
      ]);
      setData({
        pipeline,
        activities: activitiesResponse.activities,
        fieldVisits: fieldVisitsResponse.field_visits,
        customers: customersResponse.customers,
      });
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load dashboard data.",
      );
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const customersById = new Map(
    data?.customers.map((customer) => [customer.customer_id, customer.company_name]),
  );
  const largestStageCount = Math.max(
    1,
    ...(data?.pipeline.stages.map((stage) => stage.opportunity_count) ?? []),
  );

  return (
    <section id="dashboard" className="page-content dashboard-page" aria-labelledby="dashboard-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">CRM / Overview</p>
          <h1 id="dashboard-title">Sales command center</h1>
          <p className="page-intro">Pipeline momentum, field intelligence, and the latest customer engagement.</p>
        </div>
        <button className="refresh-button" type="button" onClick={() => void loadDashboard()}>
          Refresh data
        </button>
      </header>

      {loadState === "loading" && (
        <div className="state-card" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <div><strong>Loading CRM intelligence</strong><p>Retrieving pipeline, activities, and field visits…</p></div>
        </div>
      )}

      {loadState === "error" && (
        <div className="state-card state-card--error" role="alert">
          <div><strong>Dashboard data is unavailable</strong><p>{errorMessage}</p></div>
          <button className="secondary-button" type="button" onClick={() => void loadDashboard()}>Try again</button>
        </div>
      )}

      {loadState === "ready" && data && (
        <div className="dashboard-content">
          <section className="metric-grid" aria-label="Pipeline totals">
            <article className="metric-card">
              <p>Total opportunities</p>
              <strong>{data.pipeline.totals.opportunity_count}</strong>
              <span>Across active CRM stages</span>
            </article>
            <article className="metric-card">
              <p>Estimated pipeline</p>
              <strong>{formatCurrency(data.pipeline.totals.total_estimated_value)}</strong>
              <span>Unweighted opportunity value</span>
            </article>
            <article className="metric-card metric-card--accent">
              <p>Weighted pipeline</p>
              <strong>{formatCurrency(data.pipeline.totals.weighted_pipeline_value)}</strong>
              <span>Probability-adjusted forecast</span>
            </article>
          </section>

          <section className="dashboard-panel pipeline-panel" aria-labelledby="pipeline-title">
            <div className="panel-heading">
              <div><p className="eyebrow">Pipeline</p><h2 id="pipeline-title">Stage breakdown</h2></div>
              <span className="data-badge">Live CRM data</span>
            </div>
            {data.pipeline.stages.length === 0 ? (
              <div className="panel-empty">No opportunity stages are available yet.</div>
            ) : (
              <div className="stage-list">
                {data.pipeline.stages.map((stage) => (
                  <article className="stage-row" key={stage.sales_stage}>
                    <div className="stage-label"><strong>{formatStage(stage.sales_stage)}</strong><span>{stage.opportunity_count} opportunities</span></div>
                    <div className="stage-bar" aria-label={`${formatStage(stage.sales_stage)}: ${stage.opportunity_count} opportunities`}><span style={{ width: `${(stage.opportunity_count / largestStageCount) * 100}%` }} /></div>
                    <div className="stage-value"><strong>{formatCurrency(stage.total_estimated_value)}</strong><span>Weighted {formatCurrency(stage.weighted_pipeline_value)}</span></div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="dashboard-split">
            <section className="dashboard-panel" aria-labelledby="activities-title">
              <div className="panel-heading"><div><p className="eyebrow">Engagement</p><h2 id="activities-title">Recent activities</h2></div><span className="panel-count">{data.activities.length}</span></div>
              {data.activities.length === 0 ? <div className="panel-empty">No recent activities recorded.</div> : (
                <div className="timeline-list">
                  {data.activities.map((activity) => (
                    <article className="timeline-item" key={activity.activity_id}>
                      <span className="timeline-marker" aria-hidden="true" />
                      <div><span className="type-label">{formatStage(activity.activity_type)}</span><h3>{activity.subject ?? "Untitled activity"}</h3><time dateTime={activity.activity_timestamp}>{formatTimestamp(activity.activity_timestamp)}</time>{activity.outcome && <p><strong>Outcome:</strong> {activity.outcome}</p>}{activity.next_action && <p><strong>Next:</strong> {activity.next_action}</p>}</div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="dashboard-panel" aria-labelledby="visits-title">
              <div className="panel-heading"><div><p className="eyebrow">Field intelligence</p><h2 id="visits-title">Recent field visits</h2></div><span className="panel-count">{data.fieldVisits.length}</span></div>
              {data.fieldVisits.length === 0 ? <div className="panel-empty">No recent field visits recorded.</div> : (
                <div className="visit-list">
                  {data.fieldVisits.map((visit) => (
                    <article className="visit-item" key={visit.visit_id}>
                      <div className="visit-date"><strong>{formatDate(visit.visit_date)}</strong><span>{visit.visit_type ? formatStage(visit.visit_type) : "Field visit"}</span></div>
                      <div><h3>{customersById.get(visit.customer_id) ?? `Customer #${visit.customer_id}`}</h3>{visit.purpose && <p>{visit.purpose}</p>}{visit.follow_up_date && <p className="follow-up"><strong>Follow-up:</strong> {formatDate(visit.follow_up_date)}</p>}</div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
