import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { CategoryPicker } from "../CategoryPicker";
import type { Category } from "@/types/models";

const mockCategories: Category[] = [
  {
    id: "c1",
    user_id: null,
    parent_id: null,
    name: "Groceries",
    icon: null,
    color: "#22c55e",
    is_system: true,
    is_income: false,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "c2",
    user_id: null,
    parent_id: null,
    name: "Transportation",
    icon: null,
    color: "#3b82f6",
    is_system: true,
    is_income: false,
    sort_order: 1,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "c3",
    user_id: null,
    parent_id: null,
    name: "Salary",
    icon: null,
    color: "#eab308",
    is_system: true,
    is_income: true,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("CategoryPicker", () => {
  it("renders categories in groups", () => {
    renderWithProviders(
      <CategoryPicker
        categories={mockCategories}
        value=""
        onChange={() => {}}
      />
    );

    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Transportation")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
  });

  it("calls onChange when a category is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <CategoryPicker
        categories={mockCategories}
        value=""
        onChange={onChange}
      />
    );

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "c1");

    expect(onChange).toHaveBeenCalledWith("c1");
  });

  it("shows placeholder text", () => {
    renderWithProviders(
      <CategoryPicker
        categories={mockCategories}
        value=""
        onChange={() => {}}
        placeholder="Pick one"
      />
    );

    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });
});
