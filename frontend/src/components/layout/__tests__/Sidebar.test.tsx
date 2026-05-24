import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { Sidebar } from "../Sidebar";

describe("Sidebar", () => {
  it("renders the app name", () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Kallio")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Transactions")).toBeInTheDocument();
    expect(screen.getByText("Budgets")).toBeInTheDocument();
    expect(screen.getByText("Goals")).toBeInTheDocument();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
    expect(screen.getByText("Import")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders navigation links with correct hrefs", () => {
    renderWithProviders(<Sidebar />);
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveAttribute("href", "/");
    const transactionsLink = screen.getByText("Transactions").closest("a");
    expect(transactionsLink).toHaveAttribute("href", "/transactions");
  });
});
