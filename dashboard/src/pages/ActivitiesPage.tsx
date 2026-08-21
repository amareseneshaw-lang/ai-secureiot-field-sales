import { Fragment, useEffect, useState } from "react";

import { crmApi, type Activity, type Customer, type Opportunity } from "../api/client";

type LoadState = "loading" | "ready" | "error";

type ActivitiesData = {
  activities: Activity[];
  customers: Customer[];
  opportunities: Opportunity[];
};

type SortDirection = "desc" | "asc";

function formatLabel(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export function ActivitiesPage() {
  const [data, setData] = useState<ActivitiesData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadActivities = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const [activities, customersResponse, opportunities] = await Promise.all([
        crmApi.getActivities(),
        crmApi.getCustomers(),
        crmApi.getOpportunities(),
      ]);
      setData({ activities, customers: customersResponse.customers, opportunities });
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load activities.",
      );
    }
  };

  useEffect(() => {
    void loadActivities();
  }, []);

  const activities = data?.activities ?? [];
  const customersById = new Map(
    data?.customers.map((customer) => [customer.customer_id, customer.company_name]),
  );
  const opportunitiesById = new Map(
    data?.opportunities.map((opportunity) => [opportunity.opportunity_id, opportunity.name]),
  );
  const customerName = (customerId: number | null) =>
    customerId === null ? null : customersById.get(customerId) ?? `Customer #${customerId}`;
  const opportunityName = (opportunityId: number | null) =>
    opportunityId === null
      ? null
      : opportunitiesById.get(opportunityId) ?? `Opportunity #${opportunityId}`;

  const now = new Date();
  const activitiesThisMonth = activities.filter((activity) => {
    const timestamp = new Date(activity.activity_timestamp);
    return timestamp.getFullYear() === now.getFullYear() && timestamp.getMonth() === now.getMonth();
  }).length;
  const uniqueCustomerCount = new Set(
    activities.map((activity) => activity.customer_id).filter((id) => id !== null),
  ).size;

  const typeCounts = new Map<string, number>();
  for (const activity of activities) {
    typeCounts.set(activity.activity_type, (typeCounts.get(activity.activity_type) ?? 0) + 1);
  }
  const typeBreakdown = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  const largestTypeCount = Math.max(1, ...typeBreakdown.map((entry) => entry.count));

  const typeOptions = Array.from(typeCounts.keys()).sort((a, b) => a.localeCompare(b));

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

  const filteredActivities = activities.filter((activity) => {
    const matchesSearch =
      normalizedSearch === "" ||
      (customerName(activity.customer_id) ?? "").toLowerCase().includes(normalizedSearch) ||
      (opportunityName(activity.opportunity_id) ?? "").toLowerCase().includes(normalizedSearch) ||
      (activity.subject ?? "").toLowerCase().includes(normalizedSearch) ||
      (activity.description ?? "").toLowerCase().includes(normalizedSearch) ||
      (activity.outcome ?? "").toLowerCase().includes(normalizedSearch) ||
      (activity.next_action ?? "").toLowerCase().includes(normalizedSearch);
    const matchesType = typeFilter === "" || activity.activity_type === typeFilter;
    const timestamp = new Date(activity.activity_timestamp);
    const matchesFrom = fromDate === null || timestamp >= fromDate;
    const matchesTo = toDate === null || timestamp <= toDate;
    return matchesSearch && matchesType && matchesFrom && matchesTo;
  });

  const sortedActivities = [...filteredActivities].sort((a, b) => {
    const diff =
      new Date(a.activity_timestamp).getTime() - new Date(b.activity_timestamp).getTime();
    const tiebreak = a.activity_id - b.activity_id;
    const primary = sortDirection === "asc" ? diff : -diff;
    return primary !== 0 ? primary : sortDirection === "asc" ? tiebreak : -tiebreak;
  });

  const hasActiveFilters =
    searchTerm !== "" || typeFilter !== "" || dateFrom !== "" || dateTo !== "";
  const clearFilters = () => {
    setSearchTerm("");
    setTypeFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const toggleTypeFilter = (type: string) => {
    setTypeFilter((current) => (current === type ? "" : type));
  };

  const toggleExpanded = (activityId: number) => {
    setExpandedId((current) => (current === activityId ? null : activityId));
  };

  return (
    <section id="activities" className="page-content" aria-labelledby="activities-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">CRM / Engagement</p>
          <h1 id="activities-title">Activities</h1>
          <p className="page-intro">
            Every logged touchpoint across customers and opportunities, in one timeline.
          </p>
        </div>
        <button className="refresh-button" type="button" onClick={() => void loadActivities()}>
          Refresh data
        </button>
      </header>

      {loadState === "loading" && (
        <div className="state-card" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <div>
            <strong>Loading activities</strong>
            <p>Connecting to the CRM API…</p>
          </div>
        </div>
      )}

      {loadState === "error" && (
        <div className="state-card state-card--error" role="alert">
          <div>
            <strong>Activity data is unavailable</strong>
            <p>{errorMessage}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadActivities()}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && activities.length === 0 && (
        <div className="state-card state-card--empty">
          <div>
            <strong>No activities yet</strong>
            <p>New customer and opportunity engagement will appear here as it's logged.</p>
          </div>
        </div>
      )}

      {loadState === "ready" && activities.length > 0 && (
        <div className="dashboard-content">
          <section className="metric-grid" aria-label="Activity totals">
            <article className="metric-card">
              <p>Total activities</p>
              <strong>{activities.length}</strong>
              <span>Logged engagement</span>
            </article>
            <article className="metric-card">
              <p>Activities this month</p>
              <strong>{activitiesThisMonth}</strong>
              <span>{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            </article>
            <article className="metric-card metric-card--accent">
              <p>Unique customers</p>
              <strong>{uniqueCustomerCount}</strong>
              <span>Accounts engaged</span>
            </article>
          </section>

          <section className="dashboard-panel pipeline-panel" aria-labelledby="activity-type-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Engagement</p>
                <h2 id="activity-type-title">Activities by type</h2>
              </div>
              <span className="data-badge">Live CRM data</span>
            </div>
            <div className="stage-list">
              {typeBreakdown.map((entry) => (
                <article
                  className={`stage-row stage-row--clickable${typeFilter === entry.type ? " stage-row--active" : ""}`}
                  key={entry.type}
                  role="button"
                  tabIndex={0}
                  aria-pressed={typeFilter === entry.type}
                  onClick={() => toggleTypeFilter(entry.type)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleTypeFilter(entry.type);
                    }
                  }}
                >
                  <div className="stage-label">
                    <strong>{formatLabel(entry.type)}</strong>
                    <span>{entry.count} activit{entry.count === 1 ? "y" : "ies"}</span>
                  </div>
                  <div
                    className="stage-bar"
                    aria-label={`${formatLabel(entry.type)}: ${entry.count} activities`}
                  >
                    <span style={{ width: `${(entry.count / largestTypeCount) * 100}%` }} />
                  </div>
                  <div className="stage-value">
                    <strong>{entry.count}</strong>
                    <span>of {activities.length} total</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="customers-card toolbar-card" aria-labelledby="activities-table-title">
            <div className="table-heading">
              <div>
                <h2 id="activities-table-title">Activity timeline</h2>
                <p>
                  {filteredActivities.length} of {activities.length} activit
                  {activities.length === 1 ? "y" : "ies"} shown
                </p>
              </div>
              <span className="data-badge">Live CRM data</span>
            </div>

            <div className="filters-row">
              <div className="search-field">
                <label className="visually-hidden" htmlFor="activity-search">
                  Search activities
                </label>
                <input
                  id="activity-search"
                  type="search"
                  placeholder="Search by customer, opportunity, subject, or outcome…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <label className="visually-hidden" htmlFor="activity-type-filter">
                Filter by activity type
              </label>
              <select
                id="activity-type-filter"
                className="filter-select"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="">All activity types</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {formatLabel(type)}
                  </option>
                ))}
              </select>

              <label className="visually-hidden" htmlFor="activity-date-from">
                From date
              </label>
              <input
                id="activity-date-from"
                className="filter-select"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />

              <label className="visually-hidden" htmlFor="activity-date-to">
                To date
              </label>
              <input
                id="activity-date-to"
                className="filter-select"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />

              <label className="visually-hidden" htmlFor="activity-sort">
                Sort by timestamp
              </label>
              <select
                id="activity-sort"
                className="filter-select"
                value={sortDirection}
                onChange={(event) => setSortDirection(event.target.value as SortDirection)}
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>

              {hasActiveFilters && (
                <button className="secondary-button" type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>

            {filteredActivities.length === 0 ? (
              <div className="panel-empty">No activities match the current filters.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Timestamp</th>
                      <th scope="col">Type</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Subject</th>
                      <th scope="col">Sales representative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedActivities.map((activity) => {
                      const isExpanded = expandedId === activity.activity_id;
                      const customer = customerName(activity.customer_id);
                      return (
                        <Fragment key={activity.activity_id}>
                          <tr
                            className="activity-row"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpanded(activity.activity_id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleExpanded(activity.activity_id);
                              }
                            }}
                          >
                            <td><strong>{formatDateTime(activity.activity_timestamp)}</strong></td>
                            <td>
                              <span className="activity-type-badge">
                                {formatLabel(activity.activity_type)}
                              </span>
                            </td>
                            <td>
                              {activity.customer_id === null ? (
                                "—"
                              ) : (
                                <a
                                  className="table-link"
                                  href={`#customers/${activity.customer_id}`}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {customer} →
                                </a>
                              )}
                            </td>
                            <td>{activity.subject ?? "—"}</td>
                            <td>
                              {activity.user_id === null ? "—" : `Rep #${activity.user_id}`}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="activity-detail-row">
                              <td colSpan={5}>
                                <dl className="activity-detail">
                                  <div>
                                    <dt>Opportunity</dt>
                                    <dd>{opportunityName(activity.opportunity_id) ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Description</dt>
                                    <dd>{activity.description ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Outcome</dt>
                                    <dd>{activity.outcome ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Next action</dt>
                                    <dd>{activity.next_action ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Created</dt>
                                    <dd>{formatDateTime(activity.created_at)}</dd>
                                  </div>
                                </dl>
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
