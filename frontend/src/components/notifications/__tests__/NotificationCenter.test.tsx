import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { NotificationCenter } from "../NotificationCenter";

const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();
let mockUnreadCount = 3;
let mockItems: Array<Record<string, unknown>> = [];

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    data: {
      items: mockItems,
      total: mockItems.length,
      page: 1,
      per_page: 20,
    },
    isLoading: false,
  }),
  useUnreadCount: () => ({
    data: { count: mockUnreadCount },
  }),
  useMarkRead: () => ({
    mutate: mockMarkRead,
    isPending: false,
  }),
  useMarkAllRead: () => ({
    mutate: mockMarkAllRead,
    isPending: false,
  }),
}));

describe("NotificationCenter", () => {
  beforeEach(() => {
    mockMarkRead.mockClear();
    mockMarkAllRead.mockClear();
    mockUnreadCount = 3;
    mockItems = [
      {
        id: "n1",
        user_id: "u1",
        notification_type: "budget_warning",
        channel: "in_app",
        title: "Budget Warning",
        message: "Groceries budget is at 85%",
        data: null,
        is_read: false,
        sent_at: "2026-05-14T10:00:00Z",
        read_at: null,
        status: "sent",
        related_entity_type: "budget",
        related_entity_id: "b1",
      },
      {
        id: "n2",
        user_id: "u1",
        notification_type: "goal_milestone",
        channel: "in_app",
        title: "Goal Milestone",
        message: "You reached 50% of Vacation Fund",
        data: null,
        is_read: true,
        sent_at: "2026-05-13T08:00:00Z",
        read_at: "2026-05-13T09:00:00Z",
        status: "sent",
        related_entity_type: "goal",
        related_entity_id: "g1",
      },
    ];
  });

  it("renders bell icon", () => {
    renderWithProviders(<NotificationCenter />);
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });

  it("shows unread badge with count", () => {
    renderWithProviders(<NotificationCenter />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("hides badge when count is 0", () => {
    mockUnreadCount = 0;
    renderWithProviders(<NotificationCenter />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("opens popover on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationCenter />);

    await user.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText("Budget Warning")).toBeInTheDocument();
  });

  it("shows notification list", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationCenter />);

    await user.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText("Budget Warning")).toBeInTheDocument();
    expect(screen.getByText("Goal Milestone")).toBeInTheDocument();
    expect(
      screen.getByText("Groceries budget is at 85%")
    ).toBeInTheDocument();
  });

  it("shows empty state when no notifications", async () => {
    mockItems = [];
    const user = userEvent.setup();
    renderWithProviders(<NotificationCenter />);

    await user.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("marks notification as read on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationCenter />);

    await user.click(screen.getByLabelText("Notifications"));
    await user.click(screen.getByText("Budget Warning"));

    expect(mockMarkRead).toHaveBeenCalledWith("n1");
  });
});
