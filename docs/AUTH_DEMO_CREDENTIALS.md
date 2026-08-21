# Local Development Demo Credentials

These accounts are seeded by `database/seed.sql` for local development and
testing only. They are fictional and **must never be used in a production
deployment**. Rotate or remove them before deploying anywhere real users can
reach the application.

| Username | Password | Role | CRM access |
|---|---|---|---|
| `admin_demo` | `AdminDemo#2026` | SYSTEM_ADMIN | Full CRM access |
| `sales_manager_demo` | `SalesManager#2026` | SALES_MANAGER | Full CRM access |
| `field_sales_demo` | `FieldSales#2026` | FIELD_SALES | Full CRM access |
| `security_admin_demo` | `SecurityAdmin#2026` | SECURITY_ADMIN | No CRM access (reserved for the future IoT/access-control surface) |
| `technician_demo` | `Technician#2026` | TECHNICIAN | No CRM access (reserved for the future IoT/access-control surface) |

Log in at `POST /api/v1/auth/login` with `{"username": "...", "password": "..."}`,
or through the dashboard's sign-in page.

`SYSTEM_ADMIN`, `SALES_MANAGER`, and `FIELD_SALES` map to the CRM's three
user-facing roles: Admin, Sales Manager, and Sales Representative.
