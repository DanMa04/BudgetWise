export interface BudgetStatus {
  id: string;
  name: string;
  category_name: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage_used: number;
}

export interface BudgetCheckResponse {
  total_budgeted: number;
  total_spent: number;
  total_remaining: number;
  budgets: BudgetStatus[];
}

export interface CartCheckRequest {
  cart_total: number;
  merchant: string;
  site: string;
}

export interface CartCheckResponse {
  can_afford: boolean;
  cart_total: number;
  total_remaining: number;
  warning_level: "green" | "yellow" | "red";
  message: string;
  affected_budgets: BudgetStatus[];
}

export interface ExtensionSettings {
  apiUrl: string;
  authToken: string | null;
  notificationsEnabled: boolean;
  lastBudgetFetch: number;
  cachedBudgetData: BudgetCheckResponse | null;
}

export type MessageType =
  | "GET_BUDGET_STATUS"
  | "CHECK_CART"
  | "GET_SETTINGS"
  | "UPDATE_SETTINGS"
  | "SET_AUTH_TOKEN"
  | "GET_AUTH_STATUS"
  | "PING"
  | "RECHECK";

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface AuthStatusResponse {
  isAuthenticated: boolean;
  apiUrl: string;
}
