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
from datetime import date, timedelta
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
    budget_service,
    categorization_service,
    goal_service,
)
from app.services.snapshot_service import create_snapshot

MAX_QUESTIONS = 8

# Tool-use schema: forces Claude to emit a structured turn instead of prose.
# Both questioning and proposing flow through the same tool — fields not
# relevant to the current phase are simply omitted.
RESPOND_TOOL = {
    "name": "respond",
    "description": (
        "Submit your turn. Use phase='questioning' to ask a follow-up; use "
        "phase='proposing' when you have enough to produce the final "
        "starter setup."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "phase": {
                "type": "string",
                "enum": ["questioning", "proposing"],
            },
            "message": {
                "type": "string",
                "description": (
                    "Conversational text shown to the user. In questioning "
                    "phase this is the next question. In proposing phase "
                    "this is a short summary above the proposal."
                ),
            },
            "progress": {
                "type": "object",
                "properties": {
                    "asked": {"type": "integer"},
                    "estimated_total": {"type": "integer"},
                },
            },
            "proposal": {
                "type": "object",
                "description": "Only set when phase='proposing'.",
                "properties": {
                    "monthly_income": {"type": "number"},
                    "categorization": {
                        "type": "object",
                        "properties": {
                            "proposed_categories": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string"},
                                        "existing_id": {"type": ["string", "null"]},
                                        "color": {"type": ["string", "null"]},
                                        "is_income": {"type": "boolean"},
                                        "is_fixed": {"type": "boolean"},
                                        "children": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "name": {"type": "string"},
                                                    "existing_id": {"type": ["string", "null"]},
                                                    "color": {"type": ["string", "null"]},
                                                    "is_income": {"type": "boolean"},
                                                    "is_fixed": {"type": "boolean"},
                                                },
                                                "required": ["name"],
                                            },
                                        },
                                        "merged_from": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                        },
                                    },
                                    "required": ["name"],
                                },
                            },
                            "assignments": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "transaction_id": {"type": "string"},
                                        "category_name": {"type": "string"},
                                    },
                                    "required": ["transaction_id", "category_name"],
                                },
                            },
                            "summary": {"type": "string"},
                        },
                    },
                    "goals": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "goal_type": {
                                    "type": "string",
                                    "enum": [
                                        "savings",
                                        "debt_payoff",
                                        "emergency_fund",
                                        "custom",
                                    ],
                                },
                                "target_amount": {"type": "number"},
                                "target_date": {"type": ["string", "null"]},
                                "planned_monthly_contribution": {
                                    "type": ["number", "null"]
                                },
                                "color": {"type": ["string", "null"]},
                            },
                            "required": ["name", "target_amount"],
                        },
                    },
                    "budget": {
                        "type": "object",
                        "properties": {
                            "monthly_income": {"type": "number"},
                            "period_type": {"type": "string"},
                            "allocations": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "category_name": {"type": "string"},
                                        "amount": {"type": "number"},
                                        "is_locked": {"type": "boolean"},
                                    },
                                    "required": ["category_name", "amount"],
                                },
                            },
                            "goal_contributions": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "goal_name": {"type": "string"},
                                        "monthly_amount": {"type": "number"},
                                    },
                                    "required": ["goal_name", "monthly_amount"],
                                },
                            },
                        },
                    },
                },
            },
        },
        "required": ["phase", "message"],
    },
}

# How far back to sample transactions for the AI assistant's analysis.
# 4 months gives a meaningful baseline of monthly averages, lets seasonal/
# quarterly spend show up, and surfaces both recurring AND variable patterns.
TRANSACTION_SAMPLE_DAYS = 120
# Safety cap for unusually high-volume users — keeps context size sane and
# avoids overwhelming Claude's output budget with thousands of assignments.
TRANSACTION_SAMPLE_MAX = 1000

# Model selection: Haiku 4.5 for conversational turns (cheap + fast), Sonnet
# 4.6 for the final proposal turn where compound reasoning matters most
# (subcategorization, recurring-vs-one-off splits, JSON schema compliance).
MODEL_QUESTIONING = "claude-haiku-4-5-20251001"
MODEL_PROPOSING = "claude-sonnet-4-6"

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
         (e.g. Amazon Prime = subscription, regular Amazon = variable). If
         the merchant appears in BOTH the recurring AND variable lists, you
         MUST split it into TWO categories — one for the subscription, one
         for the discretionary spend.
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
  3. Ask the user whether they prefer **detailed** (subcategories, lots of
     buckets) or **simplified** (a small set of broad parent categories)
     organization. This is a required choice unless they've already said.
