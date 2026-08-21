import { Fragment, useEffect, useState } from "react";

import { crmApi, type Customer, type FieldVisit } from "../api/client";

type LoadState = "loading" | "ready" | "error";

type FieldVisitsData = {
  fieldVisits: FieldVisit[];
  customers: Customer[];
};

type SortDirection = "desc" | "asc";

const UNSPECIFIED_TYPE = "UNSPECIFIED";

function formatLabel(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function formatCount(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function FieldVisitsPage() {
  const [data, setData] = useState<FieldVisitsData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadFieldVisits = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const [fieldVisits, customersResponse] = await Promise.all([
        crmApi.getFieldVisits(),
        crmApi.getCustomers(),
      ]);
      setData({ fieldVisits, customers: customersResponse.customers });
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load field visits.",
      );
    }
  };

  useEffect(() => {
    void loadFieldVisits();
  }, []);

  const fieldVisits = data?.fieldVisits ?? [];
  const customersById = new Map(
    data?.customers.map((customer) => [customer.customer_id, customer.company_name]),
  );
  const customerName = (customerId: number) =>
    customersById.get(customerId) ?? `Customer #${customerId}`;

  const now = new Date();
  const visitsThisMonth = fieldVisits.filter((visit) => {
    const visitDate = new Date(visit.visit_date);
    return visitDate.getFullYear() === now.getFullYear() && visitDate.getMonth() === now.getMonth();
  }).length;
  const uniqueCustomerCount = new Set(fieldVisits.map((visit) => visit.customer_id)).size;

  const typeCounts = new Map<string, number>();
  for (const visit of fieldVisits) {
    const key = visit.visit_type ?? UNSPECIFIED_TYPE;
    typeCounts.set(key, (typeCounts.get(key) ?? 0) + 1);
  }
  const typeBreakdown = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  const largestTypeCount = Math.max(1, ...typeBreakdown.map((entry) => entry.count));

  const typeOptions = Array.from(typeCounts.keys()).sort((a, b) => {
    if (a === UNSPECIFIED_TYPE) return 1;
    if (b === UNSPECIFIED_TYPE) return -1;
    return a.localeCompare(b);
  });

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

  const filteredFieldVisits = fieldVisits.filter((visit) => {
    const matchesSearch =
      normalizedSearch === "" ||
      customerName(visit.customer_id).toLowerCase().includes(normalizedSearch) ||
      (visit.purpose ?? "").toLowerCase().includes(normalizedSearch) ||
      (visit.customer_needs ?? "").toLowerCase().includes(normalizedSearch) ||
      (visit.pain_points ?? "").toLowerCase().includes(normalizedSearch);
    const matchesType =
      typeFilter === "" ||
      (typeFilter === UNSPECIFIED_TYPE ? visit.visit_type === null : visit.visit_type === typeFilter);
    const visitDate = new Date(visit.visit_date);
    const matchesFrom = fromDate === null || visitDate >= fromDate;
    const matchesTo = toDate === null || visitDate <= toDate;
    return matchesSearch && matchesType && matchesFrom && matchesTo;
  });

  const sortedFieldVisits = [...filteredFieldVisits].sort((a, b) => {
    const diff = new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime();
    const tiebreak = a.visit_id - b.visit_id;
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

  const toggleExpanded = (visitId: number) => {
    setExpandedId((current) => (current === visitId ? null : visitId));
  };

  return (
    <section id="field-visits" className="page-content" aria-labelledby="field-visits-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">CRM / Field Intelligence</p>
          <h1 id="field-visits-title">Field Visits</h1>
          <p className="page-intro">
            Site assessments and on-site engagement across your install base.
          </p>
        </div>
        <button className="refresh-button" type="button" onClick={() => void loadFieldVisits()}>
          Refresh data
        </button>
      </header>

      {loadState === "loading" && (
        <div className="state-card" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <div>
            <strong>Loading field visits</strong>
            <p>Connecting to the CRM API…</p>
          </div>
        </div>
      )}

      {loadState === "error" && (
        <div className="state-card state-card--error" role="alert">
          <div>
            <strong>Field visit data is unavailable</strong>
            <p>{errorMessage}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadFieldVisits()}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && fieldVisits.length === 0 && (
        <div className="state-card state-card--empty">
          <div>
            <strong>No field visits yet</strong>
            <p>New site visits will appear here as they're recorded.</p>
          </div>
        </div>
      )}

      {loadState === "ready" && fieldVisits.length > 0 && (
        <div className="dashboard-content">
          <section className="metric-grid" aria-label="Field visit totals">
            <article className="metric-card">
              <p>Total field visits</p>
              <strong>{fieldVisits.length}</strong>
              <span>Recorded site visits</span>
            </article>
            <article className="metric-card">
              <p>Visits this month</p>
              <strong>{visitsThisMonth}</strong>
              <span>{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            </article>
            <article className="metric-card metric-card--accent">
              <p>Unique customers</p>
              <strong>{uniqueCustomerCount}</strong>
              <span>Accounts visited on-site</span>
            </article>
          </section>

          <section className="dashboard-panel pipeline-panel" aria-labelledby="visit-type-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Field intelligence</p>
                <h2 id="visit-type-title">Visits by type</h2>
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
                    <strong>
                      {entry.type === UNSPECIFIED_TYPE ? "Unspecified" : formatLabel(entry.type)}
                    </strong>
                    <span>{entry.count} visit{entry.count === 1 ? "" : "s"}</span>
                  </div>
                  <div
                    className="stage-bar"
                    aria-label={`${entry.type === UNSPECIFIED_TYPE ? "Unspecified" : formatLabel(entry.type)}: ${entry.count} visits`}
                  >
                    <span style={{ width: `${(entry.count / largestTypeCount) * 100}%` }} />
                  </div>
                  <div className="stage-value">
                    <strong>{entry.count}</strong>
                    <span>of {fieldVisits.length} total</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="customers-card toolbar-card" aria-labelledby="field-visits-table-title">
            <div className="table-heading">
              <div>
                <h2 id="field-visits-table-title">Visit history</h2>
                <p>
                  {filteredFieldVisits.length} of {fieldVisits.length} visit
                  {fieldVisits.length === 1 ? "" : "s"} shown
                </p>
              </div>
              <span className="data-badge">Live CRM data</span>
            </div>

            <div className="filters-row">
              <div className="search-field">
                <label className="visually-hidden" htmlFor="visit-search">
                  Search field visits
                </label>
                <input
                  id="visit-search"
                  type="search"
                  placeholder="Search by customer, purpose, needs, or pain points…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <label className="visually-hidden" htmlFor="visit-type-filter">
                Filter by visit type
              </label>
              <select
                id="visit-type-filter"
                className="filter-select"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="">All visit types</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type === UNSPECIFIED_TYPE ? "Unspecified" : formatLabel(type)}
                  </option>
                ))}
              </select>

              <label className="visually-hidden" htmlFor="visit-date-from">
                From date
              </label>
              <input
                id="visit-date-from"
                className="filter-select"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />

              <label className="visually-hidden" htmlFor="visit-date-to">
                To date
              </label>
              <input
                id="visit-date-to"
                className="filter-select"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />

              <label className="visually-hidden" htmlFor="visit-sort">
                Sort by visit date
              </label>
              <select
                id="visit-sort"
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

            {filteredFieldVisits.length === 0 ? (
              <div className="panel-empty">No field visits match the current filters.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Visit date</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Visit type</th>
                      <th scope="col">Sales representative</th>
                      <th scope="col">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFieldVisits.map((visit) => {
                      const isExpanded = expandedId === visit.visit_id;
                      return (
                        <Fragment key={visit.visit_id}>
                          <tr
                            className="visit-row"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpanded(visit.visit_id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleExpanded(visit.visit_id);
                              }
                            }}
                          >
                            <td><strong>{formatDate(visit.visit_date)}</strong></td>
                            <td>
                              <a
                                className="table-link"
                                href={`#customers/${visit.customer_id}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {customerName(visit.customer_id)} →
                              </a>
                            </td>
                            <td>
                              {visit.visit_type === null ? (
                                "—"
                              ) : (
                                <span className="visit-type-badge">{formatLabel(visit.visit_type)}</span>
                              )}
                            </td>
                            <td>
                              {visit.sales_rep_id === null ? "—" : `Rep #${visit.sales_rep_id}`}
                            </td>
                            <td>{visit.purpose ?? "—"}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="visit-detail-row">
                              <td colSpan={5}>
                                <dl className="visit-detail">
                                  <div>
                                    <dt>Customer needs</dt>
                                    <dd>{visit.customer_needs ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Pain points</dt>
                                    <dd>{visit.pain_points ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Recommended solution</dt>
                                    <dd>{visit.recommended_solution ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Existing system</dt>
                                    <dd>{visit.existing_system ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Technical requirements</dt>
                                    <dd>{visit.technical_requirements ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Door count</dt>
                                    <dd>{formatCount(visit.door_count)}</dd>
                                  </div>
                                  <div>
                                    <dt>Site employee count</dt>
                                    <dd>{formatCount(visit.employee_count)}</dd>
                                  </div>
                                  <div>
                                    <dt>Next action</dt>
                                    <dd>{visit.next_action ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Follow-up date</dt>
                                    <dd>{formatDate(visit.follow_up_date)}</dd>
                                  </div>
                                  <div>
                                    <dt>Site</dt>
                                    <dd>{visit.site_id === null ? "—" : `Site #${visit.site_id}`}</dd>
                                  </div>
                                  <div>
                                    <dt>Created</dt>
                                    <dd>{formatDateTime(visit.created_at)}</dd>
                                  </div>
                                  <div>
                                    <dt>Updated</dt>
                                    <dd>{formatDateTime(visit.updated_at)}</dd>
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
