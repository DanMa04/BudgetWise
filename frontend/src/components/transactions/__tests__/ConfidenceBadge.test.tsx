import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { ConfidenceBadge } from "../ConfidenceBadge";

describe("ConfidenceBadge", () => {
  it("shows nothing for manual source", () => {
    const { container } = renderWithProviders(
      <ConfidenceBadge confidence={null} source="manual" />
    );

    expect(container.innerHTML).toBe("");
  });

  it("shows blue Rule badge for rule source", () => {
    renderWithProviders(
      <ConfidenceBadge confidence={1.0} source="rule" />
    );

    const badge = screen.getByText("Rule");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-blue-700");
  });

  it("shows green AI badge for high confidence", () => {
    renderWithProviders(
      <ConfidenceBadge confidence={0.95} source="ml" />
    );

    const badge = screen.getByText("AI");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-green-700");
  });

  it("shows red uncategorized badge for null category", () => {
    renderWithProviders(
      <ConfidenceBadge confidence={null} source={null} />
    );

    const badge = screen.getByText("Uncategorized");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-red-700");
  });
});
