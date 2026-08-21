import { useEffect, useState } from "react";

import { crmApi, type Customer, type Site } from "../api/client";

type LoadState = "loading" | "ready" | "error";

type SitesData = {
  sites: Site[];
  customers: Customer[];
};

export function SitesPage() {
  const [data, setData] = useState<SitesData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const loadSites = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const sitesResponse = await crmApi.getSites();

      // Customer names are a CRM-only lookup (SYSTEM_ADMIN/SALES_MANAGER/FIELD_SALES) -
      // SECURITY_ADMIN/TECHNICIAN have full Sites access but not the CRM customer list, so
      // this must degrade gracefully (falls back to "Customer #N") rather than block the page.
      let customers: Customer[] = [];
      try {
        customers = (await crmApi.getCustomers()).customers;
      } catch {
        customers = [];
      }

      setData({ sites: sitesResponse.sites, customers });
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load sites.");
    }
  };

  useEffect(() => {
    void loadSites();
  }, []);

  const sites = data?.sites ?? [];
  const customersById = new Map(
    data?.customers.map((customer) => [customer.customer_id, customer.company_name]),
  );
  const customerName = (customerId: number) =>
    customersById.get(customerId) ?? `Customer #${customerId}`;

  return (
    <section id="sites" className="page-content" aria-labelledby="sites-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">SecureIoT / Sites</p>
          <h1 id="sites-title">Sites</h1>
          <p className="page-intro">
            Customer sites and locations across the SecureIoT install base.
          </p>
        </div>
        <button className="refresh-button" type="button" onClick={() => void loadSites()}>
          Refresh data
        </button>
      </header>

      {loadState === "loading" && (
        <div className="state-card" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <div>
            <strong>Loading sites</strong>
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
          <button className="secondary-button" type="button" onClick={() => void loadSites()}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && sites.length === 0 && (
        <div className="state-card state-card--empty">
          <div>
            <strong>No sites yet</strong>
            <p>Customer sites will appear here as they're added.</p>
          </div>
        </div>
      )}

      {loadState === "ready" && sites.length > 0 && (
        <div className="customers-card">
          <div className="table-heading">
            <div>
              <h2>Sites</h2>
              <p>{sites.length} site{sites.length === 1 ? "" : "s"} in view</p>
            </div>
            <span className="data-badge">Live CRM data</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Type</th>
                  <th scope="col">Location</th>
                  <th scope="col">Status</th>
                  <th scope="col">Devices</th>
                  <th scope="col">Site ID</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr
                    className="customer-row"
                    key={site.site_id}
                    tabIndex={0}
                    role="button"
                    aria-label={`View ${site.site_name} details`}
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
                    <td><strong>{site.site_name}</strong></td>
                    <td>{customerName(site.customer_id)}</td>
                    <td>{site.site_type ?? "—"}</td>
                    <td>{site.city && site.state ? `${site.city}, ${site.state}` : "—"}</td>
                    <td>
                      <span className={`status-badge status-badge--${site.status.toLowerCase()}`}>
                        {site.status}
                      </span>
                    </td>
                    <td>
                      {site.device_count ?? 0}
                      {(site.offline_device_count ?? 0) > 0 && (
                        <span className="offline-count"> ({site.offline_device_count} offline)</span>
                      )}
                    </td>
                    <td className="id-cell">#{site.site_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
