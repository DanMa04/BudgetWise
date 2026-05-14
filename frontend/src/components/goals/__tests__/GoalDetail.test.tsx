import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoalDetail } from "../GoalDetail";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/hooks/useGoals", () => ({
  useGoal: () => ({
    data: {
      id: "1",
      name: "Vacation Fund",
      goal_type: "savings",
      target_amount: 5000,
      current_amount: 2000,
      percentage: 40,
      remaining_amount: 3000,
      monthly_rate: 400,
      projected_completion: "2026-12-01",
      milestones_reached: [25],
      contribution_count: 4,
      recent_contributions: [],
      color: null,
    },
    isLoading: false,
  }),
  useAddContribution: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useContributions: () => ({
    data: [
      {
        id: "c1",
        goal_id: "1",
        amount: 500,
        note: "Deposit",
        transaction_id: null,
        contributed_at: "2026-05-01",
        created_at: "2026-05-01",
      },
    ],
  }),
}));

describe("GoalDetail", () => {
  it("renders progress and stats", () => {
    renderWithProviders(
      <GoalDetail goalId="1" open={true} onClose={() => {}} />
    );
    expect(screen.getByText("Vacation Fund")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText(/\$2,000\.00/)).toBeInTheDocument();
  });

  it("shows contribution form", () => {
    renderWithProviders(
      <GoalDetail goalId="1" open={true} onClose={() => {}} />
    );
    expect(screen.getByPlaceholderText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  it("shows contribution history", () => {
    renderWithProviders(
      <GoalDetail goalId="1" open={true} onClose={() => {}} />
    );
    expect(screen.getByText("Contribution History")).toBeInTheDocument();
    expect(screen.getByText("Deposit")).toBeInTheDocument();
  });
});
