import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/test-utils";
import { AccountLinkFlow } from "../AccountLinkFlow";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue("test-token"),
  }),
}));

vi.mock("@/hooks/usePlaid", () => ({
  useExchangeToken: () => ({
    mutate: vi.fn((_data, options) => {
      options?.onSuccess?.();
    }),
    isPending: false,
  }),
}));

describe("AccountLinkFlow", () => {
  it("renders institution selection", () => {
    renderWithProviders(<AccountLinkFlow open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Select your bank")).toBeInTheDocument();
    expect(screen.getByText("Mock Bank")).toBeInTheDocument();
    expect(screen.getByText("Mock Credit Union")).toBeInTheDocument();
    expect(screen.getByText("Mock Investment Firm")).toBeInTheDocument();
  });

  it("progresses through steps", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountLinkFlow open={true} onClose={vi.fn()} />);

    await user.click(screen.getByText("Mock Bank"));
    expect(screen.getByText("Connecting...")).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByText("Connected!")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("closes on cancel", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AccountLinkFlow open={true} onClose={onClose} />);

    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
