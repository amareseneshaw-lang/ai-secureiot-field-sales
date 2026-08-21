import { clearStoredToken, getStoredToken } from "../auth/tokenStorage";

const API_BASE_PATH = "/api/v1";

export interface AuthUser {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

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

export interface Site {
  site_id: number;
  customer_id: number;
  site_name: string;
  site_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  assigned_technician_id: number | null;
  created_at: string;
  updated_at: string;
  device_count?: number;
  offline_device_count?: number;
}

interface SitesResponse {
  count: number;
  total_count: number;
  limit: number;
  offset: number;
  sites: Site[];
}

export interface Building {
  building_id: number;
  site_id: number;
  building_name: string;
  building_type: string | null;
  floor_count: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface BuildingsResponse {
  count: number;
  buildings: Building[];
}

export interface Device {
  device_id: number;
  site_id: number;
  device_name: string;
  device_type: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  firmware_version: string | null;
  status: string;
  health_status: string;
  last_seen_at: string | null;
  installed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DevicesResponse {
  count: number;
  total_count: number;
  limit: number;
  offset: number;
  devices: Device[];
}

export interface DeviceTelemetry {
  telemetry_id: number;
  device_id: number;
  timestamp: string;
  metric_name: string;
  metric_value: number | null;
  unit: string | null;
  quality: string | null;
}

interface TelemetryResponse {
  count: number;
  telemetry: DeviceTelemetry[];
}

interface SiteDevicesResponse {
  count: number;
  devices: Device[];
}

export type SecurityEventSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SecurityEventStatus = "OPEN" | "RESOLVED";
export type SecurityEventSource = "IOT" | "ACCESS" | "DEVICE_STATUS";

export interface SecurityEvent {
  source: SecurityEventSource;
  source_id: number;
  device_id: number | null;
  site_id: number | null;
  event_type: string;
  severity: SecurityEventSeverity;
  status: SecurityEventStatus;
  event_timestamp: string;
  description: string | null;
}

interface SecurityEventsResponse {
  count: number;
  total_count: number;
  limit: number;
  offset: number;
  security_events: SecurityEvent[];
}

export interface SecurityEventsSummary {
  open_count: number;
  critical_open_count: number;
  breakdown: { severity: SecurityEventSeverity; status: SecurityEventStatus; count: number }[];
}

export interface Door {
  door_id: number;
  building_id: number;
  door_name: string;
  door_type: string | null;
  location_description: string | null;
  status: string;
  controller_id: number | null;
  reader: {
    reader_id: number;
    reader_name: string;
    reader_type: string | null;
    status: string;
  } | null;
}

interface DoorsResponse {
  count: number;
  doors: Door[];
}

export type SecureIoTHealthStatus = "HEALTHY" | "AT_RISK" | "CRITICAL";

export interface SecureIoTDashboardSummary {
  total_sites: number;
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  open_security_events: number;
  critical_open_events: number;
  health_score: number;
  health_status: SecureIoTHealthStatus;
  sites_with_open_events: { site_id: number; site_name: string; open_count: number }[];
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type DataSufficiency = "SUFFICIENT" | "LIMITED" | "INSUFFICIENT";

export interface OpportunityInsight {
  risk_level: RiskLevel;
  recommended_action: string;
  reasoning: string[];
  suggested_follow_up: string;
  confidence: number;
  data_sufficiency: DataSufficiency;
  caveats: string[];
}

export interface CustomerAiSummary {
  summary: string;
  current_situation: string;
  key_risks: string[];
  key_opportunities: string[];
  recommended_next_step: string;
  confidence: number;
  data_sufficiency: DataSufficiency;
  caveats: string[];
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
  const token = getStoredToken();

  try {
    response = await fetch(`${API_BASE_PATH}${path}`, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new ApiError(
      "Unable to connect to the CRM API. Make sure the FastAPI server is running.",
      0,
    );
  }

  if (response.status === 401) {
    clearStoredToken();
    window.dispatchEvent(new Event("auth:unauthorized"));
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

async function postLogin(username: string, password: string): Promise<LoginResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_PATH}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new ApiError(
      "Unable to connect to the CRM API. Make sure the FastAPI server is running.",
      0,
    );
  }

  if (!response.ok) {
    const fallbackMessage = `Login failed (${response.status}).`;
    const payload: unknown = await response.json().catch(() => null);
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String(payload.detail)
        : fallbackMessage;
    throw new ApiError(detail, response.status);
  }

  return response.json() as Promise<LoginResponse>;
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

const ACTIVITIES_PAGE_SIZE = 100;
const ACTIVITIES_MAX_PAGES = 20;

async function getAllActivities(): Promise<Activity[]> {
  const activities: Activity[] = [];
  let offset = 0;

  for (let page = 0; page < ACTIVITIES_MAX_PAGES; page += 1) {
    const response = await get<ActivitiesResponse>(
      `/activities/?limit=${ACTIVITIES_PAGE_SIZE}&offset=${offset}`,
    );
    activities.push(...response.activities);

    if (activities.length >= response.total_count || response.activities.length === 0) {
      break;
    }

    offset += ACTIVITIES_PAGE_SIZE;
  }

  return activities;
}

export const crmApi = {
  login: (username: string, password: string) => postLogin(username, password),
  getCustomers: () => get<CustomersResponse>("/customers/"),
  getCustomer: (customerId: number) => get<CustomerDetail>(`/customers/${customerId}`),
  getPipelineSummary: () => get<PipelineSummary>("/opportunities/pipeline/summary"),
  getOpportunities: () => getAllOpportunities(),
  getFieldVisits: () => getAllFieldVisits(),
  getActivities: () => getAllActivities(),
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
  getOpportunityInsight: (opportunityId: number) =>
    get<OpportunityInsight>(`/ai/opportunities/${opportunityId}/insight`),
  getCustomerAiSummary: (customerId: number) =>
    get<CustomerAiSummary>(`/ai/customers/${customerId}/summary`),
  getSites: () => get<SitesResponse>("/sites/?limit=100&offset=0"),
  getSite: (siteId: number) => get<Site>(`/sites/${siteId}`),
  getSiteBuildings: (siteId: number) =>
    get<BuildingsResponse>(`/sites/${siteId}/buildings/`),
  getCustomerSites: (customerId: number) =>
    get<SitesResponse>(`/customers/${customerId}/sites/?limit=100&offset=0`),
  getDevices: () => get<DevicesResponse>("/devices/?limit=100&offset=0"),
  getDevice: (deviceId: number) => get<Device>(`/devices/${deviceId}`),
  getDeviceTelemetry: (deviceId: number) =>
    get<TelemetryResponse>(`/devices/${deviceId}/telemetry/?limit=20`),
  getSiteDevices: (siteId: number) =>
    get<SiteDevicesResponse>(`/sites/${siteId}/devices/`),
  getSiteDoors: (siteId: number) => get<DoorsResponse>(`/sites/${siteId}/doors/`),
  getSecurityEvents: (siteId?: number) =>
    get<SecurityEventsResponse>(
      `/security-events/?limit=100&offset=0${siteId !== undefined ? `&site_id=${siteId}` : ""}`,
    ),
  getSecurityEventsSummary: () =>
    get<SecurityEventsSummary>("/security-events/summary"),
  getSecureIoTDashboardSummary: () =>
    get<SecureIoTDashboardSummary>("/secureiot/dashboard/summary"),
};
