import type { ReactNode } from "react";

import { useAuth } from "../auth/AuthContext";

type NavigationItem = {
  label: string;
  icon: string;
  page?: "dashboard" | "customers" | "opportunities" | "field-visits" | "activities" | "reports";
};

const navigationItems: NavigationItem[] = [
  { label: "Dashboard", icon: "▦", page: "dashboard" },
  { label: "Customers", icon: "◉", page: "customers" },
  { label: "Opportunities", icon: "◌", page: "opportunities" },
  { label: "Field Visits", icon: "⌖", page: "field-visits" },
  { label: "Activities", icon: "◷", page: "activities" },
  { label: "Reports", icon: "▥", page: "reports" },
];

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: "Admin",
  SALES_MANAGER: "Sales Manager",
  FIELD_SALES: "Sales Representative",
  SECURITY_ADMIN: "Security Admin",
  TECHNICIAN: "Technician",
};

function formatRole(role: string): string {
  return ROLE_LABELS[role] ?? role.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface AppShellProps {
  children: ReactNode;
  activePage: "dashboard" | "customers" | "opportunities" | "field-visits" | "activities" | "reports";
}

export function AppShell({ children, activePage }: AppShellProps) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#dashboard" aria-label="AI SecureIoT CRM home">
          <span className="brand-mark" aria-hidden="true">AI</span>
          <span>
            <strong>SecureIoT</strong>
            <small>FIELD SALES CRM</small>
          </span>
        </a>

        <nav className="primary-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {navigationItems.map((item) => (
            <a
              className={`nav-item${item.page === activePage ? " nav-item--active" : ""}`}
              href={item.page ? `#${item.page}` : `#${item.label.toLowerCase().replace(" ", "-")}`}
              key={item.label}
              aria-current={item.page === activePage ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
              {!item.page && <small>Soon</small>}
            </a>
          ))}
        </nav>

        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-info">
              <strong>{user.first_name} {user.last_name}</strong>
              <span>{user.roles.length > 0 ? formatRole(user.roles[0]) : "—"}</span>
            </div>
            <button className="sidebar-logout" type="button" onClick={logout}>
              Log out
            </button>
          </div>
        )}

        <div className="sidebar-footer">
          <span className="status-dot" aria-hidden="true" />
          CRM workspace online
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
