import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { TransactionList } from "../TransactionList";
import type { Transaction } from "@/types/models";

const mockTransactions: Transaction[] = [
  {
    id: "1",
    user_id: "u1",
    account_id: "a1",
    category_id: "c1",
    date: "2026-01-15",
    amount: 42.5,
    description: "Grocery Shopping",
    notes: null,
    is_pending: false,
    is_recurring: false,
    source: "manual",
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
  },
  {
    id: "2",
    user_id: "u1",
    account_id: "a1",
    category_id: null,
    date: "2026-01-14",
    amount: -1500.0,
    description: "Salary Deposit",
    notes: null,
    is_pending: false,
    is_recurring: true,
    source: "manual",
    created_at: "2026-01-14T00:00:00Z",
    updated_at: "2026-01-14T00:00:00Z",
  },
];

describe("TransactionList", () => {
  it("renders transactions in a table", () => {
    renderWithProviders(
      <TransactionList transactions={mockTransactions} />
    );

    expect(screen.getByText("Grocery Shopping")).toBeInTheDocument();
    expect(screen.getByText("Salary Deposit")).toBeInTheDocument();
  });

  it("shows empty state when no transactions", () => {
    renderWithProviders(<TransactionList transactions={[]} />);

    expect(screen.getByText("No transactions yet")).toBeInTheDocument();
    expect(
      screen.getByText("Add a transaction to get started.")
    ).toBeInTheDocument();
  });

  it("formats currency correctly", () => {
    renderWithProviders(
      <TransactionList transactions={mockTransactions} />
    );

    expect(screen.getByText("$42.50")).toBeInTheDocument();
    expect(screen.getByText("$1,500.00")).toBeInTheDocument();
  });

  it("formats dates correctly", () => {
    renderWithProviders(
      <TransactionList transactions={mockTransactions} />
    );

    expect(screen.getByText("Jan 15, 2026")).toBeInTheDocument();
    expect(screen.getByText("Jan 14, 2026")).toBeInTheDocument();
  });

  it("colors expenses red and income green", () => {
    renderWithProviders(
      <TransactionList transactions={mockTransactions} />
    );

    const expenseCell = screen.getByText("$42.50").closest("td");
    const incomeCell = screen.getByText("$1,500.00").closest("td");

    expect(expenseCell?.className).toContain("text-red-500");
    expect(incomeCell?.className).toContain("text-green-600");
  });
});
