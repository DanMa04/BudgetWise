from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatProgress(BaseModel):
    asked: int
    estimated_total: int


class ProposedGoal(BaseModel):
    name: str
    goal_type: Literal[
        "savings", "debt_payoff", "emergency_fund", "custom"
    ] = "savings"
    # Nullable so Claude can omit a number when uncertain; filtered out at
    # apply time if missing or non-positive.
    target_amount: float | None = None
    target_date: date | None = None
    planned_monthly_contribution: float | None = None
    color: str | None = None

    @field_validator("target_amount")
    @classmethod
    def _non_negative_target(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("target_amount must be non-negative")
        return v

    @field_validator("planned_monthly_contribution")
    @classmethod
    def _positive_contribution(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("planned_monthly_contribution must be non-negative")
        return v


class ProposedBudgetAllocation(BaseModel):
    category_name: str
    amount: float
    is_locked: bool = False

    @field_validator("amount")
    @classmethod
    def _positive_amount(cls, v: float) -> float:
        if v < 0:
            raise ValueError(
                "Budget allocations must be positive — Kallio stores expenses "
                "as positive budgeted amounts."
            )
        return v


class ProposedGoalContribution(BaseModel):
    goal_name: str
    monthly_amount: float

    @field_validator("monthly_amount")
    @classmethod
    def _positive_monthly(cls, v: float) -> float:
        if v < 0:
            raise ValueError("monthly_amount must be positive")
        return v


class ProposedBudget(BaseModel):
    monthly_income: float
    period_type: str = "monthly"
    allocations: list[ProposedBudgetAllocation] = Field(default_factory=list)
    goal_contributions: list[ProposedGoalContribution] = Field(default_factory=list)


class AiProposal(BaseModel):
    monthly_income: float | None = None
    categorization: dict[str, Any] = Field(default_factory=dict)
    goals: list[ProposedGoal] = Field(default_factory=list)
    budget: ProposedBudget | None = None


class ChatRequestContext(BaseModel):
    include_transactions: bool = True


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: ChatRequestContext = Field(default_factory=ChatRequestContext)


class ChatResponse(BaseModel):
    phase: Literal["questioning", "proposing"]
    message: str
    progress: ChatProgress | None = None
    proposal: AiProposal | None = None


class ApplyAiProposalRequest(BaseModel):
    proposal: AiProposal


class ApplyAiProposalResponse(BaseModel):
    categories_created: int
    goals_created: int
    budget_allocations_saved: int
    transactions_categorized: int
    snapshot_id: str | None = None
