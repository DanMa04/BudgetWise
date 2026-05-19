from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel


class SpendingByCategory(BaseModel):
    category_id: uuid.UUID | None
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
    category_name: str
    category_color: str
    budgeted_amount: float
    actual_amount: float
    difference: float
    percentage_used: float


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
    category_name: str
    category_color: str
    amount: float


class SpendingByCategoryOverTime(BaseModel):
    period: str
    categories: list[CategoryPeriodAmount]
    total: float


class ReportDateRange(BaseModel):
    start_date: date
    end_date: date
