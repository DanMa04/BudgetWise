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
