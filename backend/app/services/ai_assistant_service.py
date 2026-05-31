"""Conversational onboarding assistant.

Stateless turn handling: the frontend re-sends the full message history each
call. The service uses Anthropic Claude to either ask another question
(`phase="questioning"`) or emit a full proposal (`phase="proposing"`).

The proposal references categories and goals by NAME (never id) because at
proposal time the user has not yet approved anything. The apply step resolves
names → ids after creating the entities.
"""

import json
import logging
import uuid
from collections import Counter
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.config import settings
from app.models.categorization_rule import CategorizationRule
from app.models.category import Category
from app.models.goal import Goal
from app.models.transaction import Transaction
from app.schemas.ai_assistant import (
    AiProposal,
    ApplyAiProposalResponse,
    ChatProgress,
    ChatRequest,
    ChatResponse,
)
from app.schemas.budget import BulkBudgetItem, BulkBudgetSave, GoalContributionItem
from app.schemas.goal import GoalCreate
from app.services import (
    ai_categorization_service,
    budget_service,
    categorization_service,
    goal_service,
)
from app.services.snapshot_service import create_snapshot

MAX_QUESTIONS = 8

SYSTEM_PROMPT = f"""\
You are Kallio's onboarding assistant. Your job is to analyze the user's
imported financial data and then propose a complete starter setup: transaction
categorizations, savings/debt goals, and a zero-based monthly budget.

# Conversation rules
- The first user turn includes three context blocks:
  1. "Financial Summary" — pre-computed monthly income/expense, top categories,
     top merchants, and three buckets of merchant patterns:
       • "Confirmed recurring (flagged by subscription rules)" — authoritative.
         Treat these as fixed monthly bills.
       • "Likely recurring (consistent amounts, ±10% spread)" — strong signal.
         Treat as fixed unless context suggests otherwise.
       • "Variable spend (same merchant, varying amounts)" — NOT recurring.
         Same merchant can serve both subscriptions AND one-off purchases
         (e.g. Amazon Prime = subscription, regular Amazon = variable).
  2. "Categorization Rules" — the user's active rule set. Subscription rules
     are the source of truth for what's recurring. User-created rules show
     explicit user intent (respect them — do not propose categories that
     conflict).
  3. Raw transactions list — each marked [recurring] if confirmed.
- **Your first turn MUST**:
  1. Briefly acknowledge what you observed (e.g. "I see ~$X/mo in income,
     ~$Y/mo in expenses, ~$Z/mo in confirmed subscriptions").
  2. State the assumptions you'll make based on the data, distinguishing
     fixed/recurring charges from variable spending.
  3. Ask ONE targeted clarifying question about something you can't infer.
- DO NOT ask about facts already visible in the data (income amount, top
  expenses, recurring subscriptions). Use the data — don't re-elicit it.
- Subsequent turns: ask only about things the data can't tell you — savings
  goals and target amounts, target dates, debt payoff intentions, risk
  tolerance, whether to allocate more to discretionary vs savings.
- One focused question per turn. Be concise and conversational.
- You may ask at most {MAX_QUESTIONS} questions total before proposing.
- If the user gives you enough, propose immediately — don't pad with questions.
- In the proposal, mark `is_fixed: true` on categories that contain
  confirmed-recurring or likely-recurring charges; leave `is_fixed: false`
  for variable categories.

# Output format
Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.

While still gathering info:
{{
  "phase": "questioning",
  "message": "<the next question for the user>",
  "progress": {{ "asked": <number of questions asked so far INCLUDING this one>, "estimated_total": <your best estimate, max {MAX_QUESTIONS}> }}
}}

When you have enough to propose:
{{
  "phase": "proposing",
  "message": "<short summary the user will see above the proposal>",
  "proposal": {{
    "monthly_income": <number>,
    "categorization": {{
      "proposed_categories": [
        {{ "name": "<category>", "existing_id": <uuid-string-or-null>, "color": "#RRGGBB", "is_income": false, "is_fixed": false, "children": [], "merged_from": [] }}
      ],
      "assignments": [
        {{ "transaction_id": "<uuid>", "category_name": "<name from proposed_categories>" }}
      ],
      "summary": "<one-sentence summary>"
    }},
    "goals": [
      {{ "name": "<goal name>", "goal_type": "savings|debt_payoff|emergency_fund|custom", "target_amount": <number>, "target_date": "YYYY-MM-DD or null", "planned_monthly_contribution": <number or null>, "color": "#RRGGBB" }}
    ],
    "budget": {{
      "monthly_income": <number>,
      "period_type": "monthly",
      "allocations": [
        {{ "category_name": "<must match a proposed_categories name>", "amount": <positive number>, "is_locked": false }}
      ],
      "goal_contributions": [
        {{ "goal_name": "<must match a goals.name>", "monthly_amount": <positive number> }}
      ]
    }}
  }}
}}

# Critical constraints
- ALL `amount` and `monthly_amount` values MUST be positive numbers. Never negative.
- Every goal MUST have a positive `target_amount` (a real dollar number, never null).
  If the user hasn't given you a target, either ask one more question to get
  it, or omit the goal from the proposal entirely. Never emit a goal with
  `target_amount: null`.
- Budget allocations + goal contributions should sum to `monthly_income` (zero-based).
- Every transaction in the sample provided must appear in `assignments`.
- Each `assignments[*].category_name` must exactly match one `proposed_categories[*].name`.
- Each `goal_contributions[*].goal_name` must exactly match one `goals[*].name`.
- Each `allocations[*].category_name` must exactly match one `proposed_categories[*].name`.
- Use existing category IDs (provided to you) when a proposed category corresponds to an existing one — set `existing_id` to that uuid.
"""


