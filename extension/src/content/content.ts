import { detectCheckoutPage } from "./detector";
import { parseCartTotal } from "./parser";
import { createOverlay, removeOverlay, createBanner, removeBanner } from "./overlay";
import type { CartCheckResponse, ExtensionMessage } from "../shared/types";

let isProcessing = false;
let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastCheckedTotal: number | null = null;
let retryTimers: ReturnType<typeof setTimeout>[] = [];
let consecutiveNullParses = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const OUR_IDS = new Set(["kallio-overlay-host", "kallio-budget-banner"]);
// Retry schedule for slow-hydrating carts (Best Buy, some React/Next.js stores).
const RETRY_DELAYS_MS = [2000, 5000, 10000];
// Stop observing after this many fruitless parses (cart total just never showed).
const MAX_NULL_PARSES = 10;
// After a successful parse, keep watching for cart updates for this long, then stop.
const POST_SUCCESS_OBSERVE_WINDOW_MS = 60_000;
const DEBOUNCE_MS = 3000;

function clearRetries(): void {
  retryTimers.forEach(clearTimeout);
  retryTimers = [];
}

function scheduleRetries(): void {
  clearRetries();
  retryTimers = RETRY_DELAYS_MS.map((delay) =>
    setTimeout(() => {
      if (lastCheckedTotal === null) {
        console.log(`[Kallio] Retry parse after ${delay}ms (cart may have hydrated)`);
        checkAndShowOverlay();
      }
    }, delay)
  );
}

function stopObserving(reason: string): void {
  if (observer) {
    console.log("[Kallio] Stopping observer —", reason);
    observer.disconnect();
    observer = null;
  }
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function armIdleShutoff(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(
    () => stopObserving("idle window elapsed after success"),
    POST_SUCCESS_OBSERVE_WINDOW_MS
  );
}

async function checkAndShowOverlay(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const detection = detectCheckoutPage(window.location.href);
    if (!detection.isCheckout) {
      console.log("[Kallio] URL not recognised as checkout:", window.location.href);
      return;
    }

    const parseResult = parseCartTotal(document);
    console.log("[Kallio] Parse result:", parseResult);
    if (parseResult.total === null || parseResult.total <= 0) {
      console.log("[Kallio] Could not extract cart total — no overlay shown");
      consecutiveNullParses++;
      if (consecutiveNullParses >= MAX_NULL_PARSES && lastCheckedTotal === null) {
        stopObserving(`${MAX_NULL_PARSES} null parses, giving up`);
        clearRetries();
      }
      return;
    }
    consecutiveNullParses = 0;

    if (parseResult.total === lastCheckedTotal) {
      console.log("[Kallio] Total unchanged, skipping re-check");
      return;
    }

    console.log("[Kallio] Calling backend cart-check with total:", parseResult.total);
    const response = await sendMessage<CartCheckResponse>({
      type: "CHECK_CART",
      payload: {
        cart_total: parseResult.total,
        merchant: parseResult.merchant,
        site: parseResult.site,
      },
    });

    console.log("[Kallio] Backend response:", JSON.stringify(response));
    if (response && !("error" in response)) {
      lastCheckedTotal = parseResult.total;
      clearRetries();
      armIdleShutoff();
      console.log("[Kallio] Showing overlay — level:", response.warning_level);
      createOverlay(response);
      if (response.warning_level === "red") {
        createBanner(response);
      } else {
        removeBanner();
      }
    } else {
      console.log("[Kallio] Skipping overlay — response has error or is null");
    }
  } catch (error) {
    console.error("[Kallio] Error checking cart:", error);
  } finally {
    isProcessing = false;
  }
}

function sendMessage<T>(message: ExtensionMessage): Promise<T> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      resolve(response);
    });
  });
}

function debouncedCheck(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => checkAndShowOverlay(), DEBOUNCE_MS);
}

function setupMutationObserver(): void {
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    const hasRelevantChanges = mutations.some((m) => {
      if (m.type === "childList") {
        // Ignore our own overlay/banner being added or removed
        for (const node of [...m.addedNodes, ...m.removedNodes]) {
          if (node instanceof Element && OUR_IDS.has(node.id)) return false;
        }
        return m.addedNodes.length > 0;
      }
      return m.type === "characterData";
    });

    if (hasRelevantChanges) {
      // Don't touch the overlay — just re-check if the total changed
      debouncedCheck();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function init(): void {
  const detection = detectCheckoutPage(window.location.href);
  if (detection.isCheckout) {
    setTimeout(() => {
      checkAndShowOverlay();
      setupMutationObserver();
      scheduleRetries();
    }, 800);
  }
}

// Handle re-check requests from the service worker (SPA navigation to a cart URL
// when the content script is already running in this tab).
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "RECHECK") {
    lastCheckedTotal = null;
    consecutiveNullParses = 0;
    if (!observer) setupMutationObserver();
    debouncedCheck();
  }
});

// Guard against double-injection (service worker restarts, SPA re-triggers, etc.)
const w = window as unknown as Record<string, unknown>;
if (w.__kallioRunning) {
  lastCheckedTotal = null;
  debouncedCheck();
} else {
  w.__kallioRunning = true;
  lastCheckedTotal = null;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
