import random
import uuid
from abc import ABC, abstractmethod
from datetime import date, timedelta
from decimal import Decimal

from app.config import settings


class PlaidServiceProtocol(ABC):
    @abstractmethod
    async def create_link_token(self, user_id: uuid.UUID) -> str: ...

    @abstractmethod
    async def exchange_public_token(self, public_token: str) -> dict: ...

    @abstractmethod
    async def get_accounts(self, access_token: str) -> list[dict]: ...

    @abstractmethod
    async def sync_transactions(
        self, access_token: str, cursor: str | None
    ) -> dict: ...

    @abstractmethod
    async def get_institution(self, institution_id: str) -> dict: ...


class MockPlaidService(PlaidServiceProtocol):
    async def create_link_token(self, user_id: uuid.UUID) -> str:
        return f"link-mock-{uuid.uuid4().hex[:12]}"

    async def exchange_public_token(self, public_token: str) -> dict:
        return {
            "access_token": f"access-mock-{uuid.uuid4().hex[:12]}",
            "item_id": f"item-mock-{uuid.uuid4().hex[:12]}",
        }

    async def get_accounts(self, access_token: str) -> list[dict]:
        return [
            {
                "account_id": f"acct-mock-{uuid.uuid4().hex[:8]}",
                "name": "Main Checking",
                "type": "depository",
                "subtype": "checking",
                "balance_current": 3500.00,
                "balance_available": 3200.00,
                "currency": "USD",
            },
            {
                "account_id": f"acct-mock-{uuid.uuid4().hex[:8]}",
                "name": "Savings Account",
                "type": "depository",
                "subtype": "savings",
                "balance_current": 12000.00,
                "balance_available": 12000.00,
                "currency": "USD",
            },
            {
                "account_id": f"acct-mock-{uuid.uuid4().hex[:8]}",
                "name": "Credit Card",
                "type": "credit",
                "subtype": "credit card",
                "balance_current": -1250.00,
                "balance_available": 3750.00,
                "currency": "USD",
            },
            {
                "account_id": f"acct-mock-{uuid.uuid4().hex[:8]}",
                "name": "Investment Portfolio",
                "type": "investment",
                "subtype": "brokerage",
                "balance_current": 45000.00,
                "balance_available": None,
                "currency": "USD",
            },
        ]

    async def sync_transactions(
        self, access_token: str, cursor: str | None
    ) -> dict:
        merchants = [
            ("AMAZON.COM", Decimal("29.99")),
            ("WHOLE FOODS", Decimal("67.42")),
            ("SHELL GAS", Decimal("45.00")),
            ("NETFLIX", Decimal("15.99")),
            ("SPOTIFY", Decimal("9.99")),
            ("UBER", Decimal("18.50")),
            ("TARGET", Decimal("54.23")),
            ("STARBUCKS", Decimal("5.75")),
            ("COSTCO", Decimal("132.87")),
            ("WALGREENS", Decimal("12.34")),
            ("CHIPOTLE", Decimal("11.25")),
            ("HOME DEPOT", Decimal("89.99")),
            ("APPLE.COM", Decimal("14.99")),
            ("CVS PHARMACY", Decimal("23.47")),
            ("TRADER JOES", Decimal("48.92")),
            ("MCDONALDS", Decimal("8.49")),
            ("BEST BUY", Decimal("199.99")),
            ("GRUBHUB", Decimal("32.15")),
            ("LYFT", Decimal("14.75")),
            ("PETCO", Decimal("42.30")),
        ]

        today = date.today()
        num_transactions = random.randint(15, 25)
        selected = random.choices(merchants, k=num_transactions)

        added = []
        for merchant_name, base_amount in selected:
            variation = Decimal(str(random.uniform(0.8, 1.2)))
            amount = round(base_amount * variation, 2)
            days_ago = random.randint(0, 30)
            txn_date = today - timedelta(days=days_ago)

            added.append({
                "transaction_id": f"txn-mock-{uuid.uuid4().hex[:12]}",
                "account_id": f"acct-mock-{uuid.uuid4().hex[:8]}",
                "date": txn_date.isoformat(),
                "amount": float(amount),
                "description": merchant_name,
                "category": ["Shopping"],
                "pending": False,
            })

        return {
            "added": added,
            "modified": [],
            "removed": [],
            "next_cursor": f"cursor-mock-{uuid.uuid4().hex[:12]}",
            "has_more": False,
        }

    async def get_institution(self, institution_id: str) -> dict:
        return {
            "institution_id": institution_id,
            "name": "Mock Bank",
            "logo": None,
        }


class RealPlaidService(PlaidServiceProtocol):
    async def create_link_token(self, user_id: uuid.UUID) -> str:
        raise NotImplementedError("Real Plaid integration not yet configured")

    async def exchange_public_token(self, public_token: str) -> dict:
        raise NotImplementedError("Real Plaid integration not yet configured")

    async def get_accounts(self, access_token: str) -> list[dict]:
        raise NotImplementedError("Real Plaid integration not yet configured")

    async def sync_transactions(
        self, access_token: str, cursor: str | None
    ) -> dict:
        raise NotImplementedError("Real Plaid integration not yet configured")

    async def get_institution(self, institution_id: str) -> dict:
        raise NotImplementedError("Real Plaid integration not yet configured")


def get_plaid_service() -> PlaidServiceProtocol:
    if settings.plaid_env == "mock":
        return MockPlaidService()
    return RealPlaidService()
