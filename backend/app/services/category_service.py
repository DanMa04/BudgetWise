import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category

DEFAULT_CATEGORIES = [
    {"name": "Housing", "icon": "home", "color": "#4F46E5", "sort_order": 1},
    {"name": "Transportation", "icon": "car", "color": "#0891B2", "sort_order": 2},
    {"name": "Groceries", "icon": "shopping-cart", "color": "#16A34A", "sort_order": 3},
    {"name": "Dining Out", "icon": "utensils", "color": "#EA580C", "sort_order": 4},
    {"name": "Entertainment", "icon": "film", "color": "#9333EA", "sort_order": 5},
    {"name": "Shopping", "icon": "shopping-bag", "color": "#E11D48", "sort_order": 6},
    {"name": "Healthcare", "icon": "heart-pulse", "color": "#DC2626", "sort_order": 7},
    {"name": "Utilities", "icon": "zap", "color": "#CA8A04", "sort_order": 8},
    {"name": "Insurance", "icon": "shield", "color": "#2563EB", "sort_order": 9},
    {"name": "Education", "icon": "book-open", "color": "#7C3AED", "sort_order": 10},
    {"name": "Personal Care", "icon": "smile", "color": "#DB2777", "sort_order": 11},
    {"name": "Subscriptions", "icon": "repeat", "color": "#6366F1", "sort_order": 12},
    {"name": "Travel", "icon": "plane", "color": "#0D9488", "sort_order": 13},
    {"name": "Gifts & Donations", "icon": "gift", "color": "#F59E0B", "sort_order": 14},
    {"name": "Car Payment", "icon": "car", "color": "#3B82F6", "sort_order": 15},
    {"name": "Miscellaneous", "icon": "more-horizontal", "color": "#6B7280", "sort_order": 16},
    {
        "name": "Salary", "icon": "briefcase", "color": "#059669",
        "is_income": True, "sort_order": 17,
    },
    {
        "name": "Freelance", "icon": "laptop", "color": "#10B981",
        "is_income": True, "sort_order": 18,
    },
    {
        "name": "Investments", "icon": "trending-up", "color": "#14B8A6",
        "is_income": True, "sort_order": 19,
    },
    {
        "name": "Other Income", "icon": "plus-circle", "color": "#22C55E",
        "is_income": True, "sort_order": 20,
    },
]


async def seed_default_categories(db: AsyncSession, user_id: uuid.UUID) -> list[Category]:
    categories = []
    for cat_data in DEFAULT_CATEGORIES:
        category = Category(
            user_id=user_id,
            is_system=True,
            **cat_data,
        )
        db.add(category)
        categories.append(category)
    await db.flush()
    return categories
