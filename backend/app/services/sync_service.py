import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.plaid_item import PlaidItem
from app.models.transaction import Transaction
from app.services.plaid_service import PlaidServiceProtocol, get_plaid_service

ACCOUNT_TYPE_MAP = {
    "depository": "checking",
    "credit": "credit",
    "investment": "investment",
    "loan": "loan",
}

SUBTYPE_MAP = {
    "checking": "checking",
    "savings": "savings",
    "credit card": "credit",
    "brokerage": "investment",
}


def _resolve_account_type(plaid_type: str, plaid_subtype: str) -> str:
    return SUBTYPE_MAP.get(plaid_subtype, ACCOUNT_TYPE_MAP.get(plaid_type, "other"))


async def link_institution(
    db: AsyncSession,
    user_id: uuid.UUID,
    public_token: str,
    institution_id: str,
    institution_name: str,
    plaid_service: PlaidServiceProtocol | None = None,
) -> PlaidItem:
    if plaid_service is None:
        plaid_service = get_plaid_service()

    token_data = await plaid_service.exchange_public_token(public_token)

    plaid_item = PlaidItem(
        user_id=user_id,
        institution_id=institution_id,
        institution_name=institution_name,
        access_token=token_data["access_token"],
        item_id=token_data["item_id"],
        status="active",
    )
    db.add(plaid_item)
    await db.flush()
    await db.refresh(plaid_item)

    plaid_accounts = await plaid_service.get_accounts(token_data["access_token"])

    for pa in plaid_accounts:
        account = Account(
            user_id=user_id,
            name=pa["name"],
            account_type=_resolve_account_type(pa["type"], pa["subtype"]),
            institution_name=institution_name,
            currency_code=pa.get("currency", "USD"),
            current_balance=Decimal(str(pa["balance_current"])),
            plaid_item_id=plaid_item.id,
            plaid_account_id=pa["account_id"],
        )
        db.add(account)

    await db.flush()
    return plaid_item


async def sync_account_transactions(
    db: AsyncSession,
    user_id: uuid.UUID,
    plaid_item_id: uuid.UUID,
    plaid_service: PlaidServiceProtocol | None = None,
) -> dict:
    if plaid_service is None:
        plaid_service = get_plaid_service()

    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.id == plaid_item_id,
            PlaidItem.user_id == user_id,
            PlaidItem.status == "active",
        )
    )
    plaid_item = result.scalar_one_or_none()
    if not plaid_item:
        raise ValueError("PlaidItem not found or not active")

    account_result = await db.execute(
        select(Account).where(Account.plaid_item_id == plaid_item.id)
    )
    linked_accounts = list(account_result.scalars().all())
    if not linked_accounts:
        raise ValueError("No linked accounts found for this PlaidItem")

    # Use the first linked account for assigning transactions
    default_account = linked_accounts[0]

    sync_data = await plaid_service.sync_transactions(
        plaid_item.access_token, plaid_item.sync_cursor
    )

    added_count = 0
    for txn in sync_data["added"]:
        transaction = Transaction(
            user_id=user_id,
            account_id=default_account.id,
            date=date.fromisoformat(txn["date"]),
            amount=Decimal(str(txn["amount"])),
            description=txn["description"],
            source="plaid",
        )
        db.add(transaction)
        added_count += 1

    modified_count = len(sync_data["modified"])
    removed_count = len(sync_data["removed"])

    plaid_item.sync_cursor = sync_data["next_cursor"]
    plaid_item.last_synced_at = datetime.now(timezone.utc)

    # Refresh account balances from Plaid
    plaid_accounts = await plaid_service.get_accounts(plaid_item.access_token)
    plaid_balance_map = {pa["account_id"]: pa["balance_current"] for pa in plaid_accounts}
    for account in linked_accounts:
        if account.plaid_account_id in plaid_balance_map:
            account.current_balance = Decimal(
                str(plaid_balance_map[account.plaid_account_id])
            )

    await db.flush()

    return {
        "added": added_count,
        "modified": modified_count,
        "removed": removed_count,
    }


async def sync_all_items(
    db: AsyncSession,
    user_id: uuid.UUID,
    plaid_service: PlaidServiceProtocol | None = None,
) -> list[dict]:
    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.user_id == user_id,
            PlaidItem.status == "active",
        )
    )
    items = list(result.scalars().all())

    results = []
    for item in items:
        sync_result = await sync_account_transactions(
            db, user_id, item.id, plaid_service
        )
        results.append(sync_result)

    return results
