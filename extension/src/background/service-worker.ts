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
import { isCheckoutUrl } from "../content/detector";

const BUDGET_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const OVERLAY_CSS =
  "#kallio-overlay-host{all:initial;position:fixed;bottom:20px;right:20px;z-index:2147483647}" +
  "#kallio-budget-banner{position:fixed;top:0;left:0;right:0;z-index:2147483646}";

// --- Tab monitoring ---

// Full page loads (traditional navigation or hard refresh)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    await injectIfNeeded(tabId, tab.url);
  } else if (changeInfo.url) {
    setTimeout(() => injectIfNeeded(tabId, changeInfo.url!), 600);
  }
});

// SPA history navigation — pushState / replaceState (Amazon, Target, Walmart, etc.)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  injectIfNeeded(details.tabId, details.url);
});

async function injectIfNeeded(tabId: number, url: string): Promise<void> {
  if (!isCheckoutUrl(url)) {
    console.log("[Kallio SW] Not a checkout URL:", url);
    return;
  }

  const settings = await getSettings();
  if (!settings.notificationsEnabled) {
    console.log("[Kallio SW] Notifications disabled");
    return;
  }
  if (!settings.authToken) {
    console.log("[Kallio SW] No auth token — extension not connected");
    return;
  }

  console.log("[Kallio SW] Injecting into tab", tabId, url);
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["dist/content.js"] });
    await chrome.scripting.insertCSS({ target: { tabId }, css: OVERLAY_CSS });
    console.log("[Kallio SW] Injection OK");
  } catch (err) {
    console.log("[Kallio SW] Injection failed:", err);
  }
}

// --- Message handling ---

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((error: Error) => sendResponse({ error: error.message }));
    return true;
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
        authToken: (message.payload as { token: string | null }).token,
        cachedBudgetData: null,
        lastBudgetFetch: 0,
      });

    case "GET_AUTH_STATUS": {
      const settings = await getSettings();
      return {
        isAuthenticated: !!settings.authToken,
        apiUrl: settings.apiUrl,
      };
    }

    case "PING":
      return { ok: true };

    default:
      return { error: "Unknown message type" };
  }
}

async function handleGetBudgetStatus() {
  const settings = await getSettings();
  if (!settings.authToken) return { error: "Not authenticated" };

  const now = Date.now();
  const isStale = now - settings.lastBudgetFetch > BUDGET_CACHE_TTL;

  if (settings.cachedBudgetData && !isStale) {
    return settings.cachedBudgetData;
  }

  try {
    const data = await fetchBudgetStatus(settings.apiUrl, settings.authToken);
    await saveSettings({ cachedBudgetData: data, lastBudgetFetch: now });
    return data;
  } catch (error) {
    if (settings.cachedBudgetData) return settings.cachedBudgetData;
    throw error;
  }
}

async function handleCheckCart(request: CartCheckRequest) {
  const settings = await getSettings();
  if (!settings.authToken) return { error: "Not authenticated" };
  return checkCart(settings.apiUrl, settings.authToken, request);
}
