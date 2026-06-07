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
  interest_rate: number | null;
  original_balance: number | null;
  minimum_payment: number | null;
  loan_term_months: number | null;
  loan_start_date: string | null;
  return_rate_preset: string | null;
  custom_return_rate: number | null;
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
  income_sum?: number;
  expense_sum?: number;
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
  is_locked: boolean;
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
  is_fixed: boolean;
  sort_order: number;
  created_at: string;
}

export interface CategoryWithSpend extends Category {
  total_spend: number;
  transaction_count: number;
}

export interface MergeSuggestion {
  source: Category;
  target: Category;
  similarity_score: number;
}

export interface MergeCategoryRequest {
  source_id: string;
  target_id: string;
}

export interface MergeCategoryResponse {
  target_id: string;
  transactions_moved: number;
  rules_moved: number;
  budgets_merged: number;
}

export interface SubordinateCategoryRequest {
  source_id: string;
  parent_id: string;
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

export interface CategoryAllocation {
  category_id: string;
  parent_id: string | null;
  category_name: string;
  category_color: string | null;
  category_icon: string | null;
  current_budget_amount: number | null;
  average_monthly_spend: number;
  is_locked: boolean;
  budget_id: string | null;
}

export interface GoalAllocation {
  goal_id: string;
  name: string;
  color: string | null;
  goal_type: string | null;
  target_amount: number;
  current_amount: number;
  monthly_rate: number;
  planned_monthly_contribution: number | null;
  target_date: string | null;
  linked_account_id: string | null;
  linked_account_type: string | null;
  linked_account_rate: number | null;
  linked_account_balance: number | null;
  linked_account_minimum_payment: number | null;
}

export interface AllocationData {
  suggested_monthly_income: number;
  monthly_income_override: number | null;
  categories: CategoryAllocation[];
  goals: GoalAllocation[];
}

export interface BulkBudgetItem {
  category_id: string;
  amount: number;
  is_locked: boolean;
}

export interface GoalContributionItem {
  goal_id: string;
  monthly_amount: number;
}

export interface BulkBudgetSave {
  monthly_income: number;
  period_type: string;
  allocations: BulkBudgetItem[];
  goal_contributions: GoalContributionItem[];
}

export interface BulkBudgetResponse {
  created: number;
  updated: number;
  deactivated: number;
}

export interface CreateAccountData {
  name: string;
  account_type: string;
  institution_name?: string;
  currency_code?: string;
  current_balance?: number;
  interest_rate?: number;
  original_balance?: number;
  minimum_payment?: number;
  loan_term_months?: number;
  loan_start_date?: string;
  return_rate_preset?: string;
  custom_return_rate?: number;
}

export interface CreateCategoryData {
  name: string;
  parent_id?: string;
  icon?: string;
  color?: string;
  is_income?: boolean;
  is_fixed?: boolean;
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
  parent_category_id: string | null;
  parent_category_name: string | null;
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

export interface CategoryPeriodAmount {
  category_id: string | null;
  parent_category_id: string | null;
  category_name: string;
  category_color: string;
  amount: number;
}

export interface SpendingByCategoryOverTime {
  period: string;
  categories: CategoryPeriodAmount[];
  total: number;
}

export interface BudgetVsActual {
  budget_id: string;
  category_id: string | null;
  parent_category_id: string | null;
  parent_category_name: string | null;
  category_name: string;
  category_color: string;
  budgeted_amount: number;
  actual_amount: number;
  difference: number;
  percentage_used: number;
  period_type: string;
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

export interface CategoryVendor {
  description: string;
  total_amount: number;
  transaction_count: number;
  percentage: number;
}

export interface VendorPeriodAmount {
  vendor_name: string;
  amount: number;
}

export interface VendorSpendingOverTime {
  period: string;
  vendors: VendorPeriodAmount[];
  total: number;
}

export interface VariableSpendDay {
  date: string;
  actual: number;
  avg_daily: number;
  budget_daily: number;
  cumulative_savings: number;
  cumulative_budget_savings: number;
}

export interface VariableSpendSummary {
  days: VariableSpendDay[];
  avg_daily_baseline: number;
  budget_daily_target: number;
  total_variable_budget: number;
  total_actual: number;
  total_savings_vs_baseline: number;
  total_savings_vs_budget: number;
  has_baseline_data: boolean;
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

export interface SubscriptionSuggestion {
  merchant: string;
  amount: number;
  period: string;
  avg_interval_days: number;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  next_expected: string;
  transaction_ids: string[];
  subscription_category_id: string | null;
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
  planned_monthly_contribution: number | null;
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
  planned_monthly_contribution?: number;
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

export type TransferRuleMatchType = "contains" | "exact";

export interface TransferRule {
  id: string;
  user_id: string;
  source_category_id: string;
  target_category_id: string;
  name: string;
  amount_exact: number | null;
  amount_min: number | null;
  amount_max: number | null;
  day_of_month: number | null;
  day_tolerance: number;
  counterparty_pattern: string | null;
  counterparty_match_type: TransferRuleMatchType;
  match_all_categories: boolean;
  is_active: boolean;
  priority: number;
  match_count: number;
  created_at: string;
}

export interface CreateTransferRuleData {
  source_category_id: string;
  target_category_id: string;
  name: string;
  amount_exact?: number | null;
  amount_min?: number | null;
  amount_max?: number | null;
  day_of_month?: number | null;
  day_tolerance?: number;
  counterparty_pattern?: string | null;
  counterparty_match_type?: TransferRuleMatchType;
  match_all_categories?: boolean;
  priority?: number;
}

export interface UpdateTransferRuleData {
  target_category_id?: string;
  name?: string;
  amount_exact?: number | null;
  amount_min?: number | null;
  amount_max?: number | null;
  day_of_month?: number | null;
  day_tolerance?: number;
  counterparty_pattern?: string | null;
  counterparty_match_type?: TransferRuleMatchType;
  match_all_categories?: boolean;
  is_active?: boolean;
  priority?: number;
}

// Projection types

export interface AmortizationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remaining_balance: number;
  cumulative_interest: number;
}

export interface DebtProjectionResponse {
  account_id: string;
  account_name: string;
  balance: number;
  rate: number;
  min_payment: number;
  extra_payment: number;
  schedule_min_only: AmortizationRow[];
  schedule_with_extra: AmortizationRow[];
  months_saved: number;
  interest_saved: number;
  payoff_date_min: string | null;
  payoff_date_extra: string | null;
}

export interface DebtTimeline {
  month: number;
  debts: Record<string, number>;
  total_balance: number;
  total_interest_paid: number;
}

export interface StrategyResult {
  strategy: string;
  timeline: DebtTimeline[];
  total_months: number;
  total_interest: number;
  payoff_order: string[];
}

export interface MultiDebtStrategyResponse {
  avalanche: StrategyResult;
  snowball: StrategyResult;
  months_difference: number;
  interest_difference: number;
}

export interface InvestmentRow {
  month: number;
  contributions_total: number;
  growth_total: number;
  balance: number;
}

export interface InvestmentProjectionResponse {
  account_id: string;
  account_name: string;
  current_balance: number;
  monthly_contribution: number;
  annual_return_rate: number;
  return_rate_label: string;
  projection: InvestmentRow[];
  balance_5y: number;
  balance_10y: number;
  balance_20y: number;
  balance_30y: number;
}

// Backend user (distinct from Clerk user)

export interface BackendUser {
  id: string;
  email: string | null;
  display_name: string | null;
  currency_code: string;
  timezone: string;
  plan: "basic" | "pro";
  onboarding_state: Record<string, unknown>;
  community_rules_enabled: boolean;
  created_at: string;
}

export interface BackendUserUpdate {
  display_name?: string | null;
  currency_code?: string | null;
  timezone?: string | null;
  plan?: "basic" | "pro" | null;
  community_rules_enabled?: boolean | null;
}

// Onboarding

export type Plan = "basic" | "pro";

export type OnboardingStepKey =
  | "accounts_linked"
  | "transactions_imported"
  | "transactions_categorized"
  | "goals_created"
  | "budget_created";

export interface OnboardingStepStatus {
  done: boolean;
  completed_at: string | null;
  count?: number;
  method?: string;
  [key: string]: unknown;
}

export interface OnboardingDerived {
  account_count: number;
  transaction_count: number;
  uncategorized_count: number;
  goal_count: number;
  active_budget_count: number;
  next_step: OnboardingStepKey | null;
  percent_complete: number;
}

export interface OnboardingState {
  version: number;
  started_at: string | null;
  completed_at: string | null;
  dismissed_at: string | null;
  last_step: string | null;
  path: "manual" | "ai" | null;
  steps: Record<OnboardingStepKey, OnboardingStepStatus>;
  ai_assist_used: boolean;
  wizard_dismissed: boolean;
  plan: Plan;
  derived: OnboardingDerived | null;
}

export interface OnboardingPatch {
  last_step?: string;
  path?: "manual" | "ai";
  ai_assist_used?: boolean;
  steps?: Partial<Record<OnboardingStepKey, Partial<OnboardingStepStatus>>>;
}
