// Frontend gating only, for navigation/UX - the backend's require_role() dependencies
// remain the authoritative access control. This mapping must stay in sync with each
// router's `dependencies=[Depends(require_role(...))]` in backend/app/routes/.
export const CRM_ROLES = ["SYSTEM_ADMIN", "SALES_MANAGER", "FIELD_SALES"];
export const SECUREIOT_ROLES = [
  "SYSTEM_ADMIN",
  "SECURITY_ADMIN",
  "TECHNICIAN",
  "SALES_MANAGER",
  "FIELD_SALES",
];

export type PageKey =
  | "dashboard"
  | "customers"
  | "customer360"
  | "opportunities"
  | "field-visits"
  | "activities"
  | "reports"
  | "sites"
  | "site-detail"
  | "devices"
  | "security-events"
  | "secureiot-dashboard";

const PAGE_ROLES: Record<PageKey, string[]> = {
  dashboard: CRM_ROLES,
  customers: CRM_ROLES,
  customer360: CRM_ROLES,
  opportunities: CRM_ROLES,
  "field-visits": CRM_ROLES,
  activities: CRM_ROLES,
  reports: CRM_ROLES,
  sites: SECUREIOT_ROLES,
  "site-detail": SECUREIOT_ROLES,
  devices: SECUREIOT_ROLES,
  "security-events": SECUREIOT_ROLES,
  "secureiot-dashboard": SECUREIOT_ROLES,
};

export function hasPageAccess(userRoles: string[], page: PageKey): boolean {
  return PAGE_ROLES[page].some((role) => userRoles.includes(role));
}

export function defaultPageForRoles(userRoles: string[]): PageKey {
  if (hasPageAccess(userRoles, "dashboard")) return "dashboard";
  if (hasPageAccess(userRoles, "secureiot-dashboard")) return "secureiot-dashboard";
  return "dashboard";
}
