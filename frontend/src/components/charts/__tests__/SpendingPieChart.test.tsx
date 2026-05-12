import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { SpendingPieChart } from "../SpendingPieChart";
import type { SpendingByCategory } from "@/types/models";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="pie-chart">{children}</svg>
  ),
  Pie: ({ data, children }: { data: unknown[]; children: React.ReactNode }) => (
    <g data-testid="pie" data-count={data.length}>
      {children}
    </g>
  ),
  Cell: ({ fill }: { fill: string }) => <rect data-testid="cell" fill={fill} />,
  Tooltip: () => <g data-testid="tooltip" />,
}));

const mockData: SpendingByCategory[] = [
  {
    category_id: "c1",
    category_name: "Groceries",
    category_color: "#22c55e",
    category_icon: "shopping-cart",
    total_amount: 450,
    transaction_count: 12,
    percentage: 45,
  },
  {
    category_id: "c2",
    category_name: "Entertainment",
    category_color: "#3b82f6",
    category_icon: "film",
    total_amount: 300,
    transaction_count: 8,
    percentage: 30,
  },
  {
    category_id: "c3",
    category_name: "Transportation",
    category_color: "#ef4444",
    category_icon: "car",
    total_amount: 250,
    transaction_count: 5,
    percentage: 25,
  },
];

describe("SpendingPieChart", () => {
  it("renders chart when given data", () => {
    renderWithProviders(<SpendingPieChart data={mockData} />);
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    renderWithProviders(<SpendingPieChart data={[]} />);
    expect(screen.getByText("No data for this period")).toBeInTheDocument();
  });

  it("renders a cell for each category", () => {
    renderWithProviders(<SpendingPieChart data={mockData} />);
    const cells = screen.getAllByTestId("cell");
    expect(cells.length).toBe(3);
  });

  it("displays the total amount in the center", () => {
    renderWithProviders(<SpendingPieChart data={mockData} />);
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
  });
});