def _summarize_rules(
    rules: list[CategorizationRule],
    categories: list[Category],
) -> str:
    """Brief summary of the user's active categorization rules.

    Includes counts by source and explicit list of subscription rules so the
    AI knows what's already flagged as recurring without having to guess.
    """
    if not rules:
        return (
            "# Categorization Rules\n"
            "(No active rules — every transaction is uncategorized until rules or AI categorize them.)"
        )

    cat_by_id = {c.id: c for c in categories}
    by_source: Counter[str] = Counter(r.created_by for r in rules)
    subscription_rules = [r for r in rules if r.created_by == "subscription"]
    user_rules = [r for r in rules if r.created_by == "user"]

    lines = ["# Categorization Rules"]
    lines.append(
        f"- Total active: {len(rules)} ("
        + ", ".join(f"{n} {src}" for src, n in by_source.most_common())
        + ")"
    )

    if subscription_rules:
        lines.append("")
        lines.append("## Subscription rules (auto-detected recurring charges)")
        for r in subscription_rules[:20]:
            cat = cat_by_id.get(r.category_id)
            cat_name = cat.name if cat else "?"
            lines.append(f"- pattern={r.pattern!r} → {cat_name} (rule_type={r.rule_type})")
        if len(subscription_rules) > 20:
            lines.append(f"- (+{len(subscription_rules) - 20} more)")

    if user_rules:
        lines.append("")
        lines.append("## User-created rules (explicit user intent)")
        for r in user_rules[:15]:
            cat = cat_by_id.get(r.category_id)
            cat_name = cat.name if cat else "?"
            lines.append(f"- pattern={r.pattern!r} → {cat_name}")
        if len(user_rules) > 15:
            lines.append(f"- (+{len(user_rules) - 15} more)")

    return "\n".join(lines)


