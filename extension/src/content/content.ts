import { detectCheckoutPage } from "./detector";
import { parseCartTotal } from "./parser";
import { createOverlay, removeOverlay } from "./overlay";
import type { CartCheckResponse, ExtensionMessage } from "../shared/types";

let isProcessing = false;
let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function checkAndShowOverlay(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const detection = detectCheckoutPage(window.location.href, document);

    if (!detection.isCheckout || !detection.site) {
      isProcessing = false;
      return;
    }

    // Check if this site is enabled
    const settings = await sendMessage<{
      enabledSites: Record<string, boolean>;
    }>({
      type: "GET_SETTINGS",
    });

    if (settings && !settings.enabledSites[detection.site]) {
      isProcessing = false;
      return;
    }

    const parseResult = parseCartTotal(detection.site, document);

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
    }
  } catch (error) {
    console.error("[BudgetWise] Error checking cart:", error);
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
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    checkAndShowOverlay();
  }, 1000);
}

function setupMutationObserver(): void {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    // Only re-check if meaningful DOM changes happened
    const hasRelevantChanges = mutations.some((mutation) => {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        return true;
      }
      if (
        mutation.type === "characterData" ||
        mutation.type === "attributes"
      ) {
        return true;
      }
      return false;
    });

    if (hasRelevantChanges) {
      // Remove overlay before re-checking to avoid duplicates
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

// Listen for messages from background
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === "CHECKOUT_DETECTED") {
      checkAndShowOverlay();
      sendResponse({ ok: true });
    }
    return false;
  }
);

// Initial check
function init(): void {
  const detection = detectCheckoutPage(window.location.href);
  if (detection.isCheckout) {
    // Wait for DOM to settle
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
