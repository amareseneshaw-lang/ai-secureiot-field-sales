import { useEffect, useState } from "react";

import { AppShell } from "./components/AppShell";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { OpportunitiesPage } from "./pages/OpportunitiesPage";

type Page = "dashboard" | "customers" | "opportunities";

function currentPage(): Page {
  if (window.location.hash === "#customers") return "customers";
  if (window.location.hash === "#opportunities") return "opportunities";
  return "dashboard";
}

export default function App() {
  const [page, setPage] = useState<Page>(currentPage);

  useEffect(() => {
    const updatePage = () => setPage(currentPage());
    window.addEventListener("hashchange", updatePage);
    return () => window.removeEventListener("hashchange", updatePage);
  }, []);

  return (
    <AppShell activePage={page}>
      {page === "customers" && <CustomersPage />}
      {page === "opportunities" && <OpportunitiesPage />}
      {page === "dashboard" && <DashboardPage />}
    </AppShell>
  );
}
