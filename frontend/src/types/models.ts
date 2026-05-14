export interface Account {
  id: string;
  user_id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  currency_code: string;
  current_balance: number;
  is_active: boolean;
  plaid_item_id: string | null;
  plaid_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaidItem {
  id: string;
  institution_id: string;
  institution_name: string;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

export interface LinkTokenResponse {
  link_token: string;
}

export interface SyncResponse {
  added: number;
  modified: number;
  removed: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  date: string;
  amount: number;
  description: string;
  notes: string | null;
  is_pending: boolean;
  is_recurring: boolean;
  source: string;
  category_confidence: number | null;
  category_source: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  amount: number;
  period_type: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  rollover: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetWithSpend extends Budget {
  spent_amount: number;
  remaining_amount: number;
  percentage_used: number;
}

export interface BudgetSummary {
  total_budgeted: number;
  total_spent: number;
  total_remaining: number;
  budgets: BudgetWithSpend[];
}

export interface Category {
  id: string;
  user_id: string | null;
  parent_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  is_income: boolean;
  sort_order: number;
  created_at: string;
}

export interface TransactionFilters {
  page?: number;
  per_page?: number;
  date_from?: string;
  date_to?: string;
  category_id?: string;
  account_id?: string;
  min_amount?: number;
  max_amount?: number;
  search?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

export interface CreateTransactionData {
  account_id: string;
  category_id?: string;
  date: string;
  amount: number;
  description: string;
  notes?: string;
}

export interface CreateBudgetData {
  category_id: string;
  name: string;
  amount: number;
  period_type?: string;
  start_date: string;
  end_date?: string;
  rollover?: boolean;
}

export interface CreateAccountData {
  name: string;
  account_type: string;
  institution_name?: string;
  currency_code?: string;
  current_balance?: number;
}

export interface CreateCategoryData {
  name: string;
  parent_id?: string;
  icon?: string;
  color?: string;
  is_income?: boolean;
  sort_order?: number;
}

// Import types

export interface ImportJob {
  id: string;
  user_id: string;
  account_id: string;
  filename: string;
  file_type: string;
  status: string;
  column_mapping: Record<string, string> | null;
  total_rows: number | null;
  imported_rows: number;
  skipped_rows: number;
  error_rows: number;
  errors: Array<{ row: number; error: string }> | null;
  created_at: string;
  completed_at: string | null;
}

export interface AutoDetectResponse {
  job_id: string;
  headers: string[];
  suggested_mapping: Record<string, string>;
  sample_rows: Record<string, string>[];
  total_rows: number;
}

export interface ImportPreviewRow {
  date: string;
  amount: number;
  description: string;
  category: string | null;
  notes: string | null;
  warnings: string[];
  is_duplicate: boolean;
}

export interface ImportPreviewResponse {
  rows: ImportPreviewRow[];
  total_rows: number;
  warnings: string[];
}

export interface ColumnMappingRequest {
  mapping: Record<string, string>;
}

export interface SpendingByCategory {
  category_id: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  total_amount: number;
  transaction_count: number;
  percentage: number;
}

export interface SpendingTrend {
  period: string;
  total_amount: number;
  transaction_count: number;
}

export interface BudgetVsActual {
  budget_id: string;
  category_name: string;
  category_color: string;
  budgeted_amount: number;
  actual_amount: number;
  difference: number;
  percentage_used: number;
}

export interface MonthlyComparison {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface IncomeVsExpense {
  period: string;
  income: number;
  expenses: number;
  savings_rate: number;
}

export interface TopMerchant {
  description: string;
  total_amount: number;
  transaction_count: number;
}

export interface CategorizationRule {
  id: string;
  user_id: string;
  category_id: string;
  rule_type: string;
  pattern: string;
  priority: number;
  is_active: boolean;
  created_by: string;
  match_count: number;
  created_at: string;
}

export interface CategorizationResponse {
  category_id: string | null;
  confidence: number;
  source: string;
}

export interface CreateRuleData {
  category_id: string;
  rule_type: string;
  pattern: string;
  priority?: number;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  goal_type: string;
  target_amount: number;
  current_amount: number;
  currency_code: string;
  icon: string | null;
  color: string | null;
  target_date: string | null;
  linked_account_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoalWithProgress extends Goal {
  percentage: number;
  remaining_amount: number;
  monthly_rate: number;
  projected_completion: string | null;
  milestones_reached: number[];
  contribution_count: number;
  recent_contributions: GoalContribution[];
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  amount: number;
  note: string | null;
  transaction_id: string | null;
  contributed_at: string;
  created_at: string;
}

export interface GoalSummary {
  total_goals: number;
  active_goals: number;
  total_target: number;
  total_saved: number;
  overall_progress: number;
}

export interface CreateGoalData {
  name: string;
  goal_type: string;
  target_amount: number;
  current_amount?: number;
  icon?: string;
  color?: string;
  target_date?: string;
  linked_account_id?: string;
}

export interface CreateContributionData {
  amount: number;
  note?: string;
  contributed_at?: string;
}

// Notification types

export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: string;
  channel: string;
  enabled: boolean;
  threshold: number | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  user_id: string;
  notification_type: string;
  channel: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  sent_at: string;
  read_at: string | null;
  status: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
}

export interface NotificationLogList {
  items: NotificationLog[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateNotificationPreference {
  notification_type: string;
  channel: string;
  enabled: boolean;
  threshold?: number | null;
}

export interface UpdateNotificationPreference {
  enabled?: boolean;
  threshold?: number | null;
}
