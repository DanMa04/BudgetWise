import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { ReportsPage } from "../ReportsPage";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue("test-token"),
  }),
}));

vi.mock("@/hooks/useReports", () => ({
  useSpendingByCategory: () => ({ data: [], isLoading: false }),
  useSpendingByCategoryOverTime: () => ({ data: [], isLoading: false }),
  useSpendingTrends: () => ({ data: [], isLoading: false }),
  useBudgetVsActual: () => ({ data: [], isLoading: false }),
  useMonthlyComparison: () => ({ data: [], isLoading: false }),
  useIncomeVsExpense: () => ({ data: [], isLoading: false }),
  useTopMerchants: () => ({ data: [], isLoading: false }),
  useCategoryVendors: () => ({ data: [], isLoading: false }),
  useVendorSpendingOverTime: () => ({ data: [], isLoading: false }),
}));

describe("ReportsPage", () => {
  it("renders the page title", () => {
    renderWithProviders(<ReportsPage />);
    expect(screen.getByText("Reports")).toBeInTheDocument();
  });

  it("renders date range preset buttons", () => {
    renderWithProviders(<ReportsPage />);
    expect(screen.getByText("7D")).toBeInTheDocument();
    expect(screen.getByText("30D")).toBeInTheDocument();
    expect(screen.getByText("90D")).toBeInTheDocument();
    expect(screen.getByText("6M")).toBeInTheDocument();
    expect(screen.getByText("1Y")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("renders all tabs", () => {
    renderWithProviders(<ReportsPage />);
    expect(screen.getByText("Spending")).toBeInTheDocument();
    expect(screen.getByText("Budgets")).toBeInTheDocument();
    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Trends")).toBeInTheDocument();
  });

  it("switches between tabs", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />);

    await user.click(screen.getByText("Budgets"));
    expect(screen.getByText("Budget vs. Actual Spending")).toBeInTheDocument();

    await user.click(screen.getByText("Income"));
    expect(screen.getByText("Income vs. Expenses")).toBeInTheDocument();

    await user.click(screen.getByText("Trends"));
    expect(screen.getByText("Spending Trends")).toBeInTheDocument();
  });
});
