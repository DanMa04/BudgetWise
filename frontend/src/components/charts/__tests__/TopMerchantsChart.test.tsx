import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { TopMerchantsChart } from "../TopMerchantsChart";
import type { TopMerchant } from "@/types/models";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="bar-chart">{children}</svg>
  ),
  Bar: () => <g data-testid="bar" />,
  Cell: () => <g data-testid="cell" />,
  XAxis: () => <g data-testid="x-axis" />,
  YAxis: () => <g data-testid="y-axis" />,
  Tooltip: () => <g data-testid="tooltip" />,
}));

const mockData: TopMerchant[] = [
  { description: "Whole Foods", total_amount: 450, transaction_count: 12 },
  { description: "Amazon", total_amount: 380, transaction_count: 8 },
  { description: "Starbucks", total_amount: 120, transaction_count: 25 },
];

describe("TopMerchantsChart", () => {
  it("renders chart when given data", () => {
    renderWithProviders(<TopMerchantsChart data={mockData} />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    renderWithProviders(<TopMerchantsChart data={[]} />);
    expect(screen.getByText("No data for this period")).toBeInTheDocument();
  });
});
