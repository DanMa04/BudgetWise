import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { AccountList } from "../AccountList";
import type { Account } from "@/types/models";

const mockAccounts: Account[] = [
  {
    id: "1",
    user_id: "u1",
    name: "Checking",
    account_type: "checking",
    institution_name: "Chase Bank",
    currency_code: "USD",
    current_balance: 1000,
    is_active: true,
    plaid_item_id: null,
    plaid_account_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "2",
    user_id: "u1",
    name: "Savings",
    account_type: "savings",
    institution_name: "Chase Bank",
    currency_code: "USD",
    current_balance: 5000,
    is_active: true,
    plaid_item_id: null,
    plaid_account_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "3",
    user_id: "u1",
    name: "Cash",
    account_type: "checking",
    institution_name: null,
    currency_code: "USD",
    current_balance: 200,
    is_active: true,
    plaid_item_id: null,
    plaid_account_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue("test-token"),
  }),
}));

vi.mock("@/hooks/useAccounts", () => ({
  useAccounts: vi.fn(),
}));

import { useAccounts } from "@/hooks/useAccounts";
const mockUseAccounts = vi.mocked(useAccounts);

describe("AccountList", () => {
  it("renders grouped accounts", () => {
    mockUseAccounts.mockReturnValue({
      data: mockAccounts,
      isLoading: false,
    } as ReturnType<typeof useAccounts>);

    renderWithProviders(<AccountList />);
    expect(
      screen.getByRole("heading", { name: "Chase Bank" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Manual Accounts" })
    ).toBeInTheDocument();
    expect(screen.getByText("Checking")).toBeInTheDocument();
    expect(screen.getByText("Savings")).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    mockUseAccounts.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useAccounts>);

    renderWithProviders(<AccountList />);
    expect(
      screen.getByText(
        "No accounts yet. Link a bank or create a manual account."
      )
    ).toBeInTheDocument();
  });

  it("shows loading skeleton", () => {
    mockUseAccounts.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useAccounts>);

    renderWithProviders(<AccountList />);
    expect(screen.getByTestId("account-list-skeleton")).toBeInTheDocument();
  });
});
