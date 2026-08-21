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

export const crmApi = {
  getCustomers: () => get<CustomersResponse>("/customers/"),
  getPipelineSummary: () => get<PipelineSummary>("/opportunities/pipeline/summary"),
  getRecentActivities: () =>
    get<ActivitiesResponse>("/activities/?limit=5&offset=0"),
  getRecentFieldVisits: () =>
    get<FieldVisitsResponse>("/field-visits/?limit=5&offset=0"),
};
