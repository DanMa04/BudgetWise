import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { MonthlyComparisonChart } from "../MonthlyComparisonChart";
import type { MonthlyComparison } from "@/types/models";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="composed-chart">{children}</svg>
  ),
  Bar: ({ name }: { name: string }) => <g data-testid={`bar-${name}`} />,
  Line: ({ name }: { name: string }) => <line data-testid={`line-${name}`} />,
  XAxis: () => <g data-testid="x-axis" />,
  YAxis: () => <g data-testid="y-axis" />,
  CartesianGrid: () => <g data-testid="grid" />,
  Tooltip: () => <g data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

const mockData: MonthlyComparison[] = [
  { month: "Jan 2026", income: 5000, expenses: 3500, net: 1500 },
  { month: "Feb 2026", income: 5200, expenses: 3800, net: 1400 },
  { month: "Mar 2026", income: 4800, expenses: 4000, net: 800 },
];

describe("MonthlyComparisonChart", () => {
  it("renders chart when given data", () => {
    renderWithProviders(<MonthlyComparisonChart data={mockData} />);
    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    renderWithProviders(<MonthlyComparisonChart data={[]} />);
    expect(screen.getByText("No data for this period")).toBeInTheDocument();
  });

  it("renders income bar, expenses bar, and net line", () => {
    renderWithProviders(<MonthlyComparisonChart data={mockData} />);
    expect(screen.getByTestId("bar-Income")).toBeInTheDocument();
    expect(screen.getByTestId("bar-Expenses")).toBeInTheDocument();
    expect(screen.getByTestId("line-Net")).toBeInTheDocument();
  });
});
