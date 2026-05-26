import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const TransactionsPage = lazy(() =>
  import("@/pages/TransactionsPage").then((m) => ({
    default: m.TransactionsPage,
  })),
);
const BudgetsPage = lazy(() =>
  import("@/pages/BudgetsPage").then((m) => ({ default: m.BudgetsPage })),
);
const ImportPage = lazy(() =>
  import("@/pages/ImportPage").then((m) => ({ default: m.ImportPage })),
);
const ReportsPage = lazy(() =>
  import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);
const AccountsPage = lazy(() =>
  import("@/pages/AccountsPage").then((m) => ({ default: m.AccountsPage })),
);
const GoalsPage = lazy(() =>
  import("@/pages/GoalsPage").then((m) => ({ default: m.GoalsPage })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);
const CategoriesPage = lazy(() =>
  import("@/pages/CategoriesPage").then((m) => ({
    default: m.CategoriesPage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const PrivacyPage = lazy(() =>
  import("@/pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })),
);

export const router = createBrowserRouter([
  {
    path: "privacy",
    element: (
      <Suspense fallback={null}>
        <PrivacyPage />
      </Suspense>
    ),
  },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "transactions", element: <TransactionsPage /> },
      { path: "budgets", element: <BudgetsPage /> },
      { path: "goals", element: <GoalsPage /> },
      { path: "accounts", element: <AccountsPage /> },
      { path: "import", element: <ImportPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
