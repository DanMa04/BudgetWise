import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { NotificationPreferences } from "../NotificationPreferences";

const mockUpsert = vi.fn();

vi.mock("@/hooks/useNotifications", () => ({
  useNotificationPreferences: () => ({
    data: [
      {
        id: "p1",
        user_id: "u1",
        notification_type: "budget_warning",
        channel: "in_app",
        enabled: true,
        threshold: 80,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
    ],
    isLoading: false,
  }),
  useUpsertPreference: () => ({
    mutate: mockUpsert,
    isPending: false,
  }),
}));

describe("NotificationPreferences", () => {
  it("renders all notification type rows", () => {
    renderWithProviders(<NotificationPreferences />);
    expect(screen.getByText("Budget Warning (80%)")).toBeInTheDocument();
    expect(screen.getByText("Budget Warning (90%)")).toBeInTheDocument();
    expect(screen.getByText("Budget Exceeded (100%)")).toBeInTheDocument();
    expect(screen.getByText("Pace Alert")).toBeInTheDocument();
    expect(screen.getByText("Goal Milestone")).toBeInTheDocument();
    expect(screen.getByText("Weekly Summary")).toBeInTheDocument();
  });

  it("renders channel toggles", () => {
    renderWithProviders(<NotificationPreferences />);
    // Should have In-App column header
    expect(screen.getByText("In-App")).toBeInTheDocument();
    // Push and Email should show "Coming soon"
    const comingSoonElements = screen.getAllByText("Coming soon");
    expect(comingSoonElements.length).toBeGreaterThanOrEqual(6);
  });

  it("toggles call upsert", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationPreferences />);

    // Find the switch for Budget Warning (80%) In-App -- it should be checked
    const toggle = screen.getByLabelText("Budget Warning (80%) In-App");
    await user.click(toggle);

    expect(mockUpsert).toHaveBeenCalledWith({
      notification_type: "budget_warning",
      channel: "in_app",
      enabled: false,
      threshold: 80,
    });
  });
});
