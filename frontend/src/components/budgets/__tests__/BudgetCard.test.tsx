import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { BudgetCard } from "../BudgetCard";
import type { BudgetWithSpend } from "@/types/models";

function makeBudget(overrides: Partial<BudgetWithSpend> = {}): BudgetWithSpend {
  return {
    id: "b1",
    user_id: "u1",
    category_id: "c1",
    name: "Groceries",
    amount: 500,
    period_type: "monthly",
    start_date: "2026-01-01",
    end_date: null,
    is_active: true,
    rollover: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    spent_amount: 200,
    remaining_amount: 300,
    percentage_used: 40,
    ...overrides,
  };
}

describe("BudgetCard", () => {
  it("renders budget name and amounts", () => {
    renderWithProviders(<BudgetCard budget={makeBudget()} />);

    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Spent: $200.00")).toBeInTheDocument();
    expect(screen.getByText("of $500.00")).toBeInTheDocument();
    expect(screen.getByText("$300.00")).toBeInTheDocument();
  });

  it("shows green progress bar when under 80%", () => {
    renderWithProviders(
      <BudgetCard budget={makeBudget({ percentage_used: 40 })} />
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
    const fill = progressBar.firstElementChild;
    expect(fill?.className).toContain("bg-green-500");
  });

  it("shows yellow progress bar at 80-99%", () => {
    renderWithProviders(
      <BudgetCard
        budget={makeBudget({
          percentage_used: 90,
          spent_amount: 450,
          remaining_amount: 50,
        })}
      />
    );

    const progressBar = screen.getByRole("progressbar");
    const fill = progressBar.firstElementChild;
    expect(fill?.className).toContain("bg-yellow-500");
  });

  it("shows red progress bar at 100% or more", () => {
    renderWithProviders(
      <BudgetCard
        budget={makeBudget({
          percentage_used: 110,
          spent_amount: 550,
          remaining_amount: -50,
        })}
      />
    );

    const progressBar = screen.getByRole("progressbar");
    const fill = progressBar.firstElementChild;
    expect(fill?.className).toContain("bg-red-500");
  });
});
