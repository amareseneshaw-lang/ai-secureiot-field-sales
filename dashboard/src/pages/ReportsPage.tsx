import { useEffect, useState } from "react";

import {
  crmApi,
  type Activity,
  type Customer,
  type FieldVisit,
  type NumericValue,
  type Opportunity,
} from "../api/client";

type LoadState = "loading" | "ready" | "error";

type ReportsData = {
  customers: Customer[];
  opportunities: Opportunity[];
  fieldVisits: FieldVisit[];
  activities: Activity[];
};

type SortBy = "pipeline" | "engagement" | "name";

type AccountRow = {
  customer: Customer;
  opportunityCount: number;
  pipelineValue: number;
  weightedValue: number;
  fieldVisitCount: number;
  activityCount: number;
  lastEngagement: Date | null;
};

const MONTHS_TO_SHOW = 6;

function formatCurrency(value: NumericValue): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDate(value: Date | null): string {
  if (value === null) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(value);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("pipeline");

  const loadReports = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const [customersResponse, opportunities, fieldVisits, activities] = await Promise.all([
        crmApi.getCustomers(),
        crmApi.getOpportunities(),
        crmApi.getFieldVisits(),
        crmApi.getActivities(),
      ]);
      setData({
        customers: customersResponse.customers,
        opportunities,
        fieldVisits,
        activities,
      });
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load reports.",
      );
    }
  };

  useEffect(() => {
    void loadReports();
  }, []);

  const customers = data?.customers ?? [];
  const opportunities = data?.opportunities ?? [];
  const fieldVisits = data?.fieldVisits ?? [];
  const activities = data?.activities ?? [];

  const totalPipelineValue = opportunities.reduce(
    (sum, opportunity) => sum + Number(opportunity.estimated_value ?? 0),
    0,
  );
  const totalWeightedValue = opportunities.reduce((sum, opportunity) => {
    if (opportunity.estimated_value === null || opportunity.probability === null) return sum;
    return sum + (Number(opportunity.estimated_value) * Number(opportunity.probability)) / 100;
  }, 0);

  const closedWon = opportunities.filter((opportunity) => opportunity.sales_stage === "CLOSED_WON");
  const closedLost = opportunities.filter((opportunity) => opportunity.sales_stage === "CLOSED_LOST");
  const openOpportunities = opportunities.filter(
    (opportunity) => opportunity.sales_stage !== "CLOSED_WON" && opportunity.sales_stage !== "CLOSED_LOST",
  );
  const closedWonValue = closedWon.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
  const closedLostValue = closedLost.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
  const openValue = openOpportunities.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
  const decidedCount = closedWon.length + closedLost.length;
  const winRate = decidedCount === 0 ? null : (closedWon.length / decidedCount) * 100;
  const largestOutcomeCount = Math.max(1, closedWon.length, closedLost.length, openOpportunities.length);

  const now = new Date();
  const monthBuckets: { key: string; label: string; visits: number; activities: number }[] = [];
  for (let i = MONTHS_TO_SHOW - 1; i >= 0; i -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({ key: monthKey(bucketDate), label: monthLabel(bucketDate), visits: 0, activities: 0 });
  }
  const bucketsByKey = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));
  for (const visit of fieldVisits) {
    const bucket = bucketsByKey.get(monthKey(new Date(visit.visit_date)));
    if (bucket) bucket.visits += 1;
  }
  for (const activity of activities) {
    const bucket = bucketsByKey.get(monthKey(new Date(activity.activity_timestamp)));
    if (bucket) bucket.activities += 1;
  }
  const largestMonthTotal = Math.max(
    1,
    ...monthBuckets.map((bucket) => bucket.visits + bucket.activities),
  );

  const accountRows: AccountRow[] = customers.map((customer) => {
    const customerOpportunities = opportunities.filter((o) => o.customer_id === customer.customer_id);
    const customerVisits = fieldVisits.filter((v) => v.customer_id === customer.customer_id);
    const customerActivities = activities.filter((a) => a.customer_id === customer.customer_id);
    const pipelineValue = customerOpportunities.reduce(
      (sum, o) => sum + Number(o.estimated_value ?? 0),
      0,
    );
    const weightedValue = customerOpportunities.reduce((sum, o) => {
      if (o.estimated_value === null || o.probability === null) return sum;
      return sum + (Number(o.estimated_value) * Number(o.probability)) / 100;
    }, 0);
    const engagementDates = [
      ...customerVisits.map((v) => new Date(v.visit_date)),
      ...customerActivities.map((a) => new Date(a.activity_timestamp)),
    ];
    const lastEngagement =
      engagementDates.length === 0
        ? null
        : new Date(Math.max(...engagementDates.map((d) => d.getTime())));

    return {
      customer,
      opportunityCount: customerOpportunities.length,
      pipelineValue,
      weightedValue,
      fieldVisitCount: customerVisits.length,
      activityCount: customerActivities.length,
      lastEngagement,
    };
  });

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredRows = accountRows.filter(
    (row) =>
      normalizedSearch === "" ||
      row.customer.company_name.toLowerCase().includes(normalizedSearch) ||
      (row.customer.industry ?? "").toLowerCase().includes(normalizedSearch),
  );

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sortBy === "name") return a.customer.company_name.localeCompare(b.customer.company_name);
    if (sortBy === "engagement") {
      return b.fieldVisitCount + b.activityCount - (a.fieldVisitCount + a.activityCount);
    }
    return b.pipelineValue - a.pipelineValue;
  });

  return (
    <section id="reports" className="page-content" aria-labelledby="reports-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">CRM / Reports</p>
          <h1 id="reports-title">Reports</h1>
          <p className="page-intro">
            Cross-account performance: pipeline health, engagement trends, and account coverage.
          </p>
        </div>
        <button className="refresh-button" type="button" onClick={() => void loadReports()}>
          Refresh data
        </button>
      </header>

      {loadState === "loading" && (
        <div className="state-card" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <div>
            <strong>Loading reports</strong>
            <p>Aggregating pipeline, field visit, and activity data…</p>
          </div>
        </div>
      )}

      {loadState === "error" && (
        <div className="state-card state-card--error" role="alert">
          <div>
            <strong>Report data is unavailable</strong>
            <p>{errorMessage}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadReports()}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && customers.length === 0 && (
        <div className="state-card state-card--empty">
          <div>
            <strong>No data to report on yet</strong>
            <p>Reports will populate once customers, opportunities, and engagement are recorded.</p>
          </div>
        </div>
      )}

      {loadState === "ready" && customers.length > 0 && (
        <div className="dashboard-content">
          <section className="metric-grid" aria-label="Executive summary">
            <article className="metric-card">
              <p>Total customers</p>
              <strong>{customers.length}</strong>
              <span>Active accounts</span>
            </article>
            <article className="metric-card">
              <p>Total pipeline</p>
              <strong>{formatCurrency(totalPipelineValue)}</strong>
              <span>Across {opportunities.length} opportunities</span>
            </article>
            <article className="metric-card metric-card--accent">
              <p>Weighted pipeline</p>
              <strong>{formatCurrency(totalWeightedValue)}</strong>
              <span>Probability-adjusted forecast</span>
            </article>
            <article className="metric-card">
              <p>Win rate</p>
              <strong>{winRate === null ? "—" : `${winRate.toFixed(0)}%`}</strong>
              <span>{decidedCount} closed opportunit{decidedCount === 1 ? "y" : "ies"}</span>
            </article>
            <article className="metric-card">
              <p>Field visits</p>
              <strong>{fieldVisits.length}</strong>
              <span>Total recorded visits</span>
            </article>
            <article className="metric-card">
              <p>Activities</p>
              <strong>{activities.length}</strong>
              <span>Total logged engagement</span>
            </article>
          </section>

          <div className="dashboard-split">
            <section className="dashboard-panel pipeline-panel" aria-labelledby="win-loss-title">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Pipeline</p>
                  <h2 id="win-loss-title">Win / loss performance</h2>
                </div>
                <span className="data-badge">Live CRM data</span>
              </div>
              <div className="stage-list">
                <article className="stage-row">
                  <div className="stage-label">
                    <strong>Closed won</strong>
                    <span>{closedWon.length} opportunit{closedWon.length === 1 ? "y" : "ies"}</span>
                  </div>
                  <div className="stage-bar" aria-label={`Closed won: ${closedWon.length}`}>
                    <span style={{ width: `${(closedWon.length / largestOutcomeCount) * 100}%` }} />
                  </div>
                  <div className="stage-value">
                    <strong>{formatCurrency(closedWonValue)}</strong>
                    <span>Won value</span>
                  </div>
                </article>
                <article className="stage-row">
                  <div className="stage-label">
                    <strong>Closed lost</strong>
                    <span>{closedLost.length} opportunit{closedLost.length === 1 ? "y" : "ies"}</span>
                  </div>
                  <div className="stage-bar" aria-label={`Closed lost: ${closedLost.length}`}>
                    <span style={{ width: `${(closedLost.length / largestOutcomeCount) * 100}%` }} />
                  </div>
                  <div className="stage-value">
                    <strong>{formatCurrency(closedLostValue)}</strong>
                    <span>Lost value</span>
                  </div>
                </article>
                <article className="stage-row">
                  <div className="stage-label">
                    <strong>Open pipeline</strong>
                    <span>{openOpportunities.length} opportunit{openOpportunities.length === 1 ? "y" : "ies"}</span>
                  </div>
                  <div className="stage-bar" aria-label={`Open pipeline: ${openOpportunities.length}`}>
                    <span style={{ width: `${(openOpportunities.length / largestOutcomeCount) * 100}%` }} />
                  </div>
                  <div className="stage-value">
                    <strong>{formatCurrency(openValue)}</strong>
                    <span>Open value</span>
                  </div>
                </article>
              </div>
            </section>

            <section className="dashboard-panel" aria-labelledby="engagement-trend-title">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Engagement</p>
                  <h2 id="engagement-trend-title">Engagement by month</h2>
                </div>
                <span className="data-badge">Live CRM data</span>
              </div>
              <div className="stage-list">
                {monthBuckets.map((bucket) => {
                  const total = bucket.visits + bucket.activities;
                  return (
                    <article className="stage-row" key={bucket.key}>
                      <div className="stage-label">
                        <strong>{bucket.label}</strong>
                        <span>{bucket.visits} visit{bucket.visits === 1 ? "" : "s"} · {bucket.activities} activit{bucket.activities === 1 ? "y" : "ies"}</span>
                      </div>
                      <div className="stage-bar" aria-label={`${bucket.label}: ${total} engagement events`}>
                        <span style={{ width: `${(total / largestMonthTotal) * 100}%` }} />
                      </div>
                      <div className="stage-value">
                        <strong>{total}</strong>
                        <span>events</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="customers-card toolbar-card" aria-labelledby="account-coverage-title">
            <div className="table-heading">
              <div>
                <h2 id="account-coverage-title">Account coverage</h2>
                <p>
                  {filteredRows.length} of {accountRows.length} account
                  {accountRows.length === 1 ? "" : "s"} shown
                </p>
              </div>
              <span className="data-badge">Live CRM data</span>
            </div>

            <div className="filters-row">
              <div className="search-field">
                <label className="visually-hidden" htmlFor="report-search">
                  Search accounts
                </label>
                <input
                  id="report-search"
                  type="search"
                  placeholder="Search by account or industry…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <label className="visually-hidden" htmlFor="report-sort">
                Sort accounts
              </label>
              <select
                id="report-sort"
                className="filter-select"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortBy)}
              >
                <option value="pipeline">Highest pipeline value</option>
                <option value="engagement">Most engagement</option>
                <option value="name">Account name (A–Z)</option>
              </select>
            </div>

            {filteredRows.length === 0 ? (
              <div className="panel-empty">No accounts match the current search.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Industry</th>
                      <th scope="col">Status</th>
                      <th scope="col">Opportunities</th>
                      <th scope="col">Pipeline value</th>
                      <th scope="col">Weighted value</th>
                      <th scope="col">Field visits</th>
                      <th scope="col">Activities</th>
                      <th scope="col">Last engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr
                        className="customer-row"
                        key={row.customer.customer_id}
                        tabIndex={0}
                        role="button"
                        aria-label={`View ${row.customer.company_name} details`}
                        onClick={() => {
                          window.location.hash = `#customers/${row.customer.customer_id}`;
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            window.location.hash = `#customers/${row.customer.customer_id}`;
                          }
                        }}
                      >
                        <td><strong>{row.customer.company_name}</strong></td>
                        <td>{row.customer.industry ?? "—"}</td>
                        <td>
                          <span
                            className={`status-badge status-badge--${row.customer.account_status.toLowerCase()}`}
                          >
                            {row.customer.account_status}
                          </span>
                        </td>
                        <td>{row.opportunityCount}</td>
                        <td>{formatCurrency(row.pipelineValue)}</td>
                        <td>{formatCurrency(row.weightedValue)}</td>
                        <td>{row.fieldVisitCount}</td>
                        <td>{row.activityCount}</td>
                        <td>{formatDate(row.lastEngagement)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
