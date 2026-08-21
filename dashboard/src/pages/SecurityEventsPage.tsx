import { useEffect, useState } from "react";

import { crmApi, type SecurityEvent, type Site } from "../api/client";

type LoadState = "loading" | "ready" | "error";

type SecurityEventsData = {
  events: SecurityEvent[];
  sites: Site[];
};

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

function formatLabel(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function severityModifier(severity: string): string {
  if (severity === "CRITICAL" || severity === "HIGH") return "high";
  if (severity === "MEDIUM") return "medium";
  return "low";
}

export function SecurityEventsPage() {
  const [data, setData] = useState<SecurityEventsData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const loadEvents = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const [eventsResponse, sitesResponse] = await Promise.all([
        crmApi.getSecurityEvents(),
        crmApi.getSites(),
      ]);
      setData({ events: eventsResponse.security_events, sites: sitesResponse.sites });
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load security events.",
      );
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  const events = data?.events ?? [];
  const sitesById = new Map(data?.sites.map((site) => [site.site_id, site.site_name]));
  const siteName = (siteId: number | null) =>
    siteId === null ? "—" : sitesById.get(siteId) ?? `Site #${siteId}`;

  const severityOptions = Array.from(new Set(events.map((event) => event.severity))).sort(
    (a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b),
  );
  const sourceOptions = Array.from(new Set(events.map((event) => event.source))).sort();

  const filteredEvents = events.filter((event) => {
    const matchesSeverity = severityFilter === "" || event.severity === severityFilter;
    const matchesStatus = statusFilter === "" || event.status === statusFilter;
    const matchesSource = sourceFilter === "" || event.source === sourceFilter;
    return matchesSeverity && matchesStatus && matchesSource;
  });

  const openCount = events.filter((event) => event.status === "OPEN").length;
  const criticalCount = events.filter(
    (event) => event.severity === "CRITICAL" || event.severity === "HIGH",
  ).length;

  const hasActiveFilters = severityFilter !== "" || statusFilter !== "" || sourceFilter !== "";
  const clearFilters = () => {
    setSeverityFilter("");
    setStatusFilter("");
    setSourceFilter("");
  };

  return (
    <section id="security-events" className="page-content" aria-labelledby="security-events-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">SecureIoT / Security</p>
          <h1 id="security-events-title">Security Events</h1>
          <p className="page-intro">
            Device alerts, access attempts, and offline devices across every SecureIoT site.
          </p>
        </div>
        <button className="refresh-button" type="button" onClick={() => void loadEvents()}>
          Refresh data
        </button>
      </header>

      {loadState === "loading" && (
        <div className="state-card" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <div>
            <strong>Loading security events</strong>
            <p>Connecting to the SecureIoT API…</p>
          </div>
        </div>
      )}

      {loadState === "error" && (
        <div className="state-card state-card--error" role="alert">
          <div>
            <strong>Security event data is unavailable</strong>
            <p>{errorMessage}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadEvents()}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && events.length === 0 && (
        <div className="state-card state-card--empty">
          <div>
            <strong>No security events yet</strong>
            <p>Device alerts and access events will appear here as they occur.</p>
          </div>
        </div>
      )}

      {loadState === "ready" && events.length > 0 && (
        <div className="dashboard-content">
          <section className="metric-grid" aria-label="Security event totals">
            <article className="metric-card">
              <p>Total events</p>
              <strong>{events.length}</strong>
              <span>Across all sites</span>
            </article>
            <article className={`metric-card${openCount > 0 ? " metric-card--accent" : ""}`}>
              <p>Open</p>
              <strong>{openCount}</strong>
              <span>Awaiting review</span>
            </article>
            <article className="metric-card">
              <p>High / Critical</p>
              <strong>{criticalCount}</strong>
              <span>Elevated severity</span>
            </article>
          </section>

          <section className="customers-card toolbar-card" aria-labelledby="events-table-title">
            <div className="table-heading">
              <div>
                <h2 id="events-table-title">Event history</h2>
                <p>
                  {filteredEvents.length} of {events.length} event
                  {events.length === 1 ? "" : "s"} shown
                </p>
              </div>
              <span className="data-badge">Live CRM data</span>
            </div>

            <div className="filters-row">
              <label className="visually-hidden" htmlFor="severity-filter">
                Filter by severity
              </label>
              <select
                id="severity-filter"
                className="filter-select"
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
              >
                <option value="">All severities</option>
                {severityOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatLabel(option)}
                  </option>
                ))}
              </select>

              <label className="visually-hidden" htmlFor="status-filter">
                Filter by status
              </label>
              <select
                id="status-filter"
                className="filter-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="RESOLVED">Resolved</option>
              </select>

              <label className="visually-hidden" htmlFor="source-filter">
                Filter by source
              </label>
              <select
                id="source-filter"
                className="filter-select"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value="">All sources</option>
                {sourceOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatLabel(option)}
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <button className="secondary-button" type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>

            {filteredEvents.length === 0 ? (
              <div className="panel-empty">No events match the current filters.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Timestamp</th>
                      <th scope="col">Site</th>
                      <th scope="col">Source</th>
                      <th scope="col">Event type</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Status</th>
                      <th scope="col">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => (
                      <tr key={`${event.source}-${event.source_id}`}>
                        <td>{formatDateTime(event.event_timestamp)}</td>
                        <td>{siteName(event.site_id)}</td>
                        <td>{formatLabel(event.source)}</td>
                        <td>{formatLabel(event.event_type)}</td>
                        <td>
                          <span className={`priority-badge priority-badge--${severityModifier(event.severity)}`}>
                            {event.severity}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-badge status-badge--${event.status === "OPEN" ? "inactive" : "active"}`}
                          >
                            {formatLabel(event.status)}
                          </span>
                        </td>
                        <td>{event.description ?? "—"}</td>
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
