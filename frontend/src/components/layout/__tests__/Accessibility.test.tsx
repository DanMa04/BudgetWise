import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { AppShell } from "../AppShell";
import { Sidebar } from "../Sidebar";

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ data: null }),
  useUnreadCount: () => ({ data: { count: 0 } }),
  useMarkRead: () => ({ mutate: vi.fn() }),
  useMarkAllRead: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ user: { fullName: "Test" } }),
  useAuth: () => ({ getToken: vi.fn() }),
  useClerk: () => ({ signOut: vi.fn() }),
  UserButton: () => null,
}));

describe("Accessibility", () => {
  describe("AppShell", () => {
    it("renders a skip-to-content link", () => {
      renderWithProviders(<AppShell />);
      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute("href", "#main-content");
    });

    it("renders main content area with role=main", () => {
      renderWithProviders(<AppShell />);
      const main = screen.getByRole("main");
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute("id", "main-content");
    });
  });

  describe("Sidebar", () => {
    it("renders navigation with role=navigation", () => {
      renderWithProviders(<Sidebar />);
      const nav = screen.getByRole("navigation");
      expect(nav).toBeInTheDocument();
    });

    it("renders navigation with aria-label", () => {
      renderWithProviders(<Sidebar />);
      const nav = screen.getByRole("navigation");
      expect(nav).toHaveAttribute("aria-label", "Main navigation");
    });
  });
});
