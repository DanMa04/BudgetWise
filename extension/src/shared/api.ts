import type {
  ExtensionSettings,
  BudgetCheckResponse,
  CartCheckRequest,
  CartCheckResponse,
} from "./types";

const DEFAULT_API_URL = "http://localhost:8000/api/v1";

const DEFAULT_SETTINGS: ExtensionSettings = {
  apiUrl: DEFAULT_API_URL,
  authToken: null,
  notificationsEnabled: true,
  lastBudgetFetch: 0,
  cachedBudgetData: null,
};

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get("settings");
  if (result.settings) {
    return { ...DEFAULT_SETTINGS, ...result.settings };
  }
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(
  settings: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ settings: updated });
  return updated;
}

async function apiFetch<T>(
  apiUrl: string,
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchBudgetStatus(
  apiUrl: string,
  token: string
): Promise<BudgetCheckResponse> {
  return apiFetch<BudgetCheckResponse>(apiUrl, "/extension/budget-check", token);
}

export async function checkCart(
  apiUrl: string,
  token: string,
  request: CartCheckRequest
): Promise<CartCheckResponse> {
  return apiFetch<CartCheckResponse>(apiUrl, "/extension/cart-check", token, {
    method: "POST",
    body: JSON.stringify(request),
  });
}
