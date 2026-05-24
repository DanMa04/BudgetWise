from dataclasses import dataclass
from datetime import date
from decimal import Decimal

RETURN_RATE_PRESETS: dict[str, float] = {
    "sp500": 10.0,
    "bond": 4.0,
    "conservative": 6.0,
    "aggressive": 12.0,
}


def resolve_return_rate(preset: str | None, custom_rate: Decimal | None) -> float:
    if preset == "custom" and custom_rate is not None:
        return float(custom_rate)
    if preset and preset in RETURN_RATE_PRESETS:
        return RETURN_RATE_PRESETS[preset]
    return 0.0


@dataclass
class AmortizationRow:
    month: int
    payment: float
    principal: float
    interest: float
    remaining_balance: float
    cumulative_interest: float


def compute_debt_amortization(
    balance: float,
    annual_rate_pct: float,
    min_payment: float,
    extra_payment: float = 0,
    max_months: int = 360,
) -> list[AmortizationRow]:
    if balance <= 0 or min_payment <= 0:
        return []

    monthly_rate = annual_rate_pct / 100 / 12
    remaining = balance
    cumulative_interest = 0.0
    rows: list[AmortizationRow] = []

    for month in range(1, max_months + 1):
        interest = remaining * monthly_rate
        total_payment = min_payment + extra_payment
        if total_payment > remaining + interest:
            total_payment = remaining + interest

        principal = total_payment - interest
        remaining = max(0.0, remaining - principal)
        cumulative_interest += interest

        rows.append(AmortizationRow(
            month=month,
            payment=round(total_payment, 2),
            principal=round(principal, 2),
            interest=round(interest, 2),
            remaining_balance=round(remaining, 2),
            cumulative_interest=round(cumulative_interest, 2),
        ))

        if remaining <= 0:
            break

    return rows


@dataclass
class DebtComparison:
    schedule_min_only: list[AmortizationRow]
    schedule_with_extra: list[AmortizationRow]
    months_saved: int
    interest_saved: float
    payoff_date_min: date | None
    payoff_date_extra: date | None


def compute_debt_comparison(
    balance: float,
    annual_rate_pct: float,
    min_payment: float,
    extra_payment: float,
) -> DebtComparison:
    schedule_min = compute_debt_amortization(balance, annual_rate_pct, min_payment, 0)
    schedule_extra = compute_debt_amortization(balance, annual_rate_pct, min_payment, extra_payment)

    months_min = len(schedule_min)
    months_extra = len(schedule_extra)
    interest_min = schedule_min[-1].cumulative_interest if schedule_min else 0
    interest_extra = schedule_extra[-1].cumulative_interest if schedule_extra else 0

    today = date.today()

    def add_months(d: date, m: int) -> date:
        total_months = d.year * 12 + d.month - 1 + m
        y, mo = divmod(total_months, 12)
        return d.replace(year=y, month=mo + 1, day=min(d.day, 28))

    return DebtComparison(
        schedule_min_only=schedule_min,
        schedule_with_extra=schedule_extra,
        months_saved=months_min - months_extra,
        interest_saved=round(interest_min - interest_extra, 2),
        payoff_date_min=add_months(today, months_min) if schedule_min else None,
        payoff_date_extra=add_months(today, months_extra) if schedule_extra else None,
    )


@dataclass
class DebtInfo:
    account_id: str
    name: str
    balance: float
    annual_rate_pct: float
    min_payment: float


@dataclass
class StrategyResult:
    strategy: str
    timeline: list[dict]
    total_months: int
    total_interest: float
    payoff_order: list[str]


@dataclass
class MultiDebtStrategyResult:
    avalanche: StrategyResult
    snowball: StrategyResult
    months_difference: int
    interest_difference: float


def _run_strategy(
    debts: list[DebtInfo],
    total_budget: float,
    sort_key: str,
) -> StrategyResult:
    if sort_key == "avalanche":
        ordered = sorted(debts, key=lambda d: d.annual_rate_pct, reverse=True)
    else:
        ordered = sorted(debts, key=lambda d: d.balance)

    balances = {d.account_id: d.balance for d in ordered}
    rates = {d.account_id: d.annual_rate_pct / 100 / 12 for d in ordered}
    min_payments = {d.account_id: d.min_payment for d in ordered}
    active_ids = [d.account_id for d in ordered if d.balance > 0]
    payoff_order: list[str] = []
    timeline: list[dict] = []
    total_interest = 0.0

    for month in range(1, 361):
        if not active_ids:
            break

        month_interest = 0.0
        for aid in active_ids:
            interest = balances[aid] * rates[aid]
            month_interest += interest

        required_mins = sum(min_payments[aid] for aid in active_ids)
        extra = max(0, total_budget - required_mins)

        newly_paid: list[str] = []
        for aid in active_ids:
            interest = balances[aid] * rates[aid]
            payment = min_payments[aid]
            if aid == active_ids[0]:
                payment += extra
            payment = min(payment, balances[aid] + interest)
            principal = payment - interest
            balances[aid] = max(0.0, balances[aid] - principal)

            if balances[aid] <= 0:
                newly_paid.append(aid)
                payoff_order.append(aid)

        total_interest += month_interest
        timeline.append({
            "month": month,
            "debts": {aid: round(balances[aid], 2) for aid in active_ids},
            "total_balance": round(sum(balances[aid] for aid in active_ids), 2),
            "total_interest_paid": round(total_interest, 2),
        })

        for aid in newly_paid:
            freed = min_payments[aid]
            active_ids.remove(aid)
            if active_ids:
                extra += freed

    return StrategyResult(
        strategy=sort_key,
        timeline=timeline,
        total_months=len(timeline),
        total_interest=round(total_interest, 2),
        payoff_order=payoff_order,
    )


def compute_multi_debt_strategy(
    debts: list[DebtInfo],
    total_monthly_budget: float,
) -> MultiDebtStrategyResult:
    avalanche = _run_strategy(debts, total_monthly_budget, "avalanche")
    snowball = _run_strategy(debts, total_monthly_budget, "snowball")

    return MultiDebtStrategyResult(
        avalanche=avalanche,
        snowball=snowball,
        months_difference=abs(avalanche.total_months - snowball.total_months),
        interest_difference=round(abs(avalanche.total_interest - snowball.total_interest), 2),
    )


@dataclass
class InvestmentRow:
    month: int
    contributions_total: float
    growth_total: float
    balance: float


def compute_investment_projection(
    current_balance: float,
    monthly_contribution: float,
    annual_return_pct: float,
    months: int = 360,
) -> list[InvestmentRow]:
    monthly_rate = annual_return_pct / 100 / 12
    balance = current_balance
    total_contributions = 0.0
    rows: list[InvestmentRow] = []

    for month in range(1, months + 1):
        growth = balance * monthly_rate
        balance += growth + monthly_contribution
        total_contributions += monthly_contribution

        rows.append(InvestmentRow(
            month=month,
            contributions_total=round(total_contributions, 2),
            growth_total=round(balance - current_balance - total_contributions, 2),
            balance=round(balance, 2),
        ))

    return rows
