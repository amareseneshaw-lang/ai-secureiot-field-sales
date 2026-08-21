import { Fragment, useEffect, useState } from "react";

import {
  crmApi,
  type Customer,
  type NumericValue,
  type Opportunity,
} from "../api/client";
import { AIInsightCard } from "../components/AIInsightCard";

type LoadState = "loading" | "ready" | "error";

type OpportunitiesData = {
  opportunities: Opportunity[];
  customers: Customer[];
};

// Mirrors the canonical funnel order enforced by the backend's SALES_STAGES set.
const STAGE_ORDER = [
  "LEAD",
  "QUALIFICATION",
  "DISCOVERY",
  "FIELD_VISIT",
  "SITE_ASSESSMENT",
  "TECHNICAL_DISCOVERY",
  "SOLUTION_RECOMMENDATION",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
];

const PRIORITY_ORDER = ["HIGH", "MEDIUM", "LOW"];
const UNSPECIFIED_PRIORITY = "UNSPECIFIED";

function stageIndex(stage: string): number {
  const index = STAGE_ORDER.indexOf(stage);
  return index === -1 ? STAGE_ORDER.length : index;
}

function formatLabel(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCurrency(value: NumericValue | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatPercent(value: NumericValue | null): string {
  if (value === null) return "—";
  return `${Number(value).toFixed(0)}%`;
}

function formatDate(value: string | null): string {
  if (value === null) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function weightedValue(opportunity: Opportunity): number | null {
  if (opportunity.estimated_value === null || opportunity.probability === null) {
    return null;
  }
  return (Number(opportunity.estimated_value) * Number(opportunity.probability)) / 100;
}

function stageCategory(stage: string): "open" | "won" | "lost" {
  if (stage === "CLOSED_WON") return "won";
  if (stage === "CLOSED_LOST") return "lost";
  return "open";
}

function priorityModifier(priority: string | null): string {
  if (priority === null) return "default";
  return priority.toLowerCase();
}

export function OpportunitiesPage() {
  const [data, setData] = useState<OpportunitiesData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadOpportunities = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const [opportunities, customersResponse] = await Promise.all([
        crmApi.getOpportunities(),
        crmApi.getCustomers(),
      ]);
      setData({ opportunities, customers: customersResponse.customers });
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load opportunities.",
      );
    }
  };

  useEffect(() => {
    void loadOpportunities();
  }, []);

  const opportunities = data?.opportunities ?? [];
  const customersById = new Map(
    data?.customers.map((customer) => [customer.customer_id, customer.company_name]),
  );

  const customerName = (customerId: number) =>
    customersById.get(customerId) ?? `Customer #${customerId}`;

  const totalEstimatedValue = opportunities.reduce(
    (sum, opportunity) => sum + Number(opportunity.estimated_value ?? 0),
    0,
  );
  const totalWeightedValue = opportunities.reduce(
    (sum, opportunity) => sum + (weightedValue(opportunity) ?? 0),
    0,
  );

  const stageCounts = new Map<string, { count: number; estimated: number; weighted: number }>();
  for (const opportunity of opportunities) {
    const entry = stageCounts.get(opportunity.sales_stage) ?? {
      count: 0,
      estimated: 0,
      weighted: 0,
    };
    entry.count += 1;
    entry.estimated += Number(opportunity.estimated_value ?? 0);
    entry.weighted += weightedValue(opportunity) ?? 0;
    stageCounts.set(opportunity.sales_stage, entry);
  }
  const pipelineStages = Array.from(stageCounts.entries())
    .map(([stage, totals]) => ({ stage, ...totals }))
    .sort((a, b) => stageIndex(a.stage) - stageIndex(b.stage));
  const largestStageCount = Math.max(1, ...pipelineStages.map((stage) => stage.count));

  const stageOptions = Array.from(stageCounts.keys()).sort(
    (a, b) => stageIndex(a) - stageIndex(b),
  );
  const priorityValues = new Set(
    opportunities.map((opportunity) => opportunity.priority ?? UNSPECIFIED_PRIORITY),
  );
  const priorityOptions = Array.from(priorityValues).sort((a, b) => {
    const indexA = PRIORITY_ORDER.indexOf(a);
    const indexB = PRIORITY_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOpportunities = opportunities.filter((opportunity) => {
    const matchesSearch =
      normalizedSearch === "" ||
      opportunity.name.toLowerCase().includes(normalizedSearch) ||
      customerName(opportunity.customer_id).toLowerCase().includes(normalizedSearch);
    const matchesStage = stageFilter === "" || opportunity.sales_stage === stageFilter;
    const matchesPriority =
      priorityFilter === "" ||
      (priorityFilter === UNSPECIFIED_PRIORITY
        ? opportunity.priority === null
        : opportunity.priority === priorityFilter);
    return matchesSearch && matchesStage && matchesPriority;
  });

  const hasActiveFilters = searchTerm !== "" || stageFilter !== "" || priorityFilter !== "";
  const clearFilters = () => {
    setSearchTerm("");
    setStageFilter("");
    setPriorityFilter("");
  };

  const toggleStageFilter = (stage: string) => {
    setStageFilter((current) => (current === stage ? "" : stage));
  };

  const toggleExpanded = (opportunityId: number) => {
    setExpandedId((current) => (current === opportunityId ? null : opportunityId));
  };

  return (
    <section id="opportunities" className="page-content" aria-labelledby="opportunities-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">CRM / Pipeline</p>
          <h1 id="opportunities-title">Opportunities</h1>
          <p className="page-intro">
            Sales pipeline visibility across every active and closed opportunity.
          </p>
        </div>
        <button className="refresh-button" type="button" onClick={() => void loadOpportunities()}>
          Refresh data
        </button>
      </header>

      {loadState === "loading" && (
        <div className="state-card" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <div>
            <strong>Loading opportunities</strong>
            <p>Connecting to the CRM API…</p>
          </div>
        </div>
      )}

      {loadState === "error" && (
        <div className="state-card state-card--error" role="alert">
          <div>
            <strong>Opportunity data is unavailable</strong>
            <p>{errorMessage}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadOpportunities()}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && opportunities.length === 0 && (
        <div className="state-card state-card--empty">
          <div>
            <strong>No opportunities yet</strong>
            <p>New sales opportunities will appear here as they're created.</p>
          </div>
        </div>
      )}

      {loadState === "ready" && opportunities.length > 0 && (
        <div className="dashboard-content">
          <section className="metric-grid" aria-label="Pipeline totals">
            <article className="metric-card">
              <p>Total opportunities</p>
              <strong>{opportunities.length}</strong>
              <span>Across all sales stages</span>
            </article>
            <article className="metric-card">
              <p>Estimated pipeline</p>
              <strong>{formatCurrency(totalEstimatedValue)}</strong>
              <span>Unweighted opportunity value</span>
            </article>
            <article className="metric-card metric-card--accent">
              <p>Weighted pipeline</p>
              <strong>{formatCurrency(totalWeightedValue)}</strong>
              <span>Probability-adjusted forecast</span>
            </article>
          </section>

          <section className="dashboard-panel pipeline-panel" aria-labelledby="stage-pipeline-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Pipeline</p>
                <h2 id="stage-pipeline-title">Stage-by-stage breakdown</h2>
              </div>
              <span className="data-badge">Live CRM data</span>
            </div>
            <div className="stage-list">
              {pipelineStages.map((stage) => (
                <article
                  className={`stage-row stage-row--clickable${stageFilter === stage.stage ? " stage-row--active" : ""}`}
                  key={stage.stage}
                  role="button"
                  tabIndex={0}
                  aria-pressed={stageFilter === stage.stage}
                  onClick={() => toggleStageFilter(stage.stage)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleStageFilter(stage.stage);
                    }
                  }}
                >
                  <div className="stage-label">
                    <strong>{formatLabel(stage.stage)}</strong>
                    <span>{stage.count} opportunit{stage.count === 1 ? "y" : "ies"}</span>
                  </div>
                  <div
                    className="stage-bar"
                    aria-label={`${formatLabel(stage.stage)}: ${stage.count} opportunities`}
                  >
                    <span style={{ width: `${(stage.count / largestStageCount) * 100}%` }} />
                  </div>
                  <div className="stage-value">
                    <strong>{formatCurrency(stage.estimated)}</strong>
                    <span>Weighted {formatCurrency(stage.weighted)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="customers-card toolbar-card" aria-labelledby="opportunities-table-title">
            <div className="table-heading">
              <div>
                <h2 id="opportunities-table-title">Opportunity list</h2>
                <p>
                  {filteredOpportunities.length} of {opportunities.length} opportunit
                  {opportunities.length === 1 ? "y" : "ies"} shown
                </p>
              </div>
              <span className="data-badge">Live CRM data</span>
            </div>

            <div className="filters-row">
              <div className="search-field">
                <label className="visually-hidden" htmlFor="opportunity-search">
                  Search opportunities
                </label>
                <input
                  id="opportunity-search"
                  type="search"
                  placeholder="Search by opportunity or customer name…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <label className="visually-hidden" htmlFor="stage-filter">
                Filter by sales stage
              </label>
              <select
                id="stage-filter"
                className="filter-select"
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value)}
              >
                <option value="">All stages</option>
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    {formatLabel(stage)}
                  </option>
                ))}
              </select>

              <label className="visually-hidden" htmlFor="priority-filter">
                Filter by priority
              </label>
              <select
                id="priority-filter"
                className="filter-select"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="">All priorities</option>
                {priorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority === UNSPECIFIED_PRIORITY ? "Unspecified" : formatLabel(priority)}
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <button className="secondary-button" type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>

            {filteredOpportunities.length === 0 ? (
              <div className="panel-empty">No opportunities match the current filters.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Opportunity</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Sales stage</th>
                      <th scope="col">Estimated value</th>
                      <th scope="col">Probability</th>
                      <th scope="col">Weighted value</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Expected close date</th>
                      <th scope="col">Competitor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOpportunities.map((opportunity) => {
                      const isExpanded = expandedId === opportunity.opportunity_id;
                      return (
                        <Fragment key={opportunity.opportunity_id}>
                          <tr
                            className="opportunity-row"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpanded(opportunity.opportunity_id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleExpanded(opportunity.opportunity_id);
                              }
                            }}
                          >
                            <td><strong>{opportunity.name}</strong></td>
                            <td>{customerName(opportunity.customer_id)}</td>
                            <td>
                              <span className={`stage-badge stage-badge--${stageCategory(opportunity.sales_stage)}`}>
                                {formatLabel(opportunity.sales_stage)}
                              </span>
                            </td>
                            <td>{formatCurrency(opportunity.estimated_value)}</td>
                            <td>{formatPercent(opportunity.probability)}</td>
                            <td>{formatCurrency(weightedValue(opportunity))}</td>
                            <td>
                              {opportunity.priority === null ? (
                                "—"
                              ) : (
                                <span className={`priority-badge priority-badge--${priorityModifier(opportunity.priority)}`}>
                                  {formatLabel(opportunity.priority)}
                                </span>
                              )}
                            </td>
                            <td>{formatDate(opportunity.expected_close_date)}</td>
                            <td>{opportunity.competitor ?? "—"}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="opportunity-detail-row">
                              <td colSpan={9}>
                                <dl className="opportunity-detail">
                                  <div>
                                    <dt>Description</dt>
                                    <dd>{opportunity.description ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Site</dt>
                                    <dd>{opportunity.site_id === null ? "—" : `Site #${opportunity.site_id}`}</dd>
                                  </div>
                                  <div>
                                    <dt>Sales rep</dt>
                                    <dd>
                                      {opportunity.sales_rep_id === null
                                        ? "—"
                                        : `Rep #${opportunity.sales_rep_id}`}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Created</dt>
                                    <dd>{formatDateTime(opportunity.created_at)}</dd>
                                  </div>
                                  <div>
                                    <dt>Updated</dt>
                                    <dd>{formatDateTime(opportunity.updated_at)}</dd>
                                  </div>
                                </dl>

                                <AIInsightCard
                                  variant="opportunity"
                                  opportunityId={opportunity.opportunity_id}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
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
