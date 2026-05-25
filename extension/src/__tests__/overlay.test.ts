import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOverlay, removeOverlay } from "../content/overlay";
import type { CartCheckResponse } from "../shared/types";

function makeResponse(overrides: Partial<CartCheckResponse> = {}): CartCheckResponse {
  return {
    can_afford: true,
    cart_total: 50,
    total_remaining: 500,
    warning_level: "green",
    message: "You're in good shape!",
    affected_budgets: [],
    ...overrides,
  };
}

describe("overlay", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    removeOverlay();
    vi.restoreAllMocks();
  });

  it("creates overlay element in the DOM", () => {
    createOverlay(makeResponse());
    const host = document.getElementById("kallio-overlay-host");
    expect(host).not.toBeNull();
  });

  it("uses shadow DOM", () => {
    createOverlay(makeResponse());
    const host = document.getElementById("kallio-overlay-host");
    expect(host).not.toBeNull();
    expect(host?.tagName).toBe("DIV");
  });

  it("removes existing overlay before creating new one", () => {
    createOverlay(makeResponse());
    createOverlay(makeResponse({ warning_level: "red" }));
    const hosts = document.querySelectorAll("#kallio-overlay-host");
    expect(hosts.length).toBe(1);
  });

  it("removeOverlay removes the host element", () => {
    createOverlay(makeResponse());
    expect(document.getElementById("kallio-overlay-host")).not.toBeNull();
    removeOverlay();
    expect(document.getElementById("kallio-overlay-host")).toBeNull();
  });

  it("removeOverlay is safe to call when no overlay exists", () => {
    expect(() => removeOverlay()).not.toThrow();
  });

  it("auto-dismisses green warnings after timeout", () => {
    vi.useFakeTimers();
    createOverlay(makeResponse({ warning_level: "green" }));
    expect(document.getElementById("kallio-overlay-host")).not.toBeNull();

    vi.advanceTimersByTime(5300);
    expect(document.getElementById("kallio-overlay-host")).toBeNull();

    vi.useRealTimers();
  });

  it("does not auto-dismiss red warnings", () => {
    vi.useFakeTimers();
    createOverlay(makeResponse({ warning_level: "red", can_afford: false }));

    vi.advanceTimersByTime(10000);
    expect(document.getElementById("kallio-overlay-host")).not.toBeNull();

    vi.useRealTimers();
  });

  it("does not auto-dismiss yellow warnings", () => {
    vi.useFakeTimers();
    createOverlay(makeResponse({ warning_level: "yellow" }));

    vi.advanceTimersByTime(10000);
    expect(document.getElementById("kallio-overlay-host")).not.toBeNull();

    vi.useRealTimers();
  });
});
