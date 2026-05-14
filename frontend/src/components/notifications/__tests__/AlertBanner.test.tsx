import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { AlertBanner } from "../AlertBanner";

vi.mock("@/hooks/useBudgets", () => ({
  useBudgetSummary: () => ({
    data: {
      total_budgeted: 2000,
      total_spent: 1800,
      total_remaining: 200,
      budgets: [
        {
          id: "b1",
          user_id: "u1",
          category_id: "c1",
          name: "Groceries",
          amount: 500,
          period_type: "monthly",
          start_date: "2026-05-01",
          end_date: null,
          is_active: true,
          rollover: false,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
          spent_amount: 550,
          remaining_amount: -50,
          percentage_used: 110,
        },
        {
          id: "b2",
          user_id: "u1",
          category_id: "c2",
          name: "Dining",
          amount: 300,
          period_type: "monthly",
          start_date: "2026-05-01",
          end_date: null,
          is_active: true,
          rollover: false,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
          spent_amount: 255,
          remaining_amount: 45,
          percentage_used: 85,
        },
        {
          id: "b3",
          user_id: "u1",
          category_id: "c3",
          name: "Entertainment",
          amount: 200,
          period_type: "monthly",
          start_date: "2026-05-01",
          end_date: null,
          is_active: true,
          rollover: false,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
          spent_amount: 100,
          remaining_amount: 100,
          percentage_used: 50,
        },
      ],
    },
    isLoading: false,
  }),
}));

describe("AlertBanner", () => {
  it("shows warning for over-budget", () => {
    renderWithProviders(<AlertBanner />);
    expect(screen.getByText(/Groceries/)).toBeInTheDocument();
    expect(screen.getByText(/is over budget at 110%/)).toBeInTheDocument();
  });

  it("shows different styling for warning vs exceeded", () => {
    renderWithProviders(<AlertBanner />);
    // Groceries at 110% -> exceeded (red styling)
    const groceriesAlert = screen.getByText(/Groceries/).closest("[role='alert']");
    expect(groceriesAlert?.className).toContain("red");

    // Dining at 85% -> warning (yellow styling)
    const diningAlert = screen.getByText(/Dining/).closest("[role='alert']");
    expect(diningAlert?.className).toContain("yellow");
  });

  it("does not show alerts for budgets under 80%", () => {
    renderWithProviders(<AlertBanner />);
    expect(screen.queryByText(/Entertainment/)).not.toBeInTheDocument();
  });

  it("can be dismissed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AlertBanner />);

    expect(screen.getByText(/Groceries/)).toBeInTheDocument();

    const dismissButton = screen.getByLabelText("Dismiss Groceries alert");
    await user.click(dismissButton);

    expect(screen.queryByText(/Groceries/)).not.toBeInTheDocument();
    // Dining should still be visible
    expect(screen.getByText(/Dining/)).toBeInTheDocument();
  });
});
