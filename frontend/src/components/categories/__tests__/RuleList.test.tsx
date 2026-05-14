import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { RuleList } from "../RuleList";
import type { CategorizationRule } from "@/types/models";

const mockRules: CategorizationRule[] = [
  {
    id: "r1",
    user_id: "u1",
    category_id: "c1",
    rule_type: "contains",
    pattern: "walmart",
    priority: 10,
    is_active: true,
    created_by: "user",
    match_count: 5,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "r2",
    user_id: "u1",
    category_id: "c1",
    rule_type: "exact",
    pattern: "COSTCO WHOLESALE",
    priority: 20,
    is_active: true,
    created_by: "ml",
    match_count: 12,
    created_at: "2026-01-02T00:00:00Z",
  },
];

const mockDeleteMutate = vi.fn();

vi.mock("@/hooks/useCategorization", () => ({
  useRules: (categoryId?: string) => ({
    data: categoryId === "empty" ? [] : mockRules,
    isLoading: false,
  }),
  useDeleteRule: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
}));

describe("RuleList", () => {
  it("renders rules table", () => {
    renderWithProviders(<RuleList categoryId="c1" />);

    expect(screen.getByText("walmart")).toBeInTheDocument();
    expect(screen.getByText("COSTCO WHOLESALE")).toBeInTheDocument();
    expect(screen.getByText("contains")).toBeInTheDocument();
    expect(screen.getByText("exact")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    renderWithProviders(<RuleList categoryId="empty" />);

    expect(screen.getByText("No rules yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Rules are created when you correct transaction categories."
      )
    ).toBeInTheDocument();
  });

  it("handles delete action", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RuleList categoryId="c1" />);

    const deleteButtons = screen.getAllByRole("button", {
      name: /delete rule/i,
    });
    await user.click(deleteButtons[0]);

    expect(mockDeleteMutate).toHaveBeenCalledWith("r1");
  });
});
