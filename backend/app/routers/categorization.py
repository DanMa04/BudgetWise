import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.categorization_rule import (
    ApplySubscriptionRequest,
    BulkCategorizeRequest,
    CategorizationRequest,
    CategorizationResponse,
    CorrectionRequest,
    RuleCreate,
    RuleRead,
    RuleUpdate,
    SubscriptionSuggestion,
)
from app.services.categorization_service import (
    bulk_categorize_transactions,
    categorize_transaction,
    create_rule,
    delete_rule,
    get_rules,
    record_correction,
    train_user_model,
    update_rule,
)
from app.services.subscription_service import (
    apply_subscription_suggestion,
    detect_subscriptions,
)

router = APIRouter(prefix="/categorization", tags=["categorization"])


@router.get("/rules", response_model=list[RuleRead])
async def list_rules(
    category_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_rules(db, current_user.id, category_id)


@router.post("/rules", response_model=RuleRead, status_code=status.HTTP_201_CREATED)
async def create_rule_endpoint(
    data: RuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_rule(db, current_user.id, data)


@router.patch("/rules/{rule_id}", response_model=RuleRead)
async def update_rule_endpoint(
    rule_id: uuid.UUID,
    data: RuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await update_rule(db, current_user.id, rule_id, data)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule_endpoint(
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_rule(db, current_user.id, rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Rule not found")


@router.post("/predict", response_model=CategorizationResponse)
async def predict_category(
    data: CategorizationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category_id, confidence, source = await categorize_transaction(
        db, current_user.id, data.description
    )
    return CategorizationResponse(
        category_id=category_id, confidence=confidence, source=source
    )


@router.post("/correct/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def correct_transaction(
    transaction_id: uuid.UUID,
    data: CorrectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await record_correction(
        db, current_user.id, transaction_id, data.category_id, data.create_rule
    )


@router.post("/bulk-categorize")
async def bulk_categorize(
    data: BulkCategorizeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await bulk_categorize_transactions(
        db, current_user.id, data.transaction_ids, data.category_id
    )
    return {"updated": count}


@router.post("/train")
async def trigger_training(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await train_user_model(db, current_user.id)
    if not success:
        return {"status": "insufficient_data", "minimum_required": 50}
    return {"status": "trained"}


@router.post("/confirm-imports")
async def confirm_import_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import update

    from app.models.transaction import Transaction

    result = await db.execute(
        update(Transaction)
        .where(
            Transaction.user_id == current_user.id,
            Transaction.category_source == "import",
        )
        .values(category_source="manual")
    )
    await db.commit()
    return {"confirmed": result.rowcount}


@router.get(
    "/subscription-suggestions",
    response_model=list[SubscriptionSuggestion],
)
async def get_subscription_suggestions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await detect_subscriptions(db, current_user.id)


@router.post("/subscription-suggestions/apply")
async def apply_subscription(
    data: ApplySubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await apply_subscription_suggestion(
        db,
        current_user.id,
        data.transaction_ids,
        data.category_id,
        data.merchant_pattern,
        data.create_rule,
    )
    await db.commit()
    return {"updated": count}
