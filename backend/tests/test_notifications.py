import uuid
from datetime import date
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.goal import Goal
from app.models.notification_log import NotificationLog
from app.models.notification_preference import NotificationPreference
from app.models.transaction import Transaction
from app.models.user import User


async def _create_account(db: AsyncSession, user_id: uuid.UUID) -> Account:
    account = Account(
        user_id=user_id,
        name="Test Checking",
        account_type="checking",
        currency_code="USD",
        current_balance=Decimal("10000"),
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account


async def _create_category(
    db: AsyncSession, user_id: uuid.UUID, name: str = "Groceries"
) -> Category:
    category = Category(
        user_id=user_id,
        name=name,
        is_system=False,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


# ── 1. Default preferences ──────────────────────────────────────────


async def test_default_preferences_created_on_first_access(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.get("/api/v1/notifications/preferences")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5  # 5 notification types x in_app channel
    types = {p["notification_type"] for p in data}
    assert types == {
        "budget_warning",
        "budget_exceeded",
        "pace_alert",
        "goal_milestone",
        "weekly_summary",
    }
    for p in data:
        assert p["channel"] == "in_app"
        assert p["enabled"] is True


async def test_defaults_not_duplicated_on_second_access(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    await client.get("/api/v1/notifications/preferences")
    await client.get("/api/v1/notifications/preferences")
    response = await client.get("/api/v1/notifications/preferences")
    assert response.status_code == 200
    assert len(response.json()) == 5


# ── 2. Upsert preference ────────────────────────────────────────────


async def test_upsert_preference_create_new(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    response = await client.put(
        "/api/v1/notifications/preferences",
        json={
            "notification_type": "budget_warning",
            "channel": "push",
            "enabled": True,
            "threshold": 75,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["notification_type"] == "budget_warning"
    assert data["channel"] == "push"
    assert data["threshold"] == 75
    assert data["enabled"] is True


async def test_upsert_preference_update_existing(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    # Create first
    resp1 = await client.put(
        "/api/v1/notifications/preferences",
        json={
            "notification_type": "budget_warning",
            "channel": "in_app",
            "enabled": True,
            "threshold": 80,
        },
    )
    assert resp1.status_code == 200
    pref_id = resp1.json()["id"]

    # Update
    resp2 = await client.put(
        "/api/v1/notifications/preferences",
        json={
            "notification_type": "budget_warning",
            "channel": "in_app",
            "enabled": False,
            "threshold": 90,
        },
    )
    assert resp2.status_code == 200
    data = resp2.json()
    assert data["id"] == pref_id  # Same record
    assert data["enabled"] is False
    assert data["threshold"] == 90


# ── 3. Delete preference ────────────────────────────────────────────


async def test_delete_preference(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    resp = await client.put(
        "/api/v1/notifications/preferences",
        json={
            "notification_type": "pace_alert",
            "channel": "in_app",
            "enabled": True,
        },
    )
    pref_id = resp.json()["id"]

    delete_resp = await client.delete(f"/api/v1/notifications/preferences/{pref_id}")
    assert delete_resp.status_code == 204


async def test_delete_preference_not_found(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    fake_id = uuid.uuid4()
    resp = await client.delete(f"/api/v1/notifications/preferences/{fake_id}")
    assert resp.status_code == 404


# ── 4. Create notification (via service directly) ────────────────────


async def test_create_notification_via_service(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.services.notification_service import create_notification

    notif = await create_notification(
        db_session,
        user_id=test_user.id,
        notification_type="budget_warning",
        title="Test alert",
        message="This is a test notification",
        channel="in_app",
    )
    assert notif is not None
    assert notif.title == "Test alert"
    assert notif.is_read is False
    assert notif.status == "sent"


# ── 5. List notifications with pagination ────────────────────────────


async def test_list_notifications_pagination(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.services.notification_service import create_notification

    for i in range(5):
        await create_notification(
            db_session,
            user_id=test_user.id,
            notification_type="budget_warning",
            title=f"Alert {i}",
            message=f"Message {i}",
        )
    await db_session.commit()

    # Page 1, 2 per page
    response = await client.get(
        "/api/v1/notifications/", params={"page": 1, "per_page": 2}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 5
    assert data["page"] == 1
    assert data["per_page"] == 2
    assert len(data["items"]) == 2

    # Page 3, 2 per page => 1 item
    response = await client.get(
        "/api/v1/notifications/", params={"page": 3, "per_page": 2}
    )
    data = response.json()
    assert len(data["items"]) == 1


# ── 6. Unread count ──────────────────────────────────────────────────


async def test_unread_count(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.services.notification_service import create_notification

    for i in range(3):
        await create_notification(
            db_session,
            user_id=test_user.id,
            notification_type="budget_warning",
            title=f"Alert {i}",
            message=f"Message {i}",
        )
    await db_session.commit()

    response = await client.get("/api/v1/notifications/unread-count")
    assert response.status_code == 200
    assert response.json()["count"] == 3


# ── 7. Mark read (single + all) ──────────────────────────────────────


async def test_mark_single_read(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.services.notification_service import create_notification

    notif = await create_notification(
        db_session,
        user_id=test_user.id,
        notification_type="budget_warning",
        title="Read me",
        message="Please read",
    )
    await db_session.commit()

    response = await client.post(f"/api/v1/notifications/{notif.id}/read")
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Verify unread count went down
    count_resp = await client.get("/api/v1/notifications/unread-count")
    assert count_resp.json()["count"] == 0


async def test_mark_all_read(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.services.notification_service import create_notification

    for i in range(3):
        await create_notification(
            db_session,
            user_id=test_user.id,
            notification_type="budget_warning",
            title=f"Alert {i}",
            message=f"Msg {i}",
        )
    await db_session.commit()

    response = await client.post("/api/v1/notifications/read-all")
    assert response.status_code == 200
    assert response.json()["updated"] == 3

    count_resp = await client.get("/api/v1/notifications/unread-count")
    assert count_resp.json()["count"] == 0


async def test_mark_read_not_found(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    fake_id = uuid.uuid4()
    resp = await client.post(f"/api/v1/notifications/{fake_id}/read")
    assert resp.status_code == 404


# ── 8. Delete notification ───────────────────────────────────────────


async def test_delete_notification(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.services.notification_service import create_notification

    notif = await create_notification(
        db_session,
        user_id=test_user.id,
        notification_type="budget_warning",
        title="Delete me",
        message="To be deleted",
    )
    await db_session.commit()

    resp = await client.delete(f"/api/v1/notifications/{notif.id}")
    assert resp.status_code == 204

    # Verify it's gone
    list_resp = await client.get("/api/v1/notifications/")
    assert list_resp.json()["total"] == 0


async def test_delete_notification_not_found(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    fake_id = uuid.uuid4()
    resp = await client.delete(f"/api/v1/notifications/{fake_id}")
    assert resp.status_code == 404


# ── 9. Budget threshold alert detection ──────────────────────────────


async def test_budget_threshold_alert(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    category = await _create_category(db_session, test_user.id)
    account = await _create_account(db_session, test_user.id)

    today = date.today()
    start_date = today.replace(day=1)

    budget = Budget(
        user_id=test_user.id,
        category_id=category.id,
        name="Grocery Budget",
        amount=Decimal("500.00"),
        period_type="monthly",
        start_date=start_date,
        is_active=True,
    )
    db_session.add(budget)
    await db_session.flush()

    # Add transactions exceeding 80% (= $400)
    txn = Transaction(
        user_id=test_user.id,
        account_id=account.id,
        category_id=category.id,
        date=today,
        amount=Decimal("420.00"),
        description="Big grocery run",
        source="manual",
    )
    db_session.add(txn)
    await db_session.flush()
    await db_session.commit()

    # Trigger alert check
    response = await client.post("/api/v1/notifications/check")
    assert response.status_code == 200
    data = response.json()
    assert len(data["budget_alerts"]) > 0

    # Verify notification was created
    notif_resp = await client.get("/api/v1/notifications/")
    assert notif_resp.json()["total"] > 0


# ── 10. Duplicate alert prevention ───────────────────────────────────


async def test_duplicate_alert_prevention(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.services.notification_service import create_notification

    dedup = "test_dedup_key_123"
    n1 = await create_notification(
        db_session,
        user_id=test_user.id,
        notification_type="budget_warning",
        title="First",
        message="First alert",
        dedup_key=dedup,
    )
    assert n1 is not None

    n2 = await create_notification(
        db_session,
        user_id=test_user.id,
        notification_type="budget_warning",
        title="Second",
        message="Second alert with same dedup",
        dedup_key=dedup,
    )
    assert n2 is None  # Should be prevented


async def test_budget_alert_not_duplicated_on_recheck(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    category = await _create_category(db_session, test_user.id)
    account = await _create_account(db_session, test_user.id)

    today = date.today()
    start_date = today.replace(day=1)

    budget = Budget(
        user_id=test_user.id,
        category_id=category.id,
        name="Test Budget",
        amount=Decimal("100.00"),
        period_type="monthly",
        start_date=start_date,
        is_active=True,
    )
    db_session.add(budget)

    txn = Transaction(
        user_id=test_user.id,
        account_id=account.id,
        category_id=category.id,
        date=today,
        amount=Decimal("85.00"),
        description="Spend",
        source="manual",
    )
    db_session.add(txn)
    await db_session.flush()
    await db_session.commit()

    # First check
    resp1 = await client.post("/api/v1/notifications/check")
    data1 = resp1.json()
    total_alerts_first = len(data1["budget_alerts"]) + len(data1["pace_alerts"])
    assert total_alerts_first > 0

    # Second check - same period, should not duplicate
    resp2 = await client.post("/api/v1/notifications/check")
    data2 = resp2.json()
    assert len(data2["budget_alerts"]) == 0
    assert len(data2["pace_alerts"]) == 0

    # Total notifications should match first check only
    notif_resp = await client.get("/api/v1/notifications/")
    assert notif_resp.json()["total"] == total_alerts_first


# ── 11. Pace alert detection ─────────────────────────────────────────


async def test_pace_alert(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    category = await _create_category(db_session, test_user.id)
    account = await _create_account(db_session, test_user.id)

    today = date.today()
    start_date = today.replace(day=1)

    budget = Budget(
        user_id=test_user.id,
        category_id=category.id,
        name="Entertainment",
        amount=Decimal("200.00"),
        period_type="monthly",
        start_date=start_date,
        is_active=True,
    )
    db_session.add(budget)

    # Spend a lot early in the period so projection exceeds budget
    # If we spend $150 in the first few days, projection for full month > $200
    txn = Transaction(
        user_id=test_user.id,
        account_id=account.id,
        category_id=category.id,
        date=today,
        amount=Decimal("150.00"),
        description="Big entertainment spend",
        source="manual",
    )
    db_session.add(txn)
    await db_session.flush()
    await db_session.commit()

    response = await client.post("/api/v1/notifications/check")
    assert response.status_code == 200
    data = response.json()

    # Pace alert may or may not fire depending on day of month
    # If today is day 1, daily rate = 150, projected = 150 * ~30 = 4500 > 200
    # So pace alert should always fire if there's any spend
    if today.day <= 15:
        assert len(data["pace_alerts"]) > 0


# ── 12. Goal milestone notification ──────────────────────────────────


async def test_goal_milestone_notification(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.services.notification_service import check_goal_milestones

    goal = Goal(
        user_id=test_user.id,
        name="Vacation Fund",
        goal_type="savings",
        target_amount=Decimal("1000.00"),
        current_amount=Decimal("500.00"),
    )
    db_session.add(goal)
    await db_session.flush()
    await db_session.commit()

    # Crossing 50% milestone (was at 40%, now at 50%)
    alerts = await check_goal_milestones(
        db_session,
        user_id=test_user.id,
        goal_id=goal.id,
        old_percentage=40.0,
        new_percentage=50.0,
    )
    assert len(alerts) == 1
    assert alerts[0].milestone_percentage == 50
    assert alerts[0].goal_name == "Vacation Fund"


async def test_goal_milestone_multiple_crossings(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.services.notification_service import check_goal_milestones

    goal = Goal(
        user_id=test_user.id,
        name="Emergency Fund",
        goal_type="emergency_fund",
        target_amount=Decimal("1000.00"),
        current_amount=Decimal("800.00"),
    )
    db_session.add(goal)
    await db_session.flush()
    await db_session.commit()

    # Crossing both 50% and 75% (jumped from 20% to 80%)
    alerts = await check_goal_milestones(
        db_session,
        user_id=test_user.id,
        goal_id=goal.id,
        old_percentage=20.0,
        new_percentage=80.0,
    )
    assert len(alerts) == 3  # 25%, 50%, 75% all crossed
    milestones = {a.milestone_percentage for a in alerts}
    assert milestones == {25, 50, 75}


async def test_goal_milestone_no_crossing(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.services.notification_service import check_goal_milestones

    goal = Goal(
        user_id=test_user.id,
        name="Small Goal",
        goal_type="savings",
        target_amount=Decimal("1000.00"),
        current_amount=Decimal("150.00"),
    )
    db_session.add(goal)
    await db_session.flush()
    await db_session.commit()

    # No milestone crossed (10% to 15%)
    alerts = await check_goal_milestones(
        db_session,
        user_id=test_user.id,
        goal_id=goal.id,
        old_percentage=10.0,
        new_percentage=15.0,
    )
    assert len(alerts) == 0


# ── 13. User isolation ───────────────────────────────────────────────


async def test_user_isolation_notifications(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.services.notification_service import create_notification

    other_user_id = uuid.uuid4()

    # Create notification for other user directly in DB
    other_notif = NotificationLog(
        user_id=other_user_id,
        notification_type="budget_warning",
        channel="in_app",
        title="Other user alert",
        message="Should not be visible",
        status="sent",
    )
    db_session.add(other_notif)

    # Create notification for test user
    await create_notification(
        db_session,
        user_id=test_user.id,
        notification_type="budget_warning",
        title="My alert",
        message="Should be visible",
    )
    await db_session.commit()

    # List should only show test user's notification
    response = await client.get("/api/v1/notifications/")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "My alert"


async def test_user_isolation_preferences(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    other_user_id = uuid.uuid4()
    other_pref = NotificationPreference(
        user_id=other_user_id,
        notification_type="budget_warning",
        channel="in_app",
        enabled=True,
    )
    db_session.add(other_pref)
    await db_session.flush()
    await db_session.commit()

    # Cannot delete other user's preference
    resp = await client.delete(
        f"/api/v1/notifications/preferences/{other_pref.id}"
    )
    assert resp.status_code == 404


async def test_user_cannot_mark_others_notification_read(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    other_user_id = uuid.uuid4()
    other_notif = NotificationLog(
        user_id=other_user_id,
        notification_type="budget_warning",
        channel="in_app",
        title="Other user alert",
        message="Should not be markable",
        status="sent",
    )
    db_session.add(other_notif)
    await db_session.flush()
    await db_session.commit()

    resp = await client.post(f"/api/v1/notifications/{other_notif.id}/read")
    assert resp.status_code == 404


async def test_user_cannot_delete_others_notification(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    other_user_id = uuid.uuid4()
    other_notif = NotificationLog(
        user_id=other_user_id,
        notification_type="budget_warning",
        channel="in_app",
        title="Other user alert",
        message="Should not be deletable",
        status="sent",
    )
    db_session.add(other_notif)
    await db_session.flush()
    await db_session.commit()

    resp = await client.delete(f"/api/v1/notifications/{other_notif.id}")
    assert resp.status_code == 404


# ── Extra: unread_only filter ─────────────────────────────────────────


async def test_list_notifications_unread_only(
    client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.services.notification_service import create_notification

    await create_notification(
        db_session,
        user_id=test_user.id,
        notification_type="budget_warning",
        title="Unread",
        message="Unread msg",
    )
    n2 = await create_notification(
        db_session,
        user_id=test_user.id,
        notification_type="budget_warning",
        title="Will be read",
        message="Read msg",
    )
    await db_session.commit()

    # Mark one as read
    await client.post(f"/api/v1/notifications/{n2.id}/read")

    # Filter unread only
    response = await client.get(
        "/api/v1/notifications/", params={"unread_only": True}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Unread"
