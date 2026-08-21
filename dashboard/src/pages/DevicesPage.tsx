import { Fragment, useEffect, useState } from "react";

import { crmApi, type Device, type DeviceTelemetry, type Site } from "../api/client";

type LoadState = "loading" | "ready" | "error";

type DevicesData = {
  devices: Device[];
  sites: Site[];
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

function statusModifier(status: string): string {
  return status.toLowerCase();
}

function TelemetryPanel({ deviceId }: { deviceId: number }) {
  const [telemetry, setTelemetry] = useState<DeviceTelemetry[] | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadState("loading");
      try {
        const response = await crmApi.getDeviceTelemetry(deviceId);
        if (!cancelled) {
          setTelemetry(response.telemetry);
          setLoadState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadState("error");
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to load telemetry.",
          );
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  if (loadState === "loading") {
    return <p className="panel-empty">Loading telemetry…</p>;
  }

  if (loadState === "error") {
    return <p className="panel-empty">{errorMessage}</p>;
  }

  if (!telemetry || telemetry.length === 0) {
    return <p className="panel-empty">No telemetry recorded for this device.</p>;
  }

  return (
    <dl className="opportunity-detail">
      {telemetry.map((reading) => (
        <div key={reading.telemetry_id}>
          <dt>{formatLabel(reading.metric_name)}</dt>
          <dd>
            {reading.metric_value ?? "—"} {reading.unit ?? ""}
            <span className="follow-up"> · {formatDateTime(reading.timestamp)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DevicesPage() {
  const [data, setData] = useState<DevicesData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [siteFilter, setSiteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadDevices = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const [devicesResponse, sitesResponse] = await Promise.all([
        crmApi.getDevices(),
        crmApi.getSites(),
      ]);
      setData({ devices: devicesResponse.devices, sites: sitesResponse.sites });
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load devices.");
    }
  };

  useEffect(() => {
    void loadDevices();
  }, []);

  const devices = data?.devices ?? [];
  const sitesById = new Map(data?.sites.map((site) => [site.site_id, site.site_name]));
  const siteName = (siteId: number) => sitesById.get(siteId) ?? `Site #${siteId}`;

  const siteOptions = Array.from(new Set(devices.map((device) => device.site_id))).sort(
    (a, b) => a - b,
  );
  const statusOptions = Array.from(new Set(devices.map((device) => device.status))).sort();

  const filteredDevices = devices.filter((device) => {
    const matchesSite = siteFilter === "" || device.site_id === Number(siteFilter);
    const matchesStatus = statusFilter === "" || device.status === statusFilter;
    return matchesSite && matchesStatus;
  });

  const onlineCount = devices.filter((device) => device.status === "ONLINE").length;
  const offlineCount = devices.filter((device) => device.status === "OFFLINE").length;

  const toggleExpanded = (deviceId: number) => {
    setExpandedId((current) => (current === deviceId ? null : deviceId));
  };

  return (
    <section id="devices" className="page-content" aria-labelledby="devices-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">SecureIoT / Devices</p>
          <h1 id="devices-title">Devices</h1>
          <p className="page-intro">
            Access controllers, sensors, and IoT devices across every SecureIoT site.
          </p>
        </div>
        <button className="refresh-button" type="button" onClick={() => void loadDevices()}>
          Refresh data
        </button>
      </header>

      {loadState === "loading" && (
        <div className="state-card" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <div>
            <strong>Loading devices</strong>
            <p>Connecting to the SecureIoT API…</p>
          </div>
        </div>
      )}

      {loadState === "error" && (
        <div className="state-card state-card--error" role="alert">
          <div>
            <strong>Device data is unavailable</strong>
            <p>{errorMessage}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadDevices()}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && devices.length === 0 && (
        <div className="state-card state-card--empty">
          <div>
            <strong>No devices yet</strong>
            <p>Devices will appear here as they're installed at customer sites.</p>
          </div>
        </div>
      )}

      {loadState === "ready" && devices.length > 0 && (
        <div className="dashboard-content">
          <section className="metric-grid" aria-label="Device totals">
            <article className="metric-card">
              <p>Total devices</p>
              <strong>{devices.length}</strong>
              <span>Across all sites</span>
            </article>
            <article className="metric-card">
              <p>Online</p>
              <strong>{onlineCount}</strong>
              <span>Reporting normally</span>
            </article>
            <article className={`metric-card${offlineCount > 0 ? " metric-card--accent" : ""}`}>
              <p>Offline</p>
              <strong>{offlineCount}</strong>
              <span>Needs attention</span>
            </article>
          </section>

          <section className="customers-card toolbar-card" aria-labelledby="devices-table-title">
            <div className="table-heading">
              <div>
                <h2 id="devices-table-title">Device list</h2>
                <p>
                  {filteredDevices.length} of {devices.length} device
                  {devices.length === 1 ? "" : "s"} shown
                </p>
              </div>
              <span className="data-badge">Live CRM data</span>
            </div>

            <div className="filters-row">
              <label className="visually-hidden" htmlFor="device-site-filter">
                Filter by site
              </label>
              <select
                id="device-site-filter"
                className="filter-select"
                value={siteFilter}
                onChange={(event) => setSiteFilter(event.target.value)}
              >
                <option value="">All sites</option>
                {siteOptions.map((siteId) => (
                  <option key={siteId} value={siteId}>
                    {siteName(siteId)}
                  </option>
                ))}
              </select>

              <label className="visually-hidden" htmlFor="device-status-filter">
                Filter by status
              </label>
              <select
                id="device-status-filter"
                className="filter-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatLabel(option)}
                  </option>
                ))}
              </select>

              {(siteFilter !== "" || statusFilter !== "") && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setSiteFilter("");
                    setStatusFilter("");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {filteredDevices.length === 0 ? (
              <div className="panel-empty">No devices match the current filters.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Device</th>
                      <th scope="col">Site</th>
                      <th scope="col">Type</th>
                      <th scope="col">Status</th>
                      <th scope="col">Health</th>
                      <th scope="col">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.map((device) => {
                      const isExpanded = expandedId === device.device_id;
                      return (
                        <Fragment key={device.device_id}>
                          <tr
                            className="opportunity-row"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpanded(device.device_id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleExpanded(device.device_id);
                              }
                            }}
                          >
                            <td><strong>{device.device_name}</strong></td>
                            <td>{siteName(device.site_id)}</td>
                            <td>{formatLabel(device.device_type)}</td>
                            <td>
                              <span className={`status-badge status-badge--${statusModifier(device.status) === "online" ? "active" : "inactive"}`}>
                                {device.status}
                              </span>
                            </td>
                            <td>{formatLabel(device.health_status)}</td>
                            <td>{formatDateTime(device.last_seen_at)}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="opportunity-detail-row">
                              <td colSpan={6}>
                                <dl className="opportunity-detail">
                                  <div>
                                    <dt>Manufacturer</dt>
                                    <dd>{device.manufacturer ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Model</dt>
                                    <dd>{device.model ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Serial number</dt>
                                    <dd>{device.serial_number ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Firmware</dt>
                                    <dd>{device.firmware_version ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Installed</dt>
                                    <dd>{formatDateTime(device.installed_at)}</dd>
                                  </div>
                                </dl>
                                <p className="eyebrow telemetry-heading">Recent telemetry</p>
                                <TelemetryPanel deviceId={device.device_id} />
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