def _compute_financial_summary(
    transactions: list[Transaction],
    categories: list[Category],
) -> str:
    """Pre-digest the user's transactions so Claude doesn't have to do math."""
    if not transactions:
        return (
            "# Financial Summary\n"
            "(No transactions yet — ask the user about income and expenses from scratch.)"
        )

    dates = [t.date for t in transactions if isinstance(t.date, date)]
    if not dates:
        date_range_days = 30
        start_d: date | None = None
        end_d: date | None = None
    else:
        start_d = min(dates)
        end_d = max(dates)
        date_range_days = max((end_d - start_d).days, 1)
    months = max(date_range_days / 30.4, 0.5)

    total_income = sum(float(t.amount) for t in transactions if float(t.amount) > 0)
    total_expense = -sum(float(t.amount) for t in transactions if float(t.amount) < 0)
    monthly_income = total_income / months
    monthly_expense = total_expense / months
    net_monthly = monthly_income - monthly_expense

    cat_by_id = {c.id: c for c in categories}
    spend_by_cat: Counter[str] = Counter()
    for t in transactions:
        if float(t.amount) >= 0:
            continue
        cat = cat_by_id.get(t.category_id) if t.category_id else None
        name = cat.name if cat else "Uncategorized"
        spend_by_cat[name] += -float(t.amount)
    top_categories = spend_by_cat.most_common(8)

    merchant_counts: Counter[str] = Counter()
    merchant_totals: dict[str, float] = {}
    merchant_amounts: dict[str, list[float]] = {}
    for t in transactions:
        if float(t.amount) >= 0:
            continue
        key = (t.description or "").strip().lower()[:40]
        if not key:
            continue
        amt = -float(t.amount)
        merchant_counts[key] += 1
        merchant_totals[key] = merchant_totals.get(key, 0.0) + amt
        merchant_amounts.setdefault(key, []).append(amt)

    # Authoritative recurring: Transaction.is_recurring is set by the
    # subscription_service when a transaction matches a subscription rule.
    recurring_authoritative: dict[str, dict[str, Any]] = {}
    for t in transactions:
        if not t.is_recurring or float(t.amount) >= 0:
            continue
        key = (t.description or "").strip().lower()[:40]
        if not key:
            continue
        entry = recurring_authoritative.setdefault(
            key, {"count": 0, "total": 0.0, "amounts": []}
        )
        entry["count"] += 1
        entry["total"] += -float(t.amount)
        entry["amounts"].append(-float(t.amount))

    # Heuristic recurring: same merchant, 2+ occurrences, amounts within ±10%.
    # Skip merchants already in the authoritative list.
    recurring_heuristic = []
    for k, count in merchant_counts.items():
        if k in recurring_authoritative or count < 2:
            continue
        amts = merchant_amounts[k]
        avg = sum(amts) / len(amts)
        if avg == 0:
            continue
        spread = (max(amts) - min(amts)) / avg
        if spread <= 0.10:
            recurring_heuristic.append((k, count, avg))
    recurring_heuristic.sort(key=lambda x: x[2] * x[1], reverse=True)

    # Variable: same merchant, 2+ occurrences, but amounts vary >10%.
    variable_merchants = []
    for k, count in merchant_counts.items():
        if k in recurring_authoritative or count < 2:
            continue
        amts = merchant_amounts[k]
        avg = sum(amts) / len(amts)
        if avg == 0:
            continue
        spread = (max(amts) - min(amts)) / avg
        if spread > 0.10:
            variable_merchants.append((k, count, avg, min(amts), max(amts)))
    variable_merchants.sort(key=lambda x: x[2] * x[1], reverse=True)

    top_merchants = sorted(
        merchant_totals.items(), key=lambda x: x[1], reverse=True
    )[:8]

    categorized = sum(1 for t in transactions if t.category_id is not None)
    uncategorized = len(transactions) - categorized

    lines = ["# Financial Summary"]
    if start_d and end_d:
        lines.append(
            f"- Transaction window: {start_d.isoformat()} to {end_d.isoformat()} "
            f"({date_range_days} days, ~{months:.1f} months)"
        )
    lines.append(f"- Transactions in sample: {len(transactions)} (categorized: {categorized}, uncategorized: {uncategorized})")
    lines.append(f"- Approx monthly income: ${monthly_income:,.0f}")
    lines.append(f"- Approx monthly expenses: ${monthly_expense:,.0f}")
    lines.append(f"- Approx monthly net: ${net_monthly:,.0f}")

    if top_categories:
        lines.append("")
        lines.append("## Top spending categories (monthly average)")
        for name, total in top_categories:
            lines.append(f"- {name}: ${total / months:,.0f}/mo (${total:,.0f} over period)")

    if top_merchants:
        lines.append("")
        lines.append("## Top merchants by spend (period total)")
        for desc, total in top_merchants:
            lines.append(f"- {desc}: ${total:,.0f}")

    if recurring_authoritative:
        lines.append("")
        lines.append("## Confirmed recurring (flagged by subscription rules)")
        for desc, info in sorted(
            recurring_authoritative.items(),
            key=lambda x: x[1]["total"],
            reverse=True,
        )[:12]:
            avg = info["total"] / info["count"]
            lines.append(f"- {desc}: {info['count']}x, avg ${avg:,.2f}")

    if recurring_heuristic:
        lines.append("")
        lines.append("## Likely recurring (consistent amounts, ±10% spread)")
        for desc, count, avg in recurring_heuristic[:8]:
            lines.append(f"- {desc}: {count}x, avg ${avg:,.2f}")

    if variable_merchants:
        lines.append("")
        lines.append("## Variable spend (same merchant, varying amounts)")
        for desc, count, avg, lo, hi in variable_merchants[:8]:
            lines.append(
                f"- {desc}: {count}x, range ${lo:,.2f}–${hi:,.2f} (avg ${avg:,.2f})"
            )

    return "\n".join(lines)


