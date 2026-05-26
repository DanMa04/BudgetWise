from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel


class SpendingByCategory(BaseModel):
    category_id: uuid.UUID | None
    parent_category_id: uuid.UUID | None = None
    parent_category_name: str | None = None
    category_name: str
    category_color: str
    category_icon: str
    total_amount: float
    transaction_count: int
    percentage: float


class SpendingTrend(BaseModel):
    period: str
    total_amount: float
    transaction_count: int


class BudgetVsActual(BaseModel):
    budget_id: uuid.UUID
    category_id: uuid.UUID | None = None
    parent_category_id: uuid.UUID | None = None
    parent_category_name: str | None = None
    category_name: str
    category_color: str
    budgeted_amount: float
    actual_amount: float
    difference: float
    percentage_used: float
    period_type: str = "monthly"


class MonthlyComparison(BaseModel):
    month: str
    income: float
    expenses: float
    net: float


class IncomeVsExpense(BaseModel):
    period: str
    income: float
    expenses: float
    savings_rate: float


class TopMerchant(BaseModel):
    description: str
    total_amount: float
    transaction_count: int


class CategoryPeriodAmount(BaseModel):
    category_id: uuid.UUID | None
    parent_category_id: uuid.UUID | None = None
    category_name: str
    category_color: str
    amount: float


class SpendingByCategoryOverTime(BaseModel):
    period: str
    categories: list[CategoryPeriodAmount]
    total: float


class CategoryVendor(BaseModel):
    description: str
    total_amount: float
    transaction_count: int
    percentage: float


class VendorPeriodAmount(BaseModel):
    vendor_name: str
    amount: float


class VendorSpendingOverTime(BaseModel):
    period: str
    vendors: list[VendorPeriodAmount]
    total: float


class ReportDateRange(BaseModel):
    start_date: date
    end_date: date


class VariableSpendDay(BaseModel):
    date: str
    actual: float
    avg_daily: float
    budget_daily: float
    cumulative_savings: float
    cumulative_budget_savings: float


class VariableSpendSummary(BaseModel):
    days: list[VariableSpendDay]
    avg_daily_baseline: float
    budget_daily_target: float
    total_variable_budget: float
    total_actual: float
    total_savings_vs_baseline: float
    total_savings_vs_budget: float
    has_baseline_data: bool
