import uuid
from datetime import date

from pydantic import BaseModel


class AmortizationRow(BaseModel):
    month: int
    payment: float
    principal: float
    interest: float
    remaining_balance: float
    cumulative_interest: float


class DebtProjectionRequest(BaseModel):
    extra_payment: float = 0


class DebtProjectionResponse(BaseModel):
    account_id: uuid.UUID
    account_name: str
    balance: float
    rate: float
    min_payment: float
    extra_payment: float
    schedule_min_only: list[AmortizationRow]
    schedule_with_extra: list[AmortizationRow]
    months_saved: int
    interest_saved: float
    payoff_date_min: date | None
    payoff_date_extra: date | None


class MultiDebtStrategyRequest(BaseModel):
    total_monthly_budget: float | None = None


class DebtTimeline(BaseModel):
    month: int
    debts: dict[str, float]
    total_balance: float
    total_interest_paid: float


class StrategyResult(BaseModel):
    strategy: str
    timeline: list[DebtTimeline]
    total_months: int
    total_interest: float
    payoff_order: list[str]


class MultiDebtStrategyResponse(BaseModel):
    avalanche: StrategyResult
    snowball: StrategyResult
    months_difference: int
    interest_difference: float


class InvestmentProjectionRequest(BaseModel):
    monthly_contribution: float | None = None


class InvestmentRow(BaseModel):
    month: int
    contributions_total: float
    growth_total: float
    balance: float


class InvestmentProjectionResponse(BaseModel):
    account_id: uuid.UUID
    account_name: str
    current_balance: float
    monthly_contribution: float
    annual_return_rate: float
    return_rate_label: str
    projection: list[InvestmentRow]
    balance_5y: float
    balance_10y: float
    balance_20y: float
    balance_30y: float