def _build_context_prompt(
    categories: list[Category],
    transactions: list[Transaction],
    rules: list[CategorizationRule],
) -> str:
    summary = _compute_financial_summary(transactions, categories)
    rules_block = _summarize_rules(rules, categories)

    cat_lines = []
    for c in categories:
        tags = []
        if c.is_income:
            tags.append("income")
        if c.is_fixed:
            tags.append("fixed")
        if c.is_system:
            tags.append("system")
        tag_str = f" [{', '.join(tags)}]" if tags else ""
        cat_lines.append(f"- {c.name} (id: {c.id}){tag_str}")
    categories_text = "\n".join(cat_lines) if cat_lines else "(none yet)"

    txn_lines = []
    for t in transactions:
        recurring_flag = " [recurring]" if t.is_recurring else ""
        txn_lines.append(
            f"{t.id} | {t.description} | ${float(t.amount):+.2f}{recurring_flag}"
        )
    transactions_text = "\n".join(txn_lines) if txn_lines else "(none yet)"

    return (
        f"{summary}\n\n"
        f"{rules_block}\n\n"
        "# Existing categories\n"
        f"{categories_text}\n\n"
        "# Raw transactions (id | description | signed amount; negative = expense; [recurring] = confirmed via subscription rule)\n"
        f"{transactions_text}"
    )


async def chat_turn(
    db: AsyncSession,
    user_id: uuid.UUID,
    request: ChatRequest,
) -> ChatResponse:
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=400,
            detail="AI assistant is not configured. ANTHROPIC_API_KEY is missing.",
        )

    # On the very first turn, pre-apply the user's existing rules so the
    # financial summary is grouped by category rather than dumped into
    # "Uncategorized". This is deterministic — no AI categorization, no new
    # rules created. The assistant can still propose changes later.
    pre_categorized = 0
    if not request.messages:
        pre_categorized = await categorization_service.apply_rules_to_uncategorized(
            db, user_id
        )
        if pre_categorized:
            logger.info(
                "[ai_assistant] pre-categorized %s transactions via existing rules",
                pre_categorized,
            )

    categories = (
        await db.execute(
            select(Category)
            .where(Category.user_id == user_id)
            .order_by(Category.is_income, Category.name)
        )
    ).scalars().all()

    transactions: list[Transaction] = []
    if request.context.include_transactions:
        transactions = (
            await db.execute(
                select(Transaction)
                .where(Transaction.user_id == user_id)
                .order_by(Transaction.date.desc())
                .limit(100)
            )
        ).scalars().all()

    rules = (
        await db.execute(
            select(CategorizationRule)
            .where(
                CategorizationRule.user_id == user_id,
                CategorizationRule.is_active.is_(True),
            )
            .order_by(CategorizationRule.priority.desc(), CategorizationRule.created_at.desc())
        )
    ).scalars().all()

    context_block = _build_context_prompt(categories, transactions, rules)

    # Convert message history into Anthropic format. First user turn is
    # prefixed with the context block so the model has it from message 1.
    messages: list[dict[str, Any]] = []
    for i, m in enumerate(request.messages):
        content = m.content
        if i == 0 and m.role == "user":
            content = f"{context_block}\n\n---\n\nUser: {content}"
        messages.append({"role": m.role, "content": content})

    if not messages:
        # First call — synthesise a leading user turn so Claude opens with q1.
        messages = [
            {
                "role": "user",
                "content": f"{context_block}\n\n---\n\nUser: Help me set up my budget.",
            }
        ]

    # Smaller token budget for the questioning phase keeps latency low; the
    # proposing phase needs more room for the categorization payload.
    is_proposing = len(request.messages) >= 4
    max_tokens = 16384 if is_proposing else 2048

    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=max_tokens,
        system=SYSTEM_PROMPT,
        messages=messages,
    )

    raw_text = response.content[0].text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    if response.stop_reason == "max_tokens":
        logger.warning(
            "[ai_assistant] Response truncated. max_tokens=%s, out=%s tokens",
            max_tokens,
            response.usage.output_tokens,
        )
        raise HTTPException(
            status_code=502,
            detail="AI response was truncated. Please try again.",
        )

    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error(
            "[ai_assistant] Invalid JSON from model. First 500 chars:\n%s",
            raw_text[:500],
        )
        raise HTTPException(
            status_code=502,
            detail=f"AI returned invalid JSON: {e}",
        )

    phase = payload.get("phase")
    if phase not in ("questioning", "proposing"):
        logger.error("[ai_assistant] Unknown phase '%s'. Payload: %s", phase, payload)
        raise HTTPException(
            status_code=502,
            detail=f"AI returned unknown phase: {phase!r}",
        )

    message = payload.get("message") or ""
    if not message.strip():
        logger.warning("[ai_assistant] Model returned empty message. Payload: %s", payload)

    progress_data = payload.get("progress")
    progress = ChatProgress(**progress_data) if progress_data else None

    proposal_data = payload.get("proposal")
    proposal = AiProposal(**proposal_data) if proposal_data else None

    if phase == "proposing" and proposal is None:
        logger.error(
            "[ai_assistant] phase=proposing but no proposal in payload: %s", payload
        )
        raise HTTPException(
            status_code=502,
            detail="AI marked proposal phase but returned no proposal. Try again.",
        )

    logger.info(
        "[ai_assistant] turn ok: phase=%s in=%s out=%s",
        phase,
        response.usage.input_tokens,
        response.usage.output_tokens,
    )
    return ChatResponse(
        phase=phase,
        message=message,
        progress=progress,
        proposal=proposal,
    )


