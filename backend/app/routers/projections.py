import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.account import Account
from app.models.goal import Goal
from app.models.user import User
from app.schemas.projection import (
    DebtProjectionRequest,
    DebtProjectionResponse,
    InvestmentProjectionRequest,
    InvestmentProjectionResponse,
    MultiDebtStrategyRequest,
    MultiDebtStrategyResponse,
)
from app.services.projection_service import (
    DebtInfo,
    compute_debt_comparison,
    compute_investment_projection,
    compute_multi_debt_strategy,
    resolve_return_rate,
)

router = APIRouter(prefix="/projections", tags=["projections"])

PRESET_LABELS = {
    "sp500": "S&P 500 avg (10%)",
    "bond": "Bond fund (4%)",
    "conservative": "Conservative (6%)",
    "aggressive": "Aggressive (12%)",
    "custom": "Custom",
}


@router.post("/debt/strategy", response_model=MultiDebtStrategyResponse)
async def get_multi_debt_strategy(
    body: MultiDebtStrategyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Account).where(
            Account.user_id == current_user.id,
            Account.account_type.in_(["loan", "credit"]),
            Account.is_active.is_(True),
        )
    )
    accounts = list(result.scalars().all())

    debt_accounts = [
        a for a in accounts
        if a.current_balance and float(a.current_balance) > 0
        and a.minimum_payment and float(a.minimum_payment) > 0
        and a.interest_rate is not None
    ]

    if len(debt_accounts) < 2:
        raise HTTPException(
            status_code=400,
            detail="Need at least 2 active debt accounts with balances for strategy comparison",
        )

    debts = [
        DebtInfo(
            account_id=str(a.id),
            name=a.name,
            balance=float(a.current_balance),
            annual_rate_pct=float(a.interest_rate),
            min_payment=float(a.minimum_payment),
        )
        for a in debt_accounts
    ]

    total_min = sum(d.min_payment for d in debts)

    if body.total_monthly_budget is not None:
        budget = body.total_monthly_budget
    else:
        goals_result = await db.execute(
            select(Goal).where(
                Goal.user_id == current_user.id,
                Goal.is_active.is_(True),
                Goal.goal_type == "debt_payoff",
                Goal.linked_account_id.in_([a.id for a in debt_accounts]),
            )
        )
        goals = list(goals_result.scalars().all())
        min_by_account = {str(a.id): float(a.minimum_payment) for a in debt_accounts}
        extra_from_goals = sum(
            max(0, float(g.planned_monthly_contribution)
                - min_by_account.get(str(g.linked_account_id), 0))
            for g in goals
            if g.planned_monthly_contribution
        )
        budget = total_min + extra_from_goals

    if budget < total_min:
        budget = total_min

    strategy = compute_multi_debt_strategy(debts, budget)

    def to_timeline_dicts(result):
        return [
            {
                "month": t["month"],
                "debts": t["debts"],
                "total_balance": t["total_balance"],
                "total_interest_paid": t["total_interest_paid"],
            }
            for t in result.timeline
        ]

    return MultiDebtStrategyResponse(
        avalanche={
            "strategy": strategy.avalanche.strategy,
            "timeline": to_timeline_dicts(strategy.avalanche),
            "total_months": strategy.avalanche.total_months,
            "total_interest": strategy.avalanche.total_interest,
            "payoff_order": strategy.avalanche.payoff_order,
        },
        snowball={
            "strategy": strategy.snowball.strategy,
            "timeline": to_timeline_dicts(strategy.snowball),
            "total_months": strategy.snowball.total_months,
            "total_interest": strategy.snowball.total_interest,
            "payoff_order": strategy.snowball.payoff_order,
        },
        months_difference=strategy.months_difference,
        interest_difference=strategy.interest_difference,
    )


@router.post("/debt/{account_id}", response_model=DebtProjectionResponse)
async def get_debt_projection(
    account_id: uuid.UUID,
    body: DebtProjectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = (
        await db.execute(
            select(Account).where(
                Account.id == account_id,
                Account.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if account.account_type not in ("loan", "credit"):
        raise HTTPException(status_code=400, detail="Account is not a debt account")

    balance = float(account.current_balance)
    rate = float(account.interest_rate) if account.interest_rate else 0.0
    min_pay = float(account.minimum_payment) if account.minimum_payment else 0.0

    if balance <= 0 or min_pay <= 0:
        raise HTTPException(
            status_code=400,
            detail="Account needs balance and minimum payment for projections",
        )

    comparison = compute_debt_comparison(balance, rate, min_pay, body.extra_payment)

    return DebtProjectionResponse(
        account_id=account.id,
        account_name=account.name,
        balance=balance,
        rate=rate,
        min_payment=min_pay,
        extra_payment=body.extra_payment,
        schedule_min_only=[row.__dict__ for row in comparison.schedule_min_only],
        schedule_with_extra=[row.__dict__ for row in comparison.schedule_with_extra],
        months_saved=comparison.months_saved,
        interest_saved=comparison.interest_saved,
        payoff_date_min=comparison.payoff_date_min,
        payoff_date_extra=comparison.payoff_date_extra,
    )


@router.post("/investment/{account_id}", response_model=InvestmentProjectionResponse)
async def get_investment_projection(
    account_id: uuid.UUID,
    body: InvestmentProjectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = (
        await db.execute(
            select(Account).where(
                Account.id == account_id,
                Account.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if account.account_type != "investment":
        raise HTTPException(status_code=400, detail="Account is not an investment account")

    annual_rate = resolve_return_rate(account.return_rate_preset, account.custom_return_rate)
    balance = float(account.current_balance) if account.current_balance else 0.0

    if body.monthly_contribution is not None:
        contribution = body.monthly_contribution
    else:
        goal = (
            await db.execute(
                select(Goal).where(
                    Goal.user_id == current_user.id,
                    Goal.linked_account_id == account_id,
                    Goal.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        contribution = (
            float(goal.planned_monthly_contribution)
            if goal and goal.planned_monthly_contribution
            else 0.0
        )

    rows = compute_investment_projection(balance, contribution, annual_rate, 360)

    def balance_at_year(y: int) -> float:
        idx = y * 12 - 1
        return rows[idx].balance if idx < len(rows) else rows[-1].balance

    label = PRESET_LABELS.get(account.return_rate_preset or "", f"Custom ({annual_rate}%)")

    return InvestmentProjectionResponse(
        account_id=account.id,
        account_name=account.name,
        current_balance=balance,
        monthly_contribution=contribution,
        annual_return_rate=annual_rate,
        return_rate_label=label,
        projection=[row.__dict__ for row in rows],
        balance_5y=balance_at_year(5),
        balance_10y=balance_at_year(10),
        balance_20y=balance_at_year(20),
        balance_30y=balance_at_year(30),
    )
