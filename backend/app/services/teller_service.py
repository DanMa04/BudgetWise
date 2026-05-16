import random
import uuid
from datetime import date, timedelta
from decimal import Decimal

from app.config import settings
from app.services.plaid_service import PlaidServiceProtocol


class MockTellerService(PlaidServiceProtocol):
    """Mock implementation of Teller.io for development and testing."""

    async def create_link_token(self, user_id: uuid.UUID) -> str:
        """Return enrollment config as a JSON-encoded string for Teller Connect."""
        return f"teller-enrollment-{uuid.uuid4().hex[:12]}"

    async def exchange_public_token(self, public_token: str) -> dict:
        """Exchange Teller enrollment_id for access credentials."""
        return {
            "access_token": f"teller-access-{uuid.uuid4().hex[:12]}",
            "item_id": f"teller-enrollment-{uuid.uuid4().hex[:12]}",
        }

    async def get_accounts(self, access_token: str) -> list[dict]:
        return [
            {
                "account_id": f"teller-acct-{uuid.uuid4().hex[:8]}",
                "name": "Everyday Checking",
                "type": "depository",
                "subtype": "checking",
                "balance_current": 4250.00,
                "balance_available": 4100.00,
                "currency": "USD",
            },
            {
                "account_id": f"teller-acct-{uuid.uuid4().hex[:8]}",
                "name": "High Yield Savings",
                "type": "depository",
                "subtype": "savings",
                "balance_current": 18500.00,
                "balance_available": 18500.00,
                "currency": "USD",
            },
            {
                "account_id": f"teller-acct-{uuid.uuid4().hex[:8]}",
                "name": "Rewards Credit Card",
                "type": "credit",
                "subtype": "credit card",
                "balance_current": -875.50,
                "balance_available": 4124.50,
                "currency": "USD",
            },
        ]

    async def sync_transactions(
        self, access_token: str, cursor: str | None
    ) -> dict:
        merchants = [
            ("TRADER JOES #142", Decimal("52.34")),
            ("UBER EATS", Decimal("24.99")),
            ("CHEVRON GAS", Decimal("55.00")),
            ("HULU SUBSCRIPTION", Decimal("17.99")),
            ("APPLE MUSIC", Decimal("10.99")),
            ("DOORDASH", Decimal("22.50")),
            ("WALMART SUPERCENTER", Decimal("78.43")),
            ("DUNKIN DONUTS", Decimal("6.25")),
            ("SAMS CLUB", Decimal("145.67")),
            ("RITE AID", Decimal("15.89")),
            ("PANERA BREAD", Decimal("13.75")),
            ("LOWES HOME", Decimal("112.99")),
            ("GOOGLE STORAGE", Decimal("2.99")),
            ("ALDI GROCERY", Decimal("38.92")),
            ("WENDYS", Decimal("9.49")),
            ("GAMESTOP", Decimal("59.99")),
            ("INSTACART", Decimal("45.15")),
            ("LYFT RIDE", Decimal("16.75")),
            ("PETMART", Decimal("38.30")),
            ("ZARA CLOTHING", Decimal("89.00")),
        ]

        today = date.today()
        num_transactions = random.randint(12, 20)
        selected = random.choices(merchants, k=num_transactions)

        added = []
        for merchant_name, base_amount in selected:
            variation = Decimal(str(random.uniform(0.8, 1.2)))
            amount = round(base_amount * variation, 2)
            days_ago = random.randint(0, 30)
            txn_date = today - timedelta(days=days_ago)

            added.append({
                "transaction_id": f"teller-txn-{uuid.uuid4().hex[:12]}",
                "account_id": f"teller-acct-{uuid.uuid4().hex[:8]}",
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
            "next_cursor": f"teller-cursor-{uuid.uuid4().hex[:12]}",
            "has_more": False,
        }

    async def get_institution(self, institution_id: str) -> dict:
        return {
            "institution_id": institution_id,
            "name": "Teller Bank",
            "logo": None,
        }


class TellerService(PlaidServiceProtocol):
    """Real Teller.io API integration using mTLS authentication."""

    def __init__(self):
        self.base_url = "https://api.teller.io"
        self.api_key = settings.teller_api_key
        self.certificate_path = settings.teller_certificate_path

    async def create_link_token(self, user_id: uuid.UUID) -> str:
        """Return enrollment config for Teller Connect widget."""
        return f"teller-enrollment-{settings.teller_application_id}"

    async def exchange_public_token(self, public_token: str) -> dict:
        """
        Exchange Teller enrollment_id for stored credentials.
        In Teller, the enrollment_id from Teller Connect acts as both
        the identifier and access mechanism.
        """
        raise NotImplementedError("Real Teller integration not yet configured")

    async def get_accounts(self, access_token: str) -> list[dict]:
        raise NotImplementedError("Real Teller integration not yet configured")

    async def sync_transactions(
        self, access_token: str, cursor: str | None
    ) -> dict:
        raise NotImplementedError("Real Teller integration not yet configured")

    async def get_institution(self, institution_id: str) -> dict:
        raise NotImplementedError("Real Teller integration not yet configured")


def get_teller_service() -> PlaidServiceProtocol:
    """Get the appropriate Teller service based on configuration."""
    if settings.teller_env == "mock":
        return MockTellerService()
    return TellerService()
