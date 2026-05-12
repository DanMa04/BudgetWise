
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.user import User


async def test_list_categories(client: AsyncClient, db_session: AsyncSession, test_user: User):
    """Should return system defaults for user (seeded on first access)."""
    response = await client.get("/api/v1/categories/")
    assert response.status_code == 200
    data = response.json()
    # Should have seeded defaults (19 default categories)
    assert len(data) >= 15
    # Verify they are system categories
    assert all(cat["is_system"] for cat in data)


async def test_create_custom_category(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.post(
        "/api/v1/categories/",
        json={
            "name": "Pet Supplies",
            "icon": "paw-print",
            "color": "#8B5CF6",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Pet Supplies"
    assert data["is_system"] is False
    assert data["user_id"] == str(test_user.id)


async def test_update_custom_category(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    # Create a custom category
    create_resp = await client.post(
        "/api/v1/categories/",
        json={"name": "Custom Cat"},
    )
    cat_id = create_resp.json()["id"]

    # Update it
    response = await client.patch(
        f"/api/v1/categories/{cat_id}",
        json={"name": "Renamed Category", "color": "#FF0000"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Renamed Category"
    assert data["color"] == "#FF0000"


async def test_delete_custom_category(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    # Create a custom category
    create_resp = await client.post(
        "/api/v1/categories/",
        json={"name": "To Delete"},
    )
    cat_id = create_resp.json()["id"]

    # Delete it
    response = await client.delete(f"/api/v1/categories/{cat_id}")
    assert response.status_code == 204


async def test_cannot_delete_system_category(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    # Create a system category directly
    system_cat = Category(
        user_id=test_user.id,
        name="System Category",
        is_system=True,
    )
    db_session.add(system_cat)
    await db_session.flush()
    await db_session.refresh(system_cat)

    # Try to delete it
    response = await client.delete(f"/api/v1/categories/{system_cat.id}")
    assert response.status_code == 403
