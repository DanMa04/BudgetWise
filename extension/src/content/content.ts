import { detectCheckoutPage } from "./detector";
import { parseCartTotal } from "./parser";
import { createOverlay, removeOverlay, createBanner, removeBanner } from "./overlay";
import type { CartCheckResponse, ExtensionMessage } from "../shared/types";

let isProcessing = false;
let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function checkAndShowOverlay(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const detection = detectCheckoutPage(window.location.href);
    if (!detection.isCheckout) {
      isProcessing = false;
      return;
    }

    const parseResult = parseCartTotal(document);

    if (parseResult.total === null || parseResult.total <= 0) {
      isProcessing = false;
      return;
    }

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
  debounceTimer = setTimeout(() => checkAndShowOverlay(), 1000);
}

function setupMutationObserver(): void {
  if (observer) observer.disconnect();

  const OUR_IDS = new Set(["kallio-overlay-host", "kallio-budget-banner"]);

  observer = new MutationObserver((mutations) => {
    const hasRelevantChanges = mutations.some((m) => {
      if (m.type === "childList") {
        // Ignore mutations caused by our own elements being added/removed
        for (const node of m.addedNodes) {
          if (node instanceof Element && OUR_IDS.has(node.id)) return false;
        }
        return m.addedNodes.length > 0;
      }
      return m.type === "characterData" || m.type === "attributes";
    });
    if (hasRelevantChanges) {
      removeOverlay();
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
