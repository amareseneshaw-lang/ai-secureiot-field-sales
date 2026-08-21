import { useEffect, useState } from "react";

import { crmApi, type SecureIoTDashboardSummary } from "../api/client";

type LoadState = "loading" | "ready" | "error";

function healthModifier(status: string): string {
  if (status === "CRITICAL") return "inactive";
  if (status === "AT_RISK") return "prospect";
  return "active";
}

function healthLabel(status: string): string {
  if (status === "AT_RISK") return "At Risk";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function SecureIoTDashboardPage() {
  const [summary, setSummary] = useState<SecureIoTDashboardSummary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const loadSummary = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      setSummary(await crmApi.getSecureIoTDashboardSummary());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load the SecureIoT dashboard.",
      );
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  return (
    <section id="secureiot-dashboard" className="page-content" aria-labelledby="secureiot-dashboard-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">SecureIoT / Overview</p>
          <h1 id="secureiot-dashboard-title">SecureIoT Command Center</h1>
          <p className="page-intro">
            Fleet-wide site, device, and security-event health across every install base.
          </p>
        </div>
        <button className="refresh-button" type="button" onClick={() => void loadSummary()}>
          Refresh data
        </button>
      </header>

      {loadState === "loading" && (
        <div className="state-card" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <div>
            <strong>Loading SecureIoT overview</strong>
            <p>Connecting to the SecureIoT API…</p>
          </div>
        </div>
      )}

      {loadState === "error" && (
        <div className="state-card state-card--error" role="alert">
          <div>
            <strong>SecureIoT data is unavailable</strong>
            <p>{errorMessage}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadSummary()}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && summary && (
        <div className="dashboard-content">
          <section className="metric-grid metric-grid--quad" aria-label="SecureIoT totals">
            <article className="metric-card">
              <p>Total sites</p>
              <strong>{summary.total_sites}</strong>
              <span>Active install locations</span>
            </article>
            <article className="metric-card">
              <p>Devices online</p>
              <strong>{summary.online_devices} / {summary.total_devices}</strong>
              <span>{summary.offline_devices} offline</span>
            </article>
            <article className={`metric-card${summary.open_security_events > 0 ? " metric-card--accent" : ""}`}>
              <p>Open security events</p>
              <strong>{summary.open_security_events}</strong>
              <span>{summary.critical_open_events} high/critical</span>
            </article>
            <article className="metric-card">
              <p>Security health</p>
              <strong>{summary.health_score}</strong>
              <span>
                <span className={`status-badge status-badge--${healthModifier(summary.health_status)}`}>
                  {healthLabel(summary.health_status)}
                </span>
              </span>
            </article>
          </section>

          <section className="dashboard-panel" aria-labelledby="sites-open-events-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Attention needed</p>
                <h2 id="sites-open-events-title">Sites with open security events</h2>
              </div>
              <span className="panel-count">{summary.sites_with_open_events.length}</span>
            </div>
            {summary.sites_with_open_events.length === 0 ? (
              <div className="panel-empty">No sites currently have open security events.</div>
            ) : (
              <div className="stage-list">
                {summary.sites_with_open_events.map((site) => (
                  <article
                    className="stage-row stage-row--clickable"
                    key={site.site_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      window.location.hash = `#sites/${site.site_id}`;
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        window.location.hash = `#sites/${site.site_id}`;
                      }
                    }}
                  >
                    <div className="stage-label">
                      <strong>{site.site_name}</strong>
                      <span>
                        {site.open_count} open event{site.open_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="stage-bar" aria-label={`${site.open_count} open events`}>
                      <span
                        style={{
                          width: `${Math.min(100, (site.open_count / summary.open_security_events) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="stage-value">
                      <strong>View site →</strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
