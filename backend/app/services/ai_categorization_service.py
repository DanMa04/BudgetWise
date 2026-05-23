import json
import uuid
from collections import Counter

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.category import Category
from app.models.transaction import Transaction

ANALYZE_SYSTEM_PROMPT = """\
You are a financial transaction categorization assistant. \
You analyze transaction descriptions and organize them into meaningful spending categories.

You will receive:
1. A list of existing categories with their IDs
2. A sample of transaction descriptions with amounts

Respond ONLY with valid JSON matching the schema below. No markdown, no explanation.
"""

SUBCATEGORIZE_PROMPT = """\
MODE: Maximize subcategorization

Analyze these transactions and propose a detailed category hierarchy. \
Create specific child categories under broader parent categories to give the user \
maximum visibility into their spending patterns.

For example, instead of one "Food" category, propose:
- Food (parent)
  - Groceries (child)
  - Dining Out (child)
  - Coffee Shops (child)
  - Food Delivery (child)

Guidelines:
- Only create subcategories when there are at least 3 transactions that fit
- Keep parent categories from the existing list when possible
- Propose new parent categories only if truly needed
- Every transaction must be assigned to exactly one category (child if available, parent if not)
- Preserve income categories as-is

Existing categories:
{categories}

Transactions (description | amount):
{transactions}

Respond with this JSON structure:
{{
  "proposed_categories": [
    {{
      "name": "Category Name",
      "existing_id": "uuid-if-exists-or-null",
      "color": "#hex-color",
      "is_income": false,
      "children": [
        {{
          "name": "Subcategory Name",
          "existing_id": "uuid-if-exists-or-null",
          "color": "#hex-color"
        }}
      ]
    }}
  ],
  "assignments": [
    {{
      "transaction_id": "uuid",
      "category_name": "Exact category or subcategory name from proposed_categories"
    }}
  ],
  "summary": "Brief description of changes proposed"
}}
"""

MERGE_PROMPT = """\
MODE: Aggressive merging

Analyze these transactions and consolidate categories into the fewest groups \
that still provide meaningful spending insight. Merge similar or overlapping categories together.

For example, merge "Groceries", "Supermarket", "Food & Drink" into a single "Food & Groceries" category.

Guidelines:
- Aim for 10-15 total expense categories maximum
- Merge categories that serve similar purposes
- Keep the most descriptive name or create a new encompassing one
- Do NOT create subcategories — keep everything flat
- Every transaction must be assigned to exactly one category
- Preserve income categories as-is
- Preserve system categories as-is

Existing categories:
{categories}

Transactions (description | amount):
{transactions}

Respond with this JSON structure:
{{
  "proposed_categories": [
    {{
      "name": "Category Name",
      "existing_id": "uuid-of-primary-category-or-null",
      "color": "#hex-color",
      "is_income": false,
      "merged_from": ["list", "of", "original", "category", "names"],
      "children": []
    }}
  ],
  "assignments": [
    {{
      "transaction_id": "uuid",
      "category_name": "Exact category name from proposed_categories"
    }}
  ],
  "summary": "Brief description of changes proposed"
}}
"""

MAX_TXN_SAMPLE = 200


async def analyze_categories(
    db: AsyncSession,
    user_id: uuid.UUID,
    mode: str,
) -> dict:
    if not settings.anthropic_api_key:
        raise ValueError("Anthropic API key not configured")

    categories = (
        await db.execute(select(Category).where(Category.user_id == user_id))
    ).scalars().all()

    txn_result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc())
        .limit(MAX_TXN_SAMPLE)
    )
    transactions = list(txn_result.scalars().all())

    if not transactions:
        raise ValueError("No transactions to analyze")

    cat_lines = []
    for c in categories:
        parent_note = ""
        if c.parent_id:
            parent = next((p for p in categories if p.id == c.parent_id), None)
            parent_note = f" (child of {parent.name})" if parent else ""
        income_note = " [INCOME]" if c.is_income else ""
        system_note = " [SYSTEM]" if c.is_system else ""
        cat_lines.append(
            f"- {c.name} (id: {c.id}){parent_note}{income_note}{system_note}"
        )
    categories_text = "\n".join(cat_lines) if cat_lines else "(no existing categories)"

    txn_lines = []
    for t in transactions:
        txn_lines.append(f"{t.id} | {t.description} | ${abs(float(t.amount)):.2f}")
    transactions_text = "\n".join(txn_lines)

    prompt_template = SUBCATEGORIZE_PROMPT if mode == "subcategorize" else MERGE_PROMPT
    user_prompt = prompt_template.format(
        categories=categories_text,
        transactions=transactions_text,
    )

    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=16384,
        system=ANALYZE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw_text = response.content[0].text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    if response.stop_reason == "max_tokens":
        raise ValueError(
            "AI response was too long and got truncated. "
            "Try again — the model will adjust."
        )

    proposal = json.loads(raw_text)

    # Build stats for the preview
    existing_cat_names = {c.name.lower() for c in categories}
    proposed = proposal.get("proposed_categories", [])
    new_parents = []
    new_children = []
    kept = []
    merged_away = set()

    for p in proposed:
        if p.get("existing_id"):
            kept.append(p["name"])
        else:
            new_parents.append(p["name"])
        for child in p.get("children", []):
            if child.get("existing_id"):
                kept.append(child["name"])
            else:
                new_children.append(child["name"])
        for m in p.get("merged_from", []):
            if m.lower() != p["name"].lower():
                merged_away.add(m)

    assigned_count = len(proposal.get("assignments", []))

    proposal["stats"] = {
        "new_parent_categories": len(new_parents),
        "new_subcategories": len(new_children),
        "categories_kept": len(kept),
        "categories_merged_away": len(merged_away),
        "transactions_assigned": assigned_count,
        "total_transactions": len(transactions),
    }

    return proposal


