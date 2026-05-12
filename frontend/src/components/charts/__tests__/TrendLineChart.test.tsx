import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { TrendLineChart } from "../TrendLineChart";
import type { SpendingTrend } from "@/types/models";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="line-chart">{children}</svg>
  ),
  Line: () => <line data-testid="line" />,
  XAxis: () => <g data-testid="x-axis" />,
  YAxis: () => <g data-testid="y-axis" />,
  CartesianGrid: () => <g data-testid="grid" />,
  Tooltip: () => <g data-testid="tooltip" />,
}));

const mockData: SpendingTrend[] = [
  { period: "2026-04-01", total_amount: 150, transaction_count: 5 },
  { period: "2026-04-08", total_amount: 200, transaction_count: 8 },
  { period: "2026-04-15", total_amount: 175, transaction_count: 6 },
];

describe("TrendLineChart", () => {
  it("renders chart when given data", () => {
    renderWithProviders(
      <TrendLineChart data={mockData} granularity="weekly" />
    );
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    renderWithProviders(<TrendLineChart data={[]} granularity="daily" />);
    expect(screen.getByText("No data for this period")).toBeInTheDocument();
  });

  it("renders line and axis elements", () => {
    renderWithProviders(
      <TrendLineChart data={mockData} granularity="daily" />
    );
    expect(screen.getByTestId("line")).toBeInTheDocument();
    expect(screen.getByTestId("x-axis")).toBeInTheDocument();
    expect(screen.getByTestId("y-axis")).toBeInTheDocument();
  });
});
