import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { BulkCategorize } from "../BulkCategorize";

const mockBulkMutate = vi.fn();

vi.mock("@/hooks/useCategorization", () => ({
  useBulkCategorize: () => ({
    mutate: mockBulkMutate,
    isPending: false,
  }),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    data: [
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
    ],
  }),
}));

describe("BulkCategorize", () => {
  it("shows selected count", () => {
    renderWithProviders(
      <BulkCategorize selectedIds={["t1", "t2", "t3"]} onComplete={() => {}} />
    );

    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("renders category picker", () => {
    renderWithProviders(
      <BulkCategorize selectedIds={["t1"]} onComplete={() => {}} />
    );

    expect(screen.getByText("Assign category")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
  });

  it("calls bulk categorize on submit", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <BulkCategorize selectedIds={["t1", "t2"]} onComplete={onComplete} />
    );

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "c1");

    const button = screen.getByRole("button", { name: /categorize/i });
    await user.click(button);

    expect(mockBulkMutate).toHaveBeenCalledWith(
      { transactionIds: ["t1", "t2"], categoryId: "c1" },
      expect.any(Object)
    );
  });
});
