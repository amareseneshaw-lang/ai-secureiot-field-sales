import { useEffect, useState } from "react";

import { ActivitiesPage } from "./pages/ActivitiesPage";
import { AppShell } from "./components/AppShell";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { defaultPageForRoles, hasPageAccess } from "./auth/pageAccess";
import { Customer360Page } from "./pages/Customer360Page";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DevicesPage } from "./pages/DevicesPage";
import { FieldVisitsPage } from "./pages/FieldVisitsPage";
import { LoginPage } from "./pages/LoginPage";
import { OpportunitiesPage } from "./pages/OpportunitiesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SecureIoTDashboardPage } from "./pages/SecureIoTDashboardPage";
import { SecurityEventsPage } from "./pages/SecurityEventsPage";
import { SiteDetailPage } from "./pages/SiteDetailPage";
import { SitesPage } from "./pages/SitesPage";

type Route =
  | { page: "dashboard" }
  | { page: "customers" }
  | { page: "opportunities" }
  | { page: "field-visits" }
  | { page: "activities" }
  | { page: "reports" }
  | { page: "customer360"; customerId: number }
  | { page: "sites" }
  | { page: "site-detail"; siteId: number }
  | { page: "devices" }
  | { page: "security-events" }
  | { page: "secureiot-dashboard" };

function currentRoute(): Route {
  const hash = window.location.hash;

  const customerMatch = hash.match(/^#customers\/(\d+)$/);
  if (customerMatch) {
    return { page: "customer360", customerId: Number(customerMatch[1]) };
  }

  const siteMatch = hash.match(/^#sites\/(\d+)$/);
  if (siteMatch) {
    return { page: "site-detail", siteId: Number(siteMatch[1]) };
  }

  if (hash === "#opportunities") return { page: "opportunities" };
  if (hash === "#field-visits") return { page: "field-visits" };
  if (hash === "#activities") return { page: "activities" };
  if (hash === "#reports") return { page: "reports" };
  if (hash === "#customers") return { page: "customers" };
  if (hash === "#sites") return { page: "sites" };
  if (hash === "#devices") return { page: "devices" };
  if (hash === "#security-events") return { page: "security-events" };
  if (hash === "#secureiot-dashboard") return { page: "secureiot-dashboard" };
  return { page: "dashboard" };
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const userRoles = user?.roles ?? [];

  // The un-navigated default ("#" or no hash) should land each role somewhere they can
  // actually see, not always on the CRM dashboard - a SECURITY_ADMIN/TECHNICIAN-only user
  // has no CRM access at all, so they land on the SecureIoT overview instead.
  const resolveRoute = (): Route => {
    const parsed = currentRoute();
    if (window.location.hash === "" && !hasPageAccess(userRoles, parsed.page)) {
      return { page: defaultPageForRoles(userRoles) } as Route;
    }
    return parsed;
  };

  const [route, setRoute] = useState<Route>(resolveRoute);

  useEffect(() => {
    const updateRoute = () => setRoute(resolveRoute());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePage =
    route.page === "customer360"
      ? "customers"
      : route.page === "site-detail"
        ? "sites"
        : route.page;

  // Backend require_role() dependencies remain authoritative; this only avoids showing a
  // page whose API calls would all 403, and steers the user to something they can access.
  const pageAllowed = hasPageAccess(userRoles, route.page);

  return (
    <AppShell activePage={activePage}>
      {!pageAllowed && (
        <section className="page-content">
          <div className="state-card state-card--error" role="alert">
            <div>
              <strong>Access restricted</strong>
              <p>Your role doesn't have access to this section.</p>
            </div>
            <a className="secondary-button" href={`#${defaultPageForRoles(userRoles)}`}>
              Go to my dashboard
            </a>
          </div>
        </section>
      )}
      {pageAllowed && (
        <>
          {route.page === "customers" && <CustomersPage />}
          {route.page === "opportunities" && <OpportunitiesPage />}
          {route.page === "field-visits" && <FieldVisitsPage />}
          {route.page === "activities" && <ActivitiesPage />}
          {route.page === "reports" && <ReportsPage />}
          {route.page === "customer360" && <Customer360Page customerId={route.customerId} />}
          {route.page === "sites" && <SitesPage />}
          {route.page === "site-detail" && <SiteDetailPage siteId={route.siteId} />}
          {route.page === "devices" && <DevicesPage />}
          {route.page === "security-events" && <SecurityEventsPage />}
          {route.page === "secureiot-dashboard" && <SecureIoTDashboardPage />}
          {route.page === "dashboard" && <DashboardPage />}
        </>
      )}
    </AppShell>
  );
}

function AuthGate() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AuthenticatedApp /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
