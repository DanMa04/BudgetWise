import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { AccountCard } from "../AccountCard";
import type { Account } from "@/types/models";

const baseAccount: Account = {
  id: "1",
  user_id: "u1",
  name: "My Checking",
  account_type: "checking",
  institution_name: "Chase Bank",
  currency_code: "USD",
  current_balance: 1500.5,
  is_active: true,
  plaid_item_id: null,
  plaid_account_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("AccountCard", () => {
  it("renders account name and balance", () => {
    renderWithProviders(<AccountCard account={baseAccount} />);
    expect(screen.getByText("My Checking")).toBeInTheDocument();
    expect(screen.getByText("$1,500.50")).toBeInTheDocument();
  });

  it("shows linked badge for Plaid accounts", () => {
    const linkedAccount: Account = {
      ...baseAccount,
      plaid_item_id: "plaid-123",
      plaid_account_id: "acct-456",
    };
    renderWithProviders(<AccountCard account={linkedAccount} />);
    expect(screen.getByText("Linked")).toBeInTheDocument();
  });

  it("shows institution name", () => {
    renderWithProviders(<AccountCard account={baseAccount} />);
    expect(screen.getByText("Chase Bank")).toBeInTheDocument();
  });

  it("colors negative balances red", () => {
    const negativeAccount: Account = {
      ...baseAccount,
      current_balance: -250.0,
    };
    renderWithProviders(<AccountCard account={negativeAccount} />);
    const balanceEl = screen.getByText("-$250.00");
    expect(balanceEl.className).toContain("text-red-500");
  });
});