- DO NOT ask about facts already visible in the data (income amount, top
  expenses, recurring subscriptions). Use the data — don't re-elicit it.
- Subsequent turns: ask only about things the data can't tell you — savings
  goals and target amounts, target dates, debt payoff intentions, risk
  tolerance, whether to allocate more to discretionary vs savings.
- One focused question per turn. Be concise and conversational.
- You may ask at most {MAX_QUESTIONS} questions total before proposing.
- If the user gives you enough, propose immediately — don't pad with questions.

# Categorization rules you MUST follow
- **Fixed vs variable**: mark `is_fixed: true` for categories containing
  rent/mortgage, utilities (electric/gas/water/internet/phone), insurance,
  loan/car/debt payments, subscriptions, and any charges that appear in the
  "Confirmed recurring" or "Likely recurring" buckets. Leave `is_fixed:
  false` for discretionary buckets (groceries, dining, shopping, etc.).
- **Recurring vs one-off from same vendor**: if the same merchant appears in
  both "Confirmed recurring" and "Variable spend", split it. Example:
  Amazon → "Subscriptions" (Prime/Audible) AND "Shopping" (one-off orders).
  Use the [recurring] flag on individual transactions to decide which
  bucket each transaction goes to.
- **Subcategorization (detailed mode)**: structure categories as parent →
  children using the `children` array. Sensible parents: Housing, Food,
  Transportation, Subscriptions, Utilities, Personal Care, Shopping,
  Entertainment. Sensible children: under Food → Groceries / Dining Out /
  Coffee Shops / Food Delivery; under Transportation → Gas / Rideshare /
  Parking / Public Transit. Only create a child when at least 3 sample
  transactions fit it — otherwise keep them at the parent level.
- **Simplified mode**: keep the proposal to 6–10 top-level parents and
  empty `children` arrays. Roll specific spend into broader buckets.
- **Mergers**: if you see existing categories that should logically merge
  (e.g. "Apartment Rent" and "Rent" both exist), list the redundant ones
  in `merged_from` on the kept category. The apply step will inform the
  user; the user reviews before any merging actually happens.
- **Miscellaneous bucket**: always include a `"Miscellaneous"` category
  with `is_fixed: false`. Use it for low-frequency, unclear, or one-off
  transactions that don't fit other categories well. Don't force-fit
  outliers into unrelated parents.

# Output format
Respond ONLY with a single JSON object. Your VERY FIRST character must be
an opening brace and your LAST character must be a closing brace. No
markdown fences, no triple-backtick wrappers, no prose before or after
the JSON, no explanations. Every turn — questioning AND proposing — must
be a JSON object. If you find yourself wanting to write a conversational
reply, wrap it inside the `"message"` field of a questioning JSON object.

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
- **Categorization is ADDITIVE only.** Transactions already categorized via
  the user's rules will keep their existing category — the apply step will
  not overwrite them. So `categorization.assignments` should ONLY include
  transactions whose category is currently `Uncategorized` in the data you
  were given. Do not propose to "reorganize" already-categorized
  transactions; if you think a category is misnamed, mention it in the
  message instead. The budget allocation `category_name` values may
  reference EXISTING categories (from "Existing categories" list) — you
  don't need to list them in `proposed_categories` unless you're creating
  new ones for uncategorized transactions.
