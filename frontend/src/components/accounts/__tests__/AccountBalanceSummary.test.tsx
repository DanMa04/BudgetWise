import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { AccountBalanceSummary } from "../AccountBalanceSummary";
import type { Account } from "@/types/models";

function makeAccount(
  overrides: Partial<Account> & { account_type: string }
): Account {
  return {
    id: Math.random().toString(),
    user_id: "u1",
    name: "Account",
    institution_name: null,
    currency_code: "USD",
    current_balance: 0,
    is_active: true,
    plaid_item_id: null,
    plaid_account_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("AccountBalanceSummary", () => {
  it("calculates net worth correctly", () => {
    const accounts = [
      makeAccount({ account_type: "checking", current_balance: 3000 }),
      makeAccount({ account_type: "savings", current_balance: 7000 }),
      makeAccount({ account_type: "credit", current_balance: -2000 }),
    ];

    renderWithProviders(<AccountBalanceSummary accounts={accounts} />);
    expect(screen.getByText("$8,000.00")).toBeInTheDocument();
  });

  it("shows assets vs liabilities", () => {
    const accounts = [
      makeAccount({ account_type: "checking", current_balance: 5000 }),
      makeAccount({ account_type: "credit", current_balance: -1500 }),
    ];

    renderWithProviders(<AccountBalanceSummary accounts={accounts} />);
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByText("Liabilities")).toBeInTheDocument();
    expect(screen.getByText("$5,000.00")).toBeInTheDocument();
    expect(screen.getByText("$1,500.00")).toBeInTheDocument();
  });

  it("handles empty accounts", () => {
    renderWithProviders(<AccountBalanceSummary accounts={[]} />);
    expect(screen.getByText("Net Worth")).toBeInTheDocument();
    expect(screen.getAllByText("$0.00")).toHaveLength(3);
  });
});
