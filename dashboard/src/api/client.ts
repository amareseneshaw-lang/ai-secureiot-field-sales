const API_BASE_PATH = "/api/v1";

export interface Customer {
  customer_id: number;
  company_name: string;
  industry: string | null;
  employee_count: number | null;
  account_status: string;
}

interface CustomersResponse {
    count: number;
    customers: Customer[];
}

export interface CustomerNotFound {
  error: string;
  customer_id: number;
}

export type CustomerDetail = Customer | CustomerNotFound;

export function isCustomerNotFound(detail: CustomerDetail): detail is CustomerNotFound {
  return "error" in detail;
}

export interface Contact {
  contact_id: number;
  customer_id: number;
  first_name: string;
  last_name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  contact_type: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface ContactsResponse {
  count: number;
  total_count: number;
  contacts: Contact[];
}

export type NumericValue = number | string;

export interface PipelineStage {
  sales_stage: string;
  opportunity_count: number;
  total_estimated_value: NumericValue;
  weighted_pipeline_value: NumericValue;
}

export interface PipelineSummary {
  stages: PipelineStage[];
  totals: {
    opportunity_count: number;
    total_estimated_value: NumericValue;
    weighted_pipeline_value: NumericValue;
  };
}

export interface Opportunity {
  opportunity_id: number;
  customer_id: number;
  site_id: number | null;
  name: string;
  description: string | null;
  sales_stage: string;
  estimated_value: NumericValue | null;
  probability: NumericValue | null;
  expected_close_date: string | null;
  sales_rep_id: number | null;
  competitor: string | null;
  priority: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  activity_id: number;
  customer_id: number | null;
  opportunity_id: number | null;
  user_id: number | null;
  activity_type: string;
  subject: string | null;
  description: string | null;
  activity_timestamp: string;
  outcome: string | null;
  next_action: string | null;
  created_at: string;
}

export interface FieldVisit {
  visit_id: number;
  customer_id: number;
  site_id: number | null;
  sales_rep_id: number | null;
  visit_date: string;
  visit_type: string | null;
  purpose: string | null;
  customer_needs: string | null;
  pain_points: string | null;
  existing_system: string | null;
  door_count: number | null;
  employee_count: number | null;
  technical_requirements: string | null;
  recommended_solution: string | null;
  next_action: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
}

interface ActivitiesResponse {
  count: number;
  total_count: number;
  activities: Activity[];
}

interface FieldVisitsResponse {
  count: number;
  total_count: number;
  field_visits: FieldVisit[];
}

interface OpportunitiesResponse {
  count: number;
  total_count: number;
  limit: number;
  offset: number;
  opportunities: Opportunity[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function get<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_PATH}${path}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError(
      "Unable to connect to the CRM API. Make sure the FastAPI server is running.",
      0,
    );
  }

  if (!response.ok) {
    const fallbackMessage = `CRM API request failed (${response.status}).`;
    const payload: unknown = await response.json().catch(() => null);
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String(payload.detail)
        : fallbackMessage;
    throw new ApiError(detail, response.status);
  }

  return response.json() as Promise<T>;
}

const OPPORTUNITIES_PAGE_SIZE = 100;
const OPPORTUNITIES_MAX_PAGES = 20;

async function getAllOpportunities(): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = [];
  let offset = 0;

  for (let page = 0; page < OPPORTUNITIES_MAX_PAGES; page += 1) {
    const response = await get<OpportunitiesResponse>(
      `/opportunities/?limit=${OPPORTUNITIES_PAGE_SIZE}&offset=${offset}`,
    );
    opportunities.push(...response.opportunities);

    if (opportunities.length >= response.total_count || response.opportunities.length === 0) {
      break;
    }

    offset += OPPORTUNITIES_PAGE_SIZE;
  }

  return opportunities;
}

const FIELD_VISITS_PAGE_SIZE = 100;
const FIELD_VISITS_MAX_PAGES = 20;

async function getAllFieldVisits(): Promise<FieldVisit[]> {
  const fieldVisits: FieldVisit[] = [];
  let offset = 0;

  for (let page = 0; page < FIELD_VISITS_MAX_PAGES; page += 1) {
    const response = await get<FieldVisitsResponse>(
      `/field-visits/?limit=${FIELD_VISITS_PAGE_SIZE}&offset=${offset}`,
    );
    fieldVisits.push(...response.field_visits);

    if (fieldVisits.length >= response.total_count || response.field_visits.length === 0) {
      break;
    }

    offset += FIELD_VISITS_PAGE_SIZE;
  }

  return fieldVisits;
}

export const crmApi = {
  getCustomers: () => get<CustomersResponse>("/customers/"),
  getCustomer: (customerId: number) => get<CustomerDetail>(`/customers/${customerId}`),
  getPipelineSummary: () => get<PipelineSummary>("/opportunities/pipeline/summary"),
  getOpportunities: () => getAllOpportunities(),
  getFieldVisits: () => getAllFieldVisits(),
  getRecentActivities: () =>
    get<ActivitiesResponse>("/activities/?limit=5&offset=0"),
  getRecentFieldVisits: () =>
    get<FieldVisitsResponse>("/field-visits/?limit=5&offset=0"),
  getCustomerContacts: (customerId: number) =>
    get<ContactsResponse>(`/customers/${customerId}/contacts/?limit=100&offset=0`),
  getCustomerOpportunities: (customerId: number) =>
    get<OpportunitiesResponse>(`/customers/${customerId}/opportunities/?limit=100&offset=0`),
  getCustomerFieldVisits: (customerId: number) =>
    get<FieldVisitsResponse>(`/customers/${customerId}/field-visits/?limit=100&offset=0`),
  getCustomerActivities: (customerId: number) =>
    get<ActivitiesResponse>(`/customers/${customerId}/activities/?limit=100&offset=0`),
};
