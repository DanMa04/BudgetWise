import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { BudgetProgressBar } from "../BudgetProgressBar";

describe("BudgetProgressBar", () => {
  it("renders with correct width style", () => {
    renderWithProviders(<BudgetProgressBar percentage={60} />);

    const progressBar = screen.getByRole("progressbar");
    const fill = progressBar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("60%");
  });

  it("clamps width to 100% for overspending", () => {
    renderWithProviders(<BudgetProgressBar percentage={150} />);

    const progressBar = screen.getByRole("progressbar");
    const fill = progressBar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("applies green color when under 80%", () => {
    renderWithProviders(<BudgetProgressBar percentage={50} />);

    const progressBar = screen.getByRole("progressbar");
    const fill = progressBar.firstElementChild;
    expect(fill?.className).toContain("bg-green-500");
  });

  it("applies yellow color between 80-99%", () => {
    renderWithProviders(<BudgetProgressBar percentage={85} />);

    const progressBar = screen.getByRole("progressbar");
    const fill = progressBar.firstElementChild;
    expect(fill?.className).toContain("bg-yellow-500");
  });

  it("applies red color at 100% or above", () => {
    renderWithProviders(<BudgetProgressBar percentage={100} />);

    const progressBar = screen.getByRole("progressbar");
    const fill = progressBar.firstElementChild;
    expect(fill?.className).toContain("bg-red-500");
  });

  it("sets correct aria values", () => {
    renderWithProviders(<BudgetProgressBar percentage={75} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "75");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
  });
});