async def apply_proposal(
    db: AsyncSession,
    user_id: uuid.UUID,
    proposal: AiProposal,
) -> ApplyAiProposalResponse:
    # 1. Snapshot first so the user can roll back categories/transactions.
    snapshot = await create_snapshot(
        db, user_id, "Auto-save before AI onboarding", "pre_ai"
    )
    snapshot_id = str(snapshot.id) if snapshot else None

    # 2. Categories + transaction assignments (uses existing service).
    cat_result = {"categories_created": 0, "transactions_updated": 0}
    if proposal.categorization:
        cat_result = await ai_categorization_service.apply_proposal(
            db, user_id, proposal.categorization
        )

    # Build name → category_id map by re-querying.
    cats = (
        await db.execute(
            select(Category).where(Category.user_id == user_id)
        )
    ).scalars().all()
    cat_by_name: dict[str, uuid.UUID] = {c.name.lower(): c.id for c in cats}

    # 3. Goals — drop any with missing or non-positive target_amount.
    goals_created = 0
    goal_by_name: dict[str, uuid.UUID] = {}
    valid_goals = [g for g in proposal.goals if g.target_amount and g.target_amount > 0]
    skipped = len(proposal.goals) - len(valid_goals)
    if skipped:
        logger.warning(
            "[ai_assistant] skipping %s goal(s) with no target_amount", skipped
        )
    for g in valid_goals:
        # Skip duplicates if a goal with that name already exists for the user.
        existing = await db.scalar(
            select(Goal).where(
                Goal.user_id == user_id,
                func.lower(Goal.name) == g.name.lower(),
            )
        )
        if existing:
            goal_by_name[g.name.lower()] = existing.id
            continue

        new_goal = await goal_service.create_goal(
            db,
            user_id,
            GoalCreate(
                name=g.name,
                goal_type=g.goal_type,
                target_amount=Decimal(str(g.target_amount)),
                target_date=g.target_date,
                color=g.color,
            ),
        )
        if g.planned_monthly_contribution is not None:
            new_goal.planned_monthly_contribution = Decimal(
                str(g.planned_monthly_contribution)
            )
        await db.flush()
        goal_by_name[g.name.lower()] = new_goal.id
        goals_created += 1

    # 4. Budget (zero-based) — resolve names → ids, then call existing service.
    allocations_saved = 0
    if proposal.budget:
        items: list[BulkBudgetItem] = []
        for a in proposal.budget.allocations:
            cat_id = cat_by_name.get(a.category_name.lower())
            if not cat_id:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Could not resolve category '{a.category_name}' from the "
                        "proposal — it does not match any existing or proposed "
                        "category. Try again."
                    ),
                )
            items.append(
                BulkBudgetItem(
                    category_id=cat_id,
                    amount=a.amount,
                    is_locked=a.is_locked,
                )
            )

        contributions: list[GoalContributionItem] = []
        for gc in proposal.budget.goal_contributions:
            goal_id = goal_by_name.get(gc.goal_name.lower())
            if not goal_id:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Could not resolve goal '{gc.goal_name}' from the "
                        "proposal. Try again."
                    ),
                )
            contributions.append(
                GoalContributionItem(
                    goal_id=goal_id, monthly_amount=gc.monthly_amount
                )
            )

        await budget_service.save_bulk_allocation(
            db,
            user_id,
            BulkBudgetSave(
                monthly_income=proposal.budget.monthly_income,
                period_type=proposal.budget.period_type,
                allocations=items,
                goal_contributions=contributions,
            ),
        )
        allocations_saved = len(items)

    return ApplyAiProposalResponse(
        categories_created=cat_result.get("categories_created", 0),
        goals_created=goals_created,
        budget_allocations_saved=allocations_saved,
        transactions_categorized=cat_result.get("transactions_updated", 0),
        snapshot_id=snapshot_id,
    )


