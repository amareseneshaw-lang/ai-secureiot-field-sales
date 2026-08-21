import type { ReactNode } from "react";

type NavigationItem = {
  label: string;
  icon: string;
  page?: "dashboard" | "customers" | "opportunities";
};

const navigationItems: NavigationItem[] = [
  { label: "Dashboard", icon: "▦", page: "dashboard" },
  { label: "Customers", icon: "◉", page: "customers" },
  { label: "Opportunities", icon: "◌", page: "opportunities" },
  { label: "Field Visits", icon: "⌖" },
  { label: "Activities", icon: "◷" },
  { label: "Reports", icon: "▥" },
];

interface AppShellProps {
  children: ReactNode;
  activePage: "dashboard" | "customers" | "opportunities";
}

export function AppShell({ children, activePage }: AppShellProps) {
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

        <div className="sidebar-footer">
          <span className="status-dot" aria-hidden="true" />
          CRM workspace online
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
