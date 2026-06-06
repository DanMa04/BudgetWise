import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category

DEFAULT_CATEGORIES = [
    {"name": "Housing", "icon": "home", "color": "#4F46E5", "sort_order": 1, "is_fixed": True},
    {"name": "Transportation", "icon": "car", "color": "#0891B2", "sort_order": 2},
    {"name": "Groceries", "icon": "shopping-cart", "color": "#16A34A", "sort_order": 3},
    {"name": "Dining Out", "icon": "utensils", "color": "#EA580C", "sort_order": 4},
    {"name": "Entertainment", "icon": "film", "color": "#9333EA", "sort_order": 5},
    {"name": "Shopping", "icon": "shopping-bag", "color": "#E11D48", "sort_order": 6},
    {"name": "Healthcare", "icon": "heart-pulse", "color": "#DC2626", "sort_order": 7},
    {"name": "Utilities", "icon": "zap", "color": "#CA8A04", "sort_order": 8, "is_fixed": True},
    {"name": "Insurance", "icon": "shield", "color": "#2563EB", "sort_order": 9, "is_fixed": True},
    {"name": "Education", "icon": "book-open", "color": "#7C3AED", "sort_order": 10},
    {"name": "Personal Care", "icon": "smile", "color": "#DB2777", "sort_order": 11},
    {"name": "Subscriptions", "icon": "repeat", "color": "#6366F1", "sort_order": 12,
     "is_fixed": True},
    {"name": "Travel", "icon": "plane", "color": "#0D9488", "sort_order": 13},
    {"name": "Gifts & Donations", "icon": "gift", "color": "#F59E0B", "sort_order": 14},
    {"name": "Car Payment", "icon": "car", "color": "#3B82F6", "sort_order": 15,
     "is_fixed": True},
    {"name": "Investment Contribution", "icon": "trending-up", "color": "#0F766E",
     "sort_order": 16},
    {"name": "Miscellaneous", "icon": "more-horizontal", "color": "#6B7280", "sort_order": 17},
    {
        "name": "Salary", "icon": "briefcase", "color": "#059669",
        "is_income": True, "sort_order": 18,
    },
    {
        "name": "Freelance", "icon": "laptop", "color": "#10B981",
        "is_income": True, "sort_order": 19,
    },
    {
        "name": "Investments", "icon": "trending-up", "color": "#14B8A6",
        "is_income": True, "sort_order": 20,
    },
    {
        "name": "Other Income", "icon": "plus-circle", "color": "#22C55E",
        "is_income": True, "sort_order": 21,
    },
]

P2P_CATEGORIES = [
    {"name": "Venmo", "icon": "smartphone", "color": "#008CFF", "sort_order": 30},
    {"name": "Zelle", "icon": "smartphone", "color": "#6D1ED4", "sort_order": 31},
    {"name": "Cash App", "icon": "smartphone", "color": "#00D632", "sort_order": 32},
    {"name": "PayPal", "icon": "smartphone", "color": "#003087", "sort_order": 33},
    {"name": "Apple Cash", "icon": "smartphone", "color": "#000000", "sort_order": 34},
]


async def seed_default_categories(db: AsyncSession, user_id: uuid.UUID) -> list[Category]:
    categories = []
    for cat_data in DEFAULT_CATEGORIES + P2P_CATEGORIES:
        category = Category(
            user_id=user_id,
            is_system=True,
            **cat_data,
        )
        db.add(category)
        categories.append(category)
    await db.flush()
    return categories


# Curated palette of visually distinct colors used for auto-assignment
# when a category is created without an explicit color (e.g., AI proposals
# that omit `color`, or budget allocations the AI invents on the fly).
# Order roughly cycles around the color wheel to maximize neighbor contrast.
COLOR_PALETTE = [
    "#4F46E5", "#16A34A", "#EA580C", "#0891B2", "#9333EA",
    "#E11D48", "#CA8A04", "#2563EB", "#7C3AED", "#DB2777",
    "#6366F1", "#0D9488", "#F59E0B", "#3B82F6", "#0F766E",
    "#059669", "#10B981", "#14B8A6", "#22C55E", "#A855F7",
    "#F97316", "#06B6D4", "#84CC16", "#EC4899", "#8B5CF6",
    "#EF4444", "#65A30D", "#0EA5E9", "#D946EF", "#F43F5E",
]


def pick_distinct_color(used_colors: set[str]) -> str:
    """Return a palette color not currently in use; fall back to a
    deterministic HSL-spread color if the palette is exhausted."""
    normalized = {c.lower() for c in used_colors if c}
    for color in COLOR_PALETTE:
        if color.lower() not in normalized:
            return color
    # Palette exhausted — spread by golden-angle hue rotation.
    import colorsys

    hue = (len(normalized) * 137.508) % 360 / 360.0
    r, g, b = colorsys.hls_to_rgb(hue, 0.5, 0.65)
    return f"#{int(r * 255):02X}{int(g * 255):02X}{int(b * 255):02X}"


async def fetch_used_colors(db: AsyncSession, user_id: uuid.UUID) -> set[str]:
    """Return the set of colors currently assigned to the user's active
    categories — used to avoid picking a color already in use."""
    result = await db.execute(
        select(Category.color).where(
            Category.user_id == user_id,
            Category.color.isnot(None),
        )
    )
    return {c for (c,) in result.all() if c}


async def backfill_missing_colors(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Assign palette colors to any of the user's categories that currently
    have NULL color or share a color with another category. Returns the
    number of categories updated."""
    result = await db.execute(
        select(Category).where(Category.user_id == user_id)
    )
    cats = list(result.scalars().all())

    used_colors: set[str] = set()
    color_counts: dict[str, int] = {}
    for c in cats:
        if c.color:
            color_counts[c.color] = color_counts.get(c.color, 0) + 1

    updated = 0
    for c in cats:
        needs_fix = not c.color or (c.color and color_counts.get(c.color, 0) > 1)
        if not needs_fix:
            used_colors.add(c.color)
            continue
        if c.color:
            # We're reassigning a duplicate — release the old color so
            # only one occurrence keeps it.
            color_counts[c.color] -= 1
        new_color = pick_distinct_color(used_colors)
        c.color = new_color
        used_colors.add(new_color)
        updated += 1
    if updated:
        await db.flush()
    return updated


async def ensure_p2p_categories(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Seed P2P categories for existing users who don't have them yet."""
    result = await db.execute(
        select(Category.name).where(Category.user_id == user_id)
    )
    existing_names = {name.lower() for name in result.scalars().all()}

    added = False
    for cat_data in P2P_CATEGORIES:
        if cat_data["name"].lower() not in existing_names:
            db.add(Category(user_id=user_id, is_system=True, **cat_data))
            added = True

    if added:
        await db.flush()
