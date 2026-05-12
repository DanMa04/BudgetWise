import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { BudgetVsActualBar } from "../BudgetVsActualBar";
import type { BudgetVsActual } from "@/types/models";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="bar-chart">{children}</svg>
  ),
  Bar: ({
    children,
    name,
  }: {
    children?: React.ReactNode;
    name: string;
  }) => (
    <g data-testid={`bar-${name}`}>
      {children}
    </g>
  ),
  Cell: ({ fill }: { fill: string }) => <rect data-testid="cell" data-fill={fill} />,
  XAxis: () => <g data-testid="x-axis" />,
  YAxis: () => <g data-testid="y-axis" />,
  CartesianGrid: () => <g data-testid="grid" />,
  Tooltip: () => <g data-testid="tooltip" />,
}));

const mockData: BudgetVsActual[] = [
  {
    budget_id: "b1",
    category_name: "Groceries",
    category_color: "#22c55e",
    budgeted_amount: 500,
    actual_amount: 420,
    difference: 80,
    percentage_used: 84,
  },
  {
    budget_id: "b2",
    category_name: "Dining",
    category_color: "#ef4444",
    budgeted_amount: 200,
    actual_amount: 250,
    difference: -50,
    percentage_used: 125,
  },
];

describe("BudgetVsActualBar", () => {
  it("renders chart when given data", () => {
    renderWithProviders(<BudgetVsActualBar data={mockData} />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    renderWithProviders(<BudgetVsActualBar data={[]} />);
    expect(screen.getByText("No data for this period")).toBeInTheDocument();
  });

  it("renders budgeted and actual bars with correct coloring", () => {
    renderWithProviders(<BudgetVsActualBar data={mockData} />);
    expect(screen.getByTestId("bar-Budgeted")).toBeInTheDocument();
    expect(screen.getByTestId("bar-Actual")).toBeInTheDocument();
    const cells = screen.getAllByTestId("cell");
    const fills = cells.map((c) => c.getAttribute("data-fill"));
    expect(fills).toContain("#22c55e");
    expect(fills).toContain("#ef4444");
  });
});