- Every uncategorized transaction in the sample MUST appear in `assignments`,
  including outliers — use `"Miscellaneous"` for those that don't fit
  anywhere else. Already-categorized transactions don't need assignments
  (they'll keep their existing category).
- Each `assignments[*].category_name` must exactly match one
  `proposed_categories[*].name` OR one of its `children[*].name`. Always
  assign to the most specific category (child if available, else parent).
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
        since = date.today() - timedelta(days=TRANSACTION_SAMPLE_DAYS)
        transactions = (
            await db.execute(
                select(Transaction)
                .where(
                    Transaction.user_id == user_id,
                    Transaction.date >= since,
                )
                .order_by(Transaction.date.desc())
                .limit(TRANSACTION_SAMPLE_MAX)
            )
        ).scalars().all()
        logger.info(
            "[ai_assistant] sampled %s transactions from the last %s days",
            len(transactions),
            TRANSACTION_SAMPLE_DAYS,
        )

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

    # Pick model + token budget based on phase. Questioning is short and
    # conversational (Haiku); proposing is the heavy-reasoning turn (Sonnet).
    is_proposing = len(request.messages) >= 4
    if is_proposing:
        model = MODEL_PROPOSING
        max_tokens = 16384
    else:
        model = MODEL_QUESTIONING
        max_tokens = 1024

    # Build the message list. The first user turn carries the context block
    # as a SEPARATE content block with cache_control so Anthropic caches it
    # across all turns in the session. The system prompt is also cached.
    first_user_text: str | None = None
    rest_messages: list[dict[str, Any]] = []
    if request.messages:
        for i, m in enumerate(request.messages):
            if i == 0 and m.role == "user":
                first_user_text = m.content
            else:
                rest_messages.append({"role": m.role, "content": m.content})
    else:
        first_user_text = "Help me set up my budget."

    first_user_blocks: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": context_block,
            "cache_control": {"type": "ephemeral"},
        },
        {
            "type": "text",
            "text": f"---\n\nUser: {first_user_text}",
        },
    ]

    messages: list[dict[str, Any]] = [
        {"role": "user", "content": first_user_blocks},
        *rest_messages,
    ]

    system_blocks = [
        {
            "type": "text",
            "text": SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"},
        }
    ]

    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    # Tool use forces structured output that matches RESPOND_TOOL's schema,
    # replacing the previous JSON-in-prose + parse approach. The API
    # guarantees the response will be a tool_use block we can read directly.
    response = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_blocks,
        messages=messages,
        tools=[RESPOND_TOOL],
        tool_choice={"type": "tool", "name": "respond"},
    )

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

    tool_block = next(
        (b for b in response.content if getattr(b, "type", None) == "tool_use"),
        None,
    )
    if tool_block is None:
        logger.error(
            "[ai_assistant] No tool_use block in response. stop_reason=%s, content=%s",
            response.stop_reason,
            response.content,
        )
        raise HTTPException(
            status_code=502,
            detail="AI did not produce a structured response. Try again.",
        )
    payload = tool_block.input or {}

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

    usage = response.usage
    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
    cache_create = getattr(usage, "cache_creation_input_tokens", 0) or 0
    logger.info(
        "[ai_assistant] turn ok: model=%s phase=%s in=%s out=%s cache_read=%s cache_create=%s",
        model,
        phase,
        usage.input_tokens,
        usage.output_tokens,
        cache_read,
        cache_create,
    )
    return ChatResponse(
        phase=phase,
        message=message,
        progress=progress,
        proposal=proposal,
    )


