export interface Account {
  id: string;
  user_id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  currency_code: string;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
