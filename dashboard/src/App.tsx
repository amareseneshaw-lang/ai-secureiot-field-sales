import { useEffect, useState } from "react";

import { AppShell } from "./components/AppShell";
import { Customer360Page } from "./pages/Customer360Page";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { OpportunitiesPage } from "./pages/OpportunitiesPage";

type Route =
  | { page: "dashboard" }
  | { page: "customers" }
  | { page: "opportunities" }
  | { page: "customer360"; customerId: number };

function currentRoute(): Route {
  const hash = window.location.hash;

  const customerMatch = hash.match(/^#customers\/(\d+)$/);
  if (customerMatch) {
    return { page: "customer360", customerId: Number(customerMatch[1]) };
  }

  if (hash === "#opportunities") return { page: "opportunities" };
  if (hash === "#customers") return { page: "customers" };
  return { page: "dashboard" };
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const updateRoute = () => setRoute(currentRoute());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  const activePage = route.page === "customer360" ? "customers" : route.page;

  return (
    <AppShell activePage={activePage}>
      {route.page === "customers" && <CustomersPage />}
      {route.page === "opportunities" && <OpportunitiesPage />}
      {route.page === "customer360" && <Customer360Page customerId={route.customerId} />}
      {route.page === "dashboard" && <DashboardPage />}
    </AppShell>
  );
}
