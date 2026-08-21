import { useEffect, useState } from "react";

import { crmApi, type Customer } from "../api/client";

type LoadState = "loading" | "ready" | "error";

function formatEmployeeCount(employeeCount: number | null): string {
  if (employeeCount === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US").format(employeeCount);
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const loadCustomers = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const response = await crmApi.getCustomers();
      setCustomers(response.customers);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load customers.",
      );
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  return (
    <section id="customers" className="page-content" aria-labelledby="customers-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">CRM / Accounts</p>
          <h1 id="customers-title">Customers</h1>
          <p className="page-intro">
            Account intelligence for your physical security and IoT sales pipeline.
          </p>
        </div>
        <button className="refresh-button" type="button" onClick={() => void loadCustomers()}>
          Refresh data
        </button>
      </header>

      {loadState === "loading" && (
        <div className="state-card" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <div>
            <strong>Loading customer accounts</strong>
            <p>Connecting to the CRM API…</p>
          </div>
        </div>
      )}

      {loadState === "error" && (
        <div className="state-card state-card--error" role="alert">
          <div>
            <strong>Customer data is unavailable</strong>
            <p>{errorMessage}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadCustomers()}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && customers.length === 0 && (
        <div className="state-card state-card--empty">
          <div>
            <strong>No customer accounts yet</strong>
            <p>New customer accounts will appear here as the CRM grows.</p>
          </div>
        </div>
      )}

      {loadState === "ready" && customers.length > 0 && (
        <div className="customers-card">
          <div className="table-heading">
            <div>
              <h2>Customer accounts</h2>
              <p>{customers.length} account{customers.length === 1 ? "" : "s"} in view</p>
            </div>
            <span className="data-badge">Live CRM data</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Industry</th>
                  <th scope="col">Employees</th>
                  <th scope="col">Status</th>
                  <th scope="col">Account ID</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    className="customer-row"
                    key={customer.customer_id}
                    tabIndex={0}
                    role="button"
                    aria-label={`View ${customer.company_name} details`}
                    onClick={() => {
                      window.location.hash = `#customers/${customer.customer_id}`;
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        window.location.hash = `#customers/${customer.customer_id}`;
                      }
                    }}
                  >
                    <td><strong>{customer.company_name}</strong></td>
                    <td>{customer.industry ?? "—"}</td>
                    <td>{formatEmployeeCount(customer.employee_count)}</td>
                    <td>
                      <span className={`status-badge status-badge--${customer.account_status.toLowerCase()}`}>
                        {customer.account_status}
                      </span>
                    </td>
                    <td className="id-cell">#{customer.customer_id}</td>
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
