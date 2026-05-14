import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoalProgressRing } from "../GoalProgressRing";

describe("GoalProgressRing", () => {
  it("renders percentage text", () => {
    render(<GoalProgressRing percentage={65} />);
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("shows 0% for empty goal", () => {
    render(<GoalProgressRing percentage={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("shows 100% for completed goal", () => {
    render(<GoalProgressRing percentage={100} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
