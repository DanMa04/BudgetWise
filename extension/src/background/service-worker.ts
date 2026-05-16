import {
  getSettings,
  saveSettings,
  fetchBudgetStatus,
  checkCart,
} from "../shared/api";
import type {
  ExtensionMessage,
  CartCheckRequest,
  ExtensionSettings,
} from "../shared/types";

const BUDGET_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const CHECKOUT_PATTERNS = [
  /amazon\.com\/(gp\/buy|checkout|gp\/cart|cart)/i,
  /target\.com\/(checkout|cart)/i,
  /walmart\.com\/(checkout|cart)/i,
];

function isCheckoutUrl(url: string): boolean {
  return CHECKOUT_PATTERNS.some((pattern) => pattern.test(url));
}

// --- Tab monitoring ---

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  if (isCheckoutUrl(tab.url)) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "CHECKOUT_DETECTED" });
    } catch {
      // Content script not yet loaded, ignore
    }
  }
});

// --- Message handling ---

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((error: Error) =>
        sendResponse({ error: error.message })
      );
    return true; // Keep the message channel open for async response
  }
);

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "GET_BUDGET_STATUS":
      return handleGetBudgetStatus();

    case "CHECK_CART":
      return handleCheckCart(message.payload as CartCheckRequest);

    case "GET_SETTINGS":
      return getSettings();

    case "UPDATE_SETTINGS":
      return saveSettings(message.payload as Partial<ExtensionSettings>);

    case "SET_AUTH_TOKEN":
      return saveSettings({
        authToken: (message.payload as { token: string }).token,
      });

    case "GET_AUTH_STATUS": {
      const settings = await getSettings();
      return {
        isAuthenticated: !!settings.authToken,
        apiUrl: settings.apiUrl,
      };
    }

    default:
      return { error: "Unknown message type" };
  }
}

async function handleGetBudgetStatus() {
  const settings = await getSettings();

  if (!settings.authToken) {
    return { error: "Not authenticated" };
  }

  const now = Date.now();
  const isStale = now - settings.lastBudgetFetch > BUDGET_CACHE_TTL;

  if (settings.cachedBudgetData && !isStale) {
    return settings.cachedBudgetData;
  }

  try {
    const data = await fetchBudgetStatus(settings.apiUrl, settings.authToken);
    await saveSettings({
      cachedBudgetData: data,
      lastBudgetFetch: now,
    });
    return data;
  } catch (error) {
    // Return cached data if available, even if stale
    if (settings.cachedBudgetData) {
      return settings.cachedBudgetData;
    }
    throw error;
  }
}

async function handleCheckCart(request: CartCheckRequest) {
  const settings = await getSettings();

  if (!settings.authToken) {
    return { error: "Not authenticated" };
  }

  return checkCart(settings.apiUrl, settings.authToken, request);
}
