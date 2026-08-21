import { useEffect, useState } from "react";

import {
  ApiError,
  crmApi,
  isCustomerNotFound,
  type Activity,
  type Contact,
  type Customer,
  type FieldVisit,
  type NumericValue,
  type Opportunity,
} from "../api/client";

type LoadState = "loading" | "ready" | "error" | "not-found";

type Customer360Data = {
  customer: Customer;
  contacts: Contact[];
  opportunities: Opportunity[];
  fieldVisits: FieldVisit[];
  activities: Activity[];
};

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

function formatEmployeeCount(employeeCount: number | null): string {
  if (employeeCount === null) return "—";
  return new Intl.NumberFormat("en-US").format(employeeCount);
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
  return priority === null ? "default" : priority.toLowerCase();
}

function contactName(contact: Contact): string {
  return `${contact.first_name} ${contact.last_name}`.trim();
}

interface Customer360PageProps {
  customerId: number;
}

export function Customer360Page({ customerId }: Customer360PageProps) {
  const [data, setData] = useState<Customer360Data | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const loadCustomer360 = async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const customerDetail = await crmApi.getCustomer(customerId);

      if (isCustomerNotFound(customerDetail)) {
        setLoadState("not-found");
        return;
      }

      const [contactsResponse, opportunitiesResponse, fieldVisitsResponse, activitiesResponse] =
        await Promise.all([
          crmApi.getCustomerContacts(customerId),
          crmApi.getCustomerOpportunities(customerId),
          crmApi.getCustomerFieldVisits(customerId),
          crmApi.getCustomerActivities(customerId),
        ]);

      setData({
        customer: customerDetail,
        contacts: contactsResponse.contacts,
        opportunities: opportunitiesResponse.opportunities,
        fieldVisits: fieldVisitsResponse.field_visits,
        activities: activitiesResponse.activities,
      });
      setLoadState("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setLoadState("not-found");
        return;
      }
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load this customer.",
      );
    }
  };

  useEffect(() => {
    void loadCustomer360();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const primaryContact = data
    ? data.contacts.find((contact) => contact.is_primary) ?? data.contacts[0] ?? null
    : null;

  return (
    <section id="customer-360" className="page-content" aria-labelledby="customer-360-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">CRM / Customer 360</p>
          <h1 id="customer-360-title">Customer 360</h1>
          <p className="page-intro">
            A unified view of contacts, pipeline, field intelligence, and engagement history.
          </p>
        </div>
        <div className="header-actions">
          <a className="back-link" href="#customers">
            ← Back to Customers
          </a>
          <button className="refresh-button" type="button" onClick={() => void loadCustomer360()}>
            Refresh data
          </button>
        </div>
      </header>

      {loadState === "loading" && (
        <div className="state-card" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <div>
            <strong>Loading customer 360</strong>
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
          <button className="secondary-button" type="button" onClick={() => void loadCustomer360()}>
            Try again
          </button>
        </div>
      )}

      {loadState === "not-found" && (
        <div className="state-card state-card--empty">
          <span className="not-found-icon" aria-hidden="true">◌</span>
          <div>
            <strong>Customer #{customerId} was not found</strong>
            <p>This account may have been removed or the link may be incorrect.</p>
          </div>
          <a className="back-link" href="#customers">
            Back to Customers
          </a>
        </div>
      )}

      {loadState === "ready" && data && (
        <div className="dashboard-content">
          <section className="customer-header-card" aria-labelledby="customer-header-title">
            <div className="customer-header-top">
              <div>
                <p className="eyebrow" id="customer-header-title">Account</p>
                <h2>{data.customer.company_name}</h2>
                <p className="id-cell">Customer #{data.customer.customer_id}</p>
              </div>
              <span
                className={`status-badge status-badge--${data.customer.account_status.toLowerCase()}`}
              >
                {data.customer.account_status}
              </span>
            </div>

            <dl className="meta-grid">
              <div>
                <dt>Industry</dt>
                <dd>{data.customer.industry ?? "—"}</dd>
              </div>
              <div>
                <dt>Employees</dt>
                <dd>{formatEmployeeCount(data.customer.employee_count)}</dd>
              </div>
              <div>
                <dt>Primary contact</dt>
                <dd>{primaryContact ? contactName(primaryContact) : "—"}</dd>
              </div>
              <div>
                <dt>Contact email</dt>
                <dd>{primaryContact?.email ?? "—"}</dd>
              </div>
              <div>
                <dt>Contact phone</dt>
                <dd>{primaryContact?.phone ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="metric-grid metric-grid--quad" aria-label="Customer 360 totals">
            <article className="metric-card">
              <p>Contacts</p>
              <strong>{data.contacts.length}</strong>
              <span>On file for this account</span>
            </article>
            <article className="metric-card">
              <p>Opportunities</p>
              <strong>{data.opportunities.length}</strong>
              <span>Open and closed deals</span>
            </article>
            <article className="metric-card">
              <p>Field visits</p>
              <strong>{data.fieldVisits.length}</strong>
              <span>Recorded site visits</span>
            </article>
            <article className="metric-card metric-card--accent">
              <p>Activities</p>
              <strong>{data.activities.length}</strong>
              <span>Logged engagement</span>
            </article>
          </section>

          <section className="customers-card" aria-labelledby="contacts-title">
            <div className="table-heading">
              <div>
                <h2 id="contacts-title">Contacts</h2>
                <p>{data.contacts.length} contact{data.contacts.length === 1 ? "" : "s"}</p>
              </div>
              <span className="data-badge">Live CRM data</span>
            </div>
            {data.contacts.length === 0 ? (
              <div className="panel-empty">No contacts recorded for this account.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Job title</th>
                      <th scope="col">Email</th>
                      <th scope="col">Phone</th>
                      <th scope="col">Contact type</th>
                      <th scope="col">Primary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.contacts.map((contact) => (
                      <tr key={contact.contact_id}>
                        <td><strong>{contactName(contact)}</strong></td>
                        <td>{contact.job_title ?? "—"}</td>
                        <td>{contact.email ?? "—"}</td>
                        <td>{contact.phone ?? "—"}</td>
                        <td>{contact.contact_type ? formatLabel(contact.contact_type) : "—"}</td>
                        <td>
                          {contact.is_primary ? (
                            <span className="status-badge status-badge--active">Primary</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="customers-card" aria-labelledby="customer-opportunities-title">
            <div className="table-heading">
              <div>
                <h2 id="customer-opportunities-title">Opportunities</h2>
                <p>{data.opportunities.length} opportunit{data.opportunities.length === 1 ? "y" : "ies"}</p>
              </div>
              <span className="data-badge">Live CRM data</span>
            </div>
            {data.opportunities.length === 0 ? (
              <div className="panel-empty">No opportunities recorded for this account.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Opportunity</th>
                      <th scope="col">Sales stage</th>
                      <th scope="col">Estimated value</th>
                      <th scope="col">Probability</th>
                      <th scope="col">Weighted value</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Expected close date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.opportunities.map((opportunity) => (
                      <tr key={opportunity.opportunity_id}>
                        <td><strong>{opportunity.name}</strong></td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dashboard-panel" aria-labelledby="field-visits-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Field intelligence</p>
                <h2 id="field-visits-title">Field visits</h2>
              </div>
              <span className="panel-count">{data.fieldVisits.length}</span>
            </div>
            {data.fieldVisits.length === 0 ? (
              <div className="panel-empty">No field visits recorded for this account.</div>
            ) : (
              <div className="visit-list">
                {data.fieldVisits.map((visit) => (
                  <article className="visit-item" key={visit.visit_id}>
                    <div className="visit-date">
                      <strong>{formatDate(visit.visit_date)}</strong>
                      <span>{visit.visit_type ? formatLabel(visit.visit_type) : "Field visit"}</span>
                    </div>
                    <div>
                      {visit.purpose && <p><strong>Purpose:</strong> {visit.purpose}</p>}
                      {visit.customer_needs && <p><strong>Needs:</strong> {visit.customer_needs}</p>}
                      {visit.pain_points && <p><strong>Pain points:</strong> {visit.pain_points}</p>}
                      {visit.recommended_solution && (
                        <p><strong>Recommendation:</strong> {visit.recommended_solution}</p>
                      )}
                      {visit.next_action && <p><strong>Next:</strong> {visit.next_action}</p>}
                      {visit.follow_up_date && (
                        <p className="follow-up">
                          <strong>Follow-up:</strong> {formatDate(visit.follow_up_date)}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-panel" aria-labelledby="customer-activities-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Engagement</p>
                <h2 id="customer-activities-title">Activity timeline</h2>
              </div>
              <span className="panel-count">{data.activities.length}</span>
            </div>
            {data.activities.length === 0 ? (
              <div className="panel-empty">No activities recorded for this account.</div>
            ) : (
              <div className="timeline-list">
                {data.activities.map((activity) => (
                  <article className="timeline-item" key={activity.activity_id}>
                    <span className="timeline-marker" aria-hidden="true" />
                    <div>
                      <span className="type-label">{formatLabel(activity.activity_type)}</span>
                      <h3>{activity.subject ?? "Untitled activity"}</h3>
                      <time dateTime={activity.activity_timestamp}>
                        {formatDateTime(activity.activity_timestamp)}
                      </time>
                      {activity.description && <p>{activity.description}</p>}
                      {activity.outcome && <p><strong>Outcome:</strong> {activity.outcome}</p>}
                      {activity.next_action && <p><strong>Next:</strong> {activity.next_action}</p>}
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
