from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

StepKey = Literal[
    "accounts_linked",
    "transactions_imported",
    "transactions_categorized",
    "goals_created",
    "budget_created",
]

STEP_KEYS: tuple[StepKey, ...] = (
    "accounts_linked",
    "transactions_imported",
    "transactions_categorized",
    "goals_created",
    "budget_created",
)


class StepStatus(BaseModel):
    done: bool = False
    completed_at: datetime | None = None
    # Optional per-step extras (count, method, etc.)
    model_config = {"extra": "allow"}


class OnboardingDerived(BaseModel):
    account_count: int
    transaction_count: int
    uncategorized_count: int
    goal_count: int
    active_budget_count: int
    next_step: StepKey | None
    percent_complete: int


class OnboardingState(BaseModel):
    version: int = 1
    started_at: datetime | None = None
    completed_at: datetime | None = None
    dismissed_at: datetime | None = None
    last_step: str | None = None
    path: Literal["manual", "ai"] | None = None
    steps: dict[StepKey, StepStatus] = Field(default_factory=dict)
    ai_assist_used: bool = False
    wizard_dismissed: bool = False
    plan: Literal["basic", "pro"] = "basic"
    derived: OnboardingDerived | None = None

    model_config = {"from_attributes": True, "extra": "allow"}


class OnboardingPatch(BaseModel):
    """Partial update — server merges into existing state.

    Top-level keys are shallow-merged; `steps.*` is deep-merged.
    """

    last_step: str | None = None
    path: Literal["manual", "ai"] | None = None
    ai_assist_used: bool | None = None
    steps: dict[StepKey, dict[str, Any]] | None = None
