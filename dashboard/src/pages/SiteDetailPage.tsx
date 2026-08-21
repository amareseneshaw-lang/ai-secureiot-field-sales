import { useEffect, useState } from "react";

import {
  ApiError,
  crmApi,
  type Building,
  type Customer,
  type Device,
  type Door,
  type SecurityEvent,
  type Site,
} from "../api/client";

type LoadState = "loading" | "ready" | "error" | "not-found";

type SiteDetailData = {
  site: Site;
  customer: Customer | null;
  buildings: Building[];
  doors: Door[];
  devices: Device[];
  securityEvents: SecurityEvent[];
};

function formatLabel(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string | null): string {
  if (value === null) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function severityModifier(severity: string): string {
  if (severity === "CRITICAL" || severity === "HIGH") return "high";
  if (severity === "MEDIUM") return "medium";
  return "low";
}

interface SiteDetailPageProps {
  siteId: number;
}

export function SiteDetailPage({ siteId }: SiteDetailPageProps) {
  const [data, setData] = useState<SiteDetailData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const loadSiteDetail = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const site = await crmApi.getSite(siteId);

      const [buildingsResponse, doorsResponse, devicesResponse, eventsResponse] =
        await Promise.all([
          crmApi.getSiteBuildings(siteId),
          crmApi.getSiteDoors(siteId),
          crmApi.getSiteDevices(siteId),
          crmApi.getSecurityEvents(siteId),
        ]);

      // Customer lookup is CRM-only (SYSTEM_ADMIN/SALES_MANAGER/FIELD_SALES) - SECURITY_ADMIN
      // and TECHNICIAN have full Site 360 access but not the CRM customer list, so this must
      // fail independently of the SecureIoT data above rather than block the whole page.
      let customer: Customer | null = null;
      try {
        const customersResponse = await crmApi.getCustomers();
        customer =
          customersResponse.customers.find((c) => c.customer_id === site.customer_id) ?? null;
      } catch {
        customer = null;
      }

      setData({
        site,
        customer,
        buildings: buildingsResponse.buildings,
        doors: doorsResponse.doors,
        devices: devicesResponse.devices,
        securityEvents: eventsResponse.security_events,
      });
      setLoadState("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setLoadState("not-found");
        return;
      }
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load this site.");
    }
  };

  useEffect(() => {
    void loadSiteDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  return (
    <section id="site-detail" className="page-content" aria-labelledby="site-detail-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">SecureIoT / Site 360</p>
          <h1 id="site-detail-title">Site 360</h1>
          <p className="page-intro">
            Buildings, access hardware, devices, and security events for one site.
          </p>
        </div>
        <div className="header-actions">
          <a className="back-link" href="#sites">
            ← Back to Sites
          </a>
          <button className="refresh-button" type="button" onClick={() => void loadSiteDetail()}>
            Refresh data
          </button>
        </div>
      </header>

      {loadState === "loading" && (
        <div className="state-card" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <div>
            <strong>Loading site 360</strong>
            <p>Connecting to the SecureIoT API…</p>
          </div>
        </div>
      )}

      {loadState === "error" && (
        <div className="state-card state-card--error" role="alert">
          <div>
            <strong>Site data is unavailable</strong>
            <p>{errorMessage}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadSiteDetail()}>
            Try again
          </button>
        </div>
      )}

      {loadState === "not-found" && (
        <div className="state-card state-card--empty">
          <span className="not-found-icon" aria-hidden="true">◌</span>
          <div>
            <strong>Site #{siteId} was not found</strong>
            <p>This site may have been removed or the link may be incorrect.</p>
          </div>
          <a className="back-link" href="#sites">
            Back to Sites
          </a>
        </div>
      )}

      {loadState === "ready" && data && (
        <div className="dashboard-content">
          <section className="customer-header-card" aria-labelledby="site-header-title">
            <div className="customer-header-top">
              <div>
                <p className="eyebrow" id="site-header-title">Site</p>
                <h2>{data.site.site_name}</h2>
                <p className="id-cell">Site #{data.site.site_id}</p>
              </div>
              <span className={`status-badge status-badge--${data.site.status.toLowerCase()}`}>
                {data.site.status}
              </span>
            </div>

            <dl className="meta-grid">
              <div>
                <dt>Customer</dt>
                <dd>
                  {data.customer ? (
                    <a className="table-link" href={`#customers/${data.customer.customer_id}`}>
                      {data.customer.company_name}
                    </a>
                  ) : (
                    `Customer #${data.site.customer_id}`
                  )}
                </dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{data.site.site_type ?? "—"}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {data.site.city && data.site.state
                    ? `${data.site.city}, ${data.site.state}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{data.site.address ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="metric-grid" aria-label="Site 360 totals">
            <article className="metric-card">
              <p>Buildings</p>
              <strong>{data.buildings.length}</strong>
              <span>On this site</span>
            </article>
            <article className="metric-card">
              <p>Devices</p>
              <strong>{data.devices.length}</strong>
              <span>{data.devices.filter((d) => d.status === "OFFLINE").length} offline</span>
            </article>
            <article
              className={`metric-card${
                data.securityEvents.some((e) => e.status === "OPEN") ? " metric-card--accent" : ""
              }`}
            >
              <p>Security events</p>
              <strong>{data.securityEvents.length}</strong>
              <span>{data.securityEvents.filter((e) => e.status === "OPEN").length} open</span>
            </article>
          </section>

          <section className="dashboard-panel" aria-labelledby="site-buildings-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Structure</p>
                <h2 id="site-buildings-title">Buildings &amp; access hardware</h2>
              </div>
              <span className="panel-count">{data.buildings.length}</span>
            </div>
            {data.buildings.length === 0 ? (
              <div className="panel-empty">No buildings recorded for this site.</div>
            ) : (
              <div className="visit-list">
                {data.buildings.map((building) => (
                  <article className="visit-item" key={building.building_id}>
                    <div className="visit-date">
                      <strong>{building.building_name}</strong>
                      <span>{building.building_type ?? "Building"}</span>
                    </div>
                    <div>
                      {building.floor_count !== null && (
                        <p><strong>Floors:</strong> {building.floor_count}</p>
                      )}
                      {building.description && <p>{building.description}</p>}
                      {data.doors
                        .filter((door) => door.building_id === building.building_id)
                        .map((door) => (
                          <p key={door.door_id}>
                            <strong>{door.door_name}:</strong>{" "}
                            {door.reader ? `${door.reader.reader_name} (${door.reader.status})` : "No reader assigned"}
                          </p>
                        ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="customers-card" aria-labelledby="site-devices-title">
            <div className="table-heading">
              <div>
                <h2 id="site-devices-title">Devices</h2>
                <p>{data.devices.length} device{data.devices.length === 1 ? "" : "s"}</p>
              </div>
              <span className="data-badge">Live CRM data</span>
            </div>
            {data.devices.length === 0 ? (
              <div className="panel-empty">No devices recorded for this site.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Device</th>
                      <th scope="col">Type</th>
                      <th scope="col">Status</th>
                      <th scope="col">Health</th>
                      <th scope="col">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.devices.map((device) => (
                      <tr key={device.device_id}>
                        <td><strong>{device.device_name}</strong></td>
                        <td>{formatLabel(device.device_type)}</td>
                        <td>
                          <span className={`status-badge status-badge--${device.status === "ONLINE" ? "active" : "inactive"}`}>
                            {device.status}
                          </span>
                        </td>
                        <td>{formatLabel(device.health_status)}</td>
                        <td>{formatDateTime(device.last_seen_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dashboard-panel" aria-labelledby="site-events-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Security</p>
                <h2 id="site-events-title">Security events</h2>
              </div>
              <span className="panel-count">{data.securityEvents.length}</span>
            </div>
            {data.securityEvents.length === 0 ? (
              <div className="panel-empty">No security events recorded for this site.</div>
            ) : (
              <div className="timeline-list">
                {data.securityEvents.map((event) => (
                  <article className="timeline-item" key={`${event.source}-${event.source_id}`}>
                    <span className="timeline-marker" aria-hidden="true" />
                    <div>
                      <span className="type-label">{formatLabel(event.event_type)}</span>
                      <h3>
                        <span className={`priority-badge priority-badge--${severityModifier(event.severity)}`}>
                          {event.severity}
                        </span>{" "}
                        {event.description ?? formatLabel(event.event_type)}
                      </h3>
                      <time dateTime={event.event_timestamp}>
                        {formatDateTime(event.event_timestamp)}
                      </time>
                      <p>
                        <strong>Status:</strong> {formatLabel(event.status)}
                      </p>
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