async def _apply_categorization_additive(
    db: AsyncSession,
    user_id: uuid.UUID,
    categorization: dict[str, Any],
) -> dict[str, int]:
    """Apply AI-proposed categorization additively.

    Only categorizes transactions that currently have no category. Existing
    categorizations (from rules or prior decisions) are preserved. New
    parent → child categories are created as needed, preserving the AI's
    proposed hierarchy and `is_fixed` / `is_income` flags. Categories not
    in the proposal are left untouched (no destructive merges).
    """
    proposed = categorization.get("proposed_categories") or []
    assignments = categorization.get("assignments") or []

    cats = (
        await db.execute(select(Category).where(Category.user_id == user_id))
    ).scalars().all()
    cat_by_name: dict[str, Category] = {c.name.lower(): c for c in cats}

    txn_ids = []
    for a in assignments:
        try:
            txn_ids.append(uuid.UUID(a["transaction_id"]))
        except (KeyError, ValueError, TypeError):
            continue

    if not txn_ids:
        return {"categories_created": 0, "transactions_updated": 0}

    txn_result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.id.in_(txn_ids),
            Transaction.category_id.is_(None),
        )
    )
    uncategorized = {str(t.id): t for t in txn_result.scalars().all()}
    if not uncategorized:
        return {"categories_created": 0, "transactions_updated": 0}

    needed_names: set[str] = set()
    for a in assignments:
        if a.get("transaction_id") not in uncategorized:
            continue
        name = a.get("category_name")
        if isinstance(name, str) and name.strip():
            needed_names.add(name.strip().lower())

    parent_lookup: dict[str, dict[str, Any]] = {}
    child_lookup: dict[str, dict[str, Any]] = {}
    child_to_parent: dict[str, str] = {}
    for p in proposed:
        if not isinstance(p, dict):
            continue
        pname = (p.get("name") or "").strip()
        if not pname:
            continue
        parent_lookup[pname.lower()] = p
        for child in p.get("children") or []:
            if not isinstance(child, dict):
                continue
            cname = (child.get("name") or "").strip()
            if not cname:
                continue
            child_lookup[cname.lower()] = child
            child_to_parent[cname.lower()] = pname.lower()

    categories_created = 0

    # 1. Create needed top-level parents (parents referenced by assignments
    # OR parents whose children are referenced).
    needed_parents: set[str] = set()
    for n in needed_names:
        if n in parent_lookup:
            needed_parents.add(n)
        elif n in child_to_parent:
            needed_parents.add(child_to_parent[n])

    for pname_lower in needed_parents:
        if pname_lower in cat_by_name:
            continue
        meta = parent_lookup.get(pname_lower, {})
        new_cat = Category(
            user_id=user_id,
            name=meta.get("name") or pname_lower.title(),
            color=meta.get("color"),
            is_income=bool(meta.get("is_income", False)),
            is_fixed=bool(meta.get("is_fixed", False)),
        )
        db.add(new_cat)
        await db.flush()
        cat_by_name[pname_lower] = new_cat
        categories_created += 1

    # 2. Create needed child categories with parent_id wired up.
    needed_children = {n for n in needed_names if n in child_lookup}
    for cname_lower in needed_children:
        if cname_lower in cat_by_name:
            continue
        child_meta = child_lookup[cname_lower]
        parent_lower = child_to_parent[cname_lower]
        parent_cat = cat_by_name.get(parent_lower)
        if not parent_cat:
            # Parent couldn't be created; fall back to top-level
            parent_id = None
            inherited_is_fixed = False
            inherited_is_income = False
        else:
            parent_id = parent_cat.id
            inherited_is_fixed = parent_cat.is_fixed
            inherited_is_income = parent_cat.is_income
        new_child = Category(
            user_id=user_id,
            name=child_meta.get("name") or cname_lower.title(),
            parent_id=parent_id,
            color=child_meta.get("color"),
            is_income=bool(child_meta.get("is_income", inherited_is_income)),
            is_fixed=bool(child_meta.get("is_fixed", inherited_is_fixed)),
        )
        db.add(new_child)
        await db.flush()
        cat_by_name[cname_lower] = new_child
        categories_created += 1

    # 3. Apply assignments to uncategorized transactions.
    txns_updated = 0
    for a in assignments:
        txn = uncategorized.get(a.get("transaction_id"))
        if not txn:
            continue
        cat_name = (a.get("category_name") or "").strip().lower()
        cat = cat_by_name.get(cat_name)
        if not cat:
            continue
        txn.category_id = cat.id
        txn.category_source = "ai"
        txn.category_confidence = 0.9
        txns_updated += 1

    await db.flush()
    return {
        "categories_created": categories_created,
        "transactions_updated": txns_updated,
    }


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

    # 2. Categorization — ADDITIVE only. Existing rule-based categorizations
    # are preserved; the AI's proposal only fills in transactions that are
    # still uncategorized. Never deletes categories or overwrites assignments.
    cat_result = {"categories_created": 0, "transactions_updated": 0}
    if proposal.categorization:
        cat_result = await _apply_categorization_additive(
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

    # 4. Budget (zero-based) — resolve names → ids, auto-creating any
    # category the AI referenced but didn't include in proposed_categories.
    # (Claude often references categories by colloquial names like "Mortgage"
    # instead of the existing "Housing" — auto-create rather than blocking.)
    allocations_saved = 0
    if proposal.budget:
        items: list[BulkBudgetItem] = []
        for a in proposal.budget.allocations:
            cat_id = cat_by_name.get(a.category_name.lower())
            if not cat_id:
                new_cat = Category(
                    user_id=user_id,
                    name=a.category_name,
                    is_income=False,
                    is_fixed=False,
                )
                db.add(new_cat)
                await db.flush()
                cat_id = new_cat.id
                cat_by_name[a.category_name.lower()] = cat_id
                logger.info(
                    "[ai_assistant] auto-created category '%s' for budget allocation",
                    a.category_name,
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
                logger.warning(
                    "[ai_assistant] skipping goal_contribution for unknown goal '%s'",
                    gc.goal_name,
                )
                continue
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


