import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.models.account import Account
from app.models.goal import Goal


@pytest.fixture
async def account(client: AsyncClient, db_session, test_user) -> Account:
    account = Account(
        user_id=test_user.id,
        name="Savings",
        account_type="savings",
        current_balance=Decimal("5000"),
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    return account


@pytest.fixture
async def goal(client: AsyncClient, db_session, test_user) -> Goal:
    goal = Goal(
        user_id=test_user.id,
        name="Emergency Fund",
        goal_type="emergency_fund",
        target_amount=Decimal("10000"),
        current_amount=Decimal("2500"),
        icon="shield",
        color="#22C55E",
    )
    db_session.add(goal)
    await db_session.commit()
    await db_session.refresh(goal)
    return goal


async def test_create_goal(client: AsyncClient):
    response = await client.post(
        "/api/v1/goals/",
        json={
            "name": "Vacation Fund",
            "goal_type": "savings",
            "target_amount": 5000,
            "icon": "plane",
            "color": "#0D9488",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Vacation Fund"
    assert data["goal_type"] == "savings"
    assert float(data["target_amount"]) == 5000.0
    assert float(data["current_amount"]) == 0.0
    assert data["is_active"] is True


async def test_list_goals(client: AsyncClient, goal: Goal):
    response = await client.get("/api/v1/goals/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Emergency Fund"


async def test_list_goals_active_only(client: AsyncClient, db_session, test_user):
    active = Goal(
        user_id=test_user.id,
        name="Active Goal",
        goal_type="savings",
        target_amount=Decimal("1000"),
        is_active=True,
    )
    inactive = Goal(
        user_id=test_user.id,
        name="Inactive Goal",
        goal_type="savings",
        target_amount=Decimal("2000"),
        is_active=False,
    )
    db_session.add_all([active, inactive])
    await db_session.commit()

    response = await client.get("/api/v1/goals/?active_only=true")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Active Goal"

    response = await client.get("/api/v1/goals/?active_only=false")
    assert response.status_code == 200
    assert len(response.json()) == 2


async def test_get_goal_with_progress(client: AsyncClient, goal: Goal):
    response = await client.get(f"/api/v1/goals/{goal.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Emergency Fund"
    assert data["percentage"] == 25.0
    assert float(data["remaining_amount"]) == 7500.0
    assert data["milestones_reached"] == [25]
    assert data["contribution_count"] == 0


async def test_update_goal(client: AsyncClient, goal: Goal):
    response = await client.patch(
        f"/api/v1/goals/{goal.id}",
        json={"target_amount": 15000, "name": "Big Emergency Fund"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Big Emergency Fund"
    assert float(data["target_amount"]) == 15000.0


async def test_delete_goal(client: AsyncClient, goal: Goal):
    response = await client.delete(f"/api/v1/goals/{goal.id}")
    assert response.status_code == 204

    response = await client.get(f"/api/v1/goals/{goal.id}")
    assert response.status_code == 404


async def test_add_contribution(client: AsyncClient, goal: Goal):
    response = await client.post(
        f"/api/v1/goals/{goal.id}/contributions",
        json={"amount": 500, "note": "Monthly deposit"},
    )
    assert response.status_code == 201
    contrib = response.json()
    assert float(contrib["amount"]) == 500.0
    assert contrib["note"] == "Monthly deposit"

    response = await client.get(f"/api/v1/goals/{goal.id}")
    assert float(response.json()["current_amount"]) == 3000.0


async def test_add_withdrawal(client: AsyncClient, goal: Goal):
    response = await client.post(
        f"/api/v1/goals/{goal.id}/contributions",
        json={"amount": -200, "note": "Emergency withdrawal"},
    )
    assert response.status_code == 201
    assert float(response.json()["amount"]) == -200.0

    response = await client.get(f"/api/v1/goals/{goal.id}")
    assert float(response.json()["current_amount"]) == 2300.0


async def test_list_contributions(client: AsyncClient, goal: Goal):
    await client.post(
        f"/api/v1/goals/{goal.id}/contributions",
        json={"amount": 100, "note": "First"},
    )
    await client.post(
        f"/api/v1/goals/{goal.id}/contributions",
        json={"amount": 200, "note": "Second"},
    )

    response = await client.get(f"/api/v1/goals/{goal.id}/contributions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


async def test_goal_summary(client: AsyncClient, db_session, test_user):
    goal1 = Goal(
        user_id=test_user.id,
        name="Goal 1",
        goal_type="savings",
        target_amount=Decimal("10000"),
        current_amount=Decimal("5000"),
    )
    goal2 = Goal(
        user_id=test_user.id,
        name="Goal 2",
        goal_type="debt_payoff",
        target_amount=Decimal("5000"),
        current_amount=Decimal("1000"),
    )
    db_session.add_all([goal1, goal2])
    await db_session.commit()

    response = await client.get("/api/v1/goals/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_goals"] == 2
    assert data["active_goals"] == 2
    assert float(data["total_target"]) == 15000.0
    assert float(data["total_saved"]) == 6000.0
    assert data["overall_progress"] == 40.0


async def test_projected_completion(client: AsyncClient, goal: Goal):
    await client.post(
        f"/api/v1/goals/{goal.id}/contributions",
        json={"amount": 1000, "note": "Big deposit"},
    )

    response = await client.get(f"/api/v1/goals/{goal.id}")
    data = response.json()
    assert float(data["monthly_rate"]) > 0
    if float(data["remaining_amount"]) > 0:
        assert data["projected_completion"] is not None


async def test_milestone_detection(client: AsyncClient, db_session, test_user):
    goal = Goal(
        user_id=test_user.id,
        name="Milestone Test",
        goal_type="savings",
        target_amount=Decimal("1000"),
        current_amount=Decimal("400"),
    )
    db_session.add(goal)
    await db_session.commit()
    await db_session.refresh(goal)

    await client.post(
        f"/api/v1/goals/{goal.id}/contributions",
        json={"amount": 150},
    )

    response = await client.get(f"/api/v1/goals/{goal.id}")
    data = response.json()
    assert 50 in data["milestones_reached"]


async def test_user_isolation(client: AsyncClient, db_session):
    other_user_id = uuid.uuid4()
    other_goal = Goal(
        user_id=other_user_id,
        name="Other Goal",
        goal_type="savings",
        target_amount=Decimal("5000"),
    )
    db_session.add(other_goal)
    await db_session.commit()
    await db_session.refresh(other_goal)

    response = await client.get(f"/api/v1/goals/{other_goal.id}")
    assert response.status_code == 404

    response = await client.get("/api/v1/goals/")
    assert len(response.json()) == 0
