import { useEffect, useState } from "react";

import { AppShell } from "./components/AppShell";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";

type Page = "dashboard" | "customers";

function currentPage(): Page {
  return window.location.hash === "#customers" ? "customers" : "dashboard";
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
      {page === "customers" ? <CustomersPage /> : <DashboardPage />}
    </AppShell>
  );
}
