import { detectCheckoutPage } from "./detector";
import { parseCartTotal } from "./parser";
import { createOverlay, removeOverlay, createBanner, removeBanner } from "./overlay";
import type { CartCheckResponse, ExtensionMessage } from "../shared/types";

let isProcessing = false;
let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastCheckedTotal: number | null = null;

const OUR_IDS = new Set(["kallio-overlay-host", "kallio-budget-banner"]);

async function checkAndShowOverlay(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const detection = detectCheckoutPage(window.location.href);
    if (!detection.isCheckout) return;

    const parseResult = parseCartTotal(document);
    if (parseResult.total === null || parseResult.total <= 0) return;

    // Only re-query the backend (and replace the overlay) if the total changed
    if (parseResult.total === lastCheckedTotal) return;
    lastCheckedTotal = parseResult.total;

    const response = await sendMessage<CartCheckResponse>({
      type: "CHECK_CART",
      payload: {
        cart_total: parseResult.total,
        merchant: parseResult.merchant,
        site: parseResult.site,
      },
    });

    if (response && !("error" in response)) {
      createOverlay(response);
      if (response.warning_level === "red") {
        createBanner(response);
      } else {
        removeBanner();
      }
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
  debounceTimer = setTimeout(() => checkAndShowOverlay(), 1500);
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
    }, 1500);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