async def apply_proposal(
    db: AsyncSession,
    user_id: uuid.UUID,
    proposal: dict,
) -> dict:
    proposed_cats = proposal.get("proposed_categories", [])
    assignments = proposal.get("assignments", [])

    # Build name -> new category id mapping
    name_to_id: dict[str, uuid.UUID] = {}
    existing_ids: dict[str, uuid.UUID] = {}

    # Map existing category IDs
    categories = (
        await db.execute(select(Category).where(Category.user_id == user_id))
    ).scalars().all()
    cat_by_id = {str(c.id): c for c in categories}
    cat_by_name = {c.name.lower(): c for c in categories}

    # First pass: clear all parent_id to avoid FK issues
    for c in categories:
        c.parent_id = None
    await db.flush()

    # Track which existing categories are used
    used_existing_ids = set()

    # Create/map parent categories
    for p in proposed_cats:
        existing_id = p.get("existing_id")
        if existing_id and existing_id in cat_by_id:
            cat = cat_by_id[existing_id]
            cat.name = p["name"]
            if p.get("color"):
                cat.color = p["color"]
            cat.is_income = p.get("is_income", False)
            name_to_id[p["name"].lower()] = cat.id
            used_existing_ids.add(existing_id)
        else:
            existing = cat_by_name.get(p["name"].lower())
            if existing:
                if p.get("color"):
                    existing.color = p["color"]
                name_to_id[p["name"].lower()] = existing.id
                used_existing_ids.add(str(existing.id))
            else:
                new_cat = Category(
                    user_id=user_id,
                    name=p["name"],
                    color=p.get("color"),
                    is_income=p.get("is_income", False),
                )
                db.add(new_cat)
                await db.flush()
                name_to_id[p["name"].lower()] = new_cat.id

    # Create/map child categories
    for p in proposed_cats:
        parent_id = name_to_id.get(p["name"].lower())
        for child in p.get("children", []):
            existing_id = child.get("existing_id")
            if existing_id and existing_id in cat_by_id:
                cat = cat_by_id[existing_id]
                cat.name = child["name"]
                cat.parent_id = parent_id
                if child.get("color"):
                    cat.color = child["color"]
                name_to_id[child["name"].lower()] = cat.id
                used_existing_ids.add(existing_id)
            else:
                existing = cat_by_name.get(child["name"].lower())
                if existing:
                    existing.parent_id = parent_id
                    if child.get("color"):
                        existing.color = child["color"]
                    name_to_id[child["name"].lower()] = existing.id
                    used_existing_ids.add(str(existing.id))
                else:
                    new_child = Category(
                        user_id=user_id,
                        name=child["name"],
                        color=child.get("color"),
                        parent_id=parent_id,
                    )
                    db.add(new_child)
                    await db.flush()
                    name_to_id[child["name"].lower()] = new_child.id
    await db.flush()

    # Apply transaction assignments
    txn_ids = [a["transaction_id"] for a in assignments]
    txn_result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.id.in_([uuid.UUID(tid) for tid in txn_ids]),
        )
    )
    txn_map = {str(t.id): t for t in txn_result.scalars().all()}

    txns_updated = 0
    for a in assignments:
        txn = txn_map.get(a["transaction_id"])
        cat_id = name_to_id.get(a["category_name"].lower())
        if txn and cat_id:
            txn.category_id = cat_id
            txn.category_source = "ai"
            txns_updated += 1
    await db.flush()

    # Build merge mapping: old category name -> target category id
    # So transactions on deleted categories get reassigned, not orphaned
    merge_target_map: dict[str, uuid.UUID] = {}
    for p in proposed_cats:
        target_id = name_to_id.get(p["name"].lower())
        if target_id:
            for merged_name in p.get("merged_from", []):
                merge_target_map[merged_name.lower()] = target_id

    # Delete categories not in the proposal, reassigning their transactions
    from sqlalchemy import update as sa_update
    used_cat_ids = set(name_to_id.values())
    categories_deleted = 0
    for c in categories:
        if c.id not in used_cat_ids:
            target_id = merge_target_map.get(c.name.lower())
            if target_id:
                await db.execute(
                    sa_update(Transaction)
                    .where(Transaction.category_id == c.id)
                    .values(category_id=target_id, category_source="ai")
                )
            else:
                await db.execute(
                    sa_update(Transaction)
                    .where(Transaction.category_id == c.id)
                    .values(category_id=None, category_source=None)
                )
            await db.delete(c)
            categories_deleted += 1
    await db.flush()

    return {
        "categories_created": len([n for n in name_to_id if n not in {c.name.lower() for c in categories}]),
        "categories_updated": len(used_existing_ids),
        "categories_deleted": categories_deleted,
        "transactions_updated": txns_updated,
    }
