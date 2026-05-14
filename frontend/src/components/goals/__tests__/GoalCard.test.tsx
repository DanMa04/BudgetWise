import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GoalCard } from "../GoalCard";
import type { GoalWithProgress } from "@/types/models";

const mockGoal: GoalWithProgress = {
  id: "1",
  user_id: "u1",
  name: "Vacation Fund",
  goal_type: "savings",
  target_amount: 10000,
  current_amount: 5000,
  currency_code: "USD",
  icon: "plane",
  color: "#22C55E",
  target_date: null,
  linked_account_id: null,
  is_active: true,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  percentage: 50,
  remaining_amount: 5000,
  monthly_rate: 500,
  projected_completion: "2026-11-01",
  milestones_reached: [25, 50],
  contribution_count: 5,
  recent_contributions: [],
};

describe("GoalCard", () => {
  it("renders goal name and amounts", () => {
    render(<GoalCard goal={mockGoal} />);
    expect(screen.getByText("Vacation Fund")).toBeInTheDocument();
    expect(screen.getAllByText(/\$5,000\.00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$10,000\.00/)).toBeInTheDocument();
  });

  it("shows type badge", () => {
    render(<GoalCard goal={mockGoal} />);
    expect(screen.getByText("Savings")).toBeInTheDocument();
  });

  it("shows progress ring", () => {
    render(<GoalCard goal={mockGoal} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("handles click", () => {
    const onClick = vi.fn();
    render(<GoalCard goal={mockGoal} onClick={onClick} />);
    fireEvent.click(screen.getByText("Vacation Fund"));
    expect(onClick).toHaveBeenCalled();
  });
});
