import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { GoalSummaryCards } from "../GoalSummaryCards";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/hooks/useGoals", () => ({
  useGoalSummary: () => ({
    data: {
      total_goals: 3,
      active_goals: 2,
      total_target: 25000,
      total_saved: 10000,
      overall_progress: 40,
    },
    isLoading: false,
  }),
}));

describe("GoalSummaryCards", () => {
  it("renders summary values", () => {
    renderWithProviders(<GoalSummaryCards />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3 total")).toBeInTheDocument();
    expect(screen.getByText("$25,000.00")).toBeInTheDocument();
    expect(screen.getByText("$10,000.00")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("renders all four cards", () => {
    renderWithProviders(<GoalSummaryCards />);
    expect(screen.getByText("Total Goals")).toBeInTheDocument();
    expect(screen.getByText("Total Target")).toBeInTheDocument();
    expect(screen.getByText("Total Saved")).toBeInTheDocument();
    expect(screen.getByText("Overall Progress")).toBeInTheDocument();
  });
});
