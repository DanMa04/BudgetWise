import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.category import Category
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    CategoryWithSpend,
    MergeCategoryRequest,
    MergeCategoryResponse,
    MergeSuggestion,
    SubordinateCategoryRequest,
)
from app.services.category_merge_service import (
    get_categories_with_spend,
    get_merge_suggestions,
    merge_categories,
)
from app.services.category_service import seed_default_categories

router = APIRouter(prefix="/categories", tags=["categories"])


async def validate_parent_assignment(
    db: AsyncSession,
    user_id: uuid.UUID,
    category_id: uuid.UUID | None,
    parent_id: uuid.UUID,
) -> None:
    parent = await db.get(Category, parent_id)
    if not parent or parent.user_id != user_id:
        raise HTTPException(status_code=404, detail="Parent category not found")
    if parent.parent_id is not None:
        raise HTTPException(status_code=400, detail="Cannot nest under a child category (2-level max)")
    if category_id and parent_id == category_id:
        raise HTTPException(status_code=400, detail="A category cannot be its own parent")
    if category_id:
        result = await db.execute(
            select(Category).where(Category.parent_id == category_id)
        )
        if result.scalars().first():
            raise HTTPException(
                status_code=400, detail="A parent category cannot become a child"
            )


@router.get("/", response_model=list[CategoryRead])
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(Category.user_id == current_user.id).order_by(Category.sort_order)
    )
    categories = list(result.scalars().all())

    # If user has no categories, seed the defaults
    if not categories:
        categories = await seed_default_categories(db, current_user.id)

    return categories


@router.post("/", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.parent_id is not None:
        await validate_parent_assignment(db, current_user.id, None, data.parent_id)

    category = Category(
        user_id=current_user.id,
        is_system=False,
        **data.model_dump(),
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


@router.post("/merge", response_model=MergeCategoryResponse)
async def merge_categories_endpoint(
    data: MergeCategoryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await merge_categories(
            db, current_user.id, data.source_id, data.target_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/merge-suggestions", response_model=list[MergeSuggestion])
async def merge_suggestions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_merge_suggestions(db, current_user.id)


@router.get("/with-spend", response_model=list[CategoryWithSpend])
async def categories_with_spend(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_categories_with_spend(db, current_user.id)


@router.post("/subordinate", response_model=CategoryRead)
async def subordinate_category(
    data: SubordinateCategoryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    source = (
        await db.execute(
            select(Category).where(
                Category.id == data.source_id, Category.user_id == current_user.id
            )
        )
    ).scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source category not found")

    await validate_parent_assignment(db, current_user.id, data.source_id, data.parent_id)

    source.parent_id = data.parent_id
    await db.flush()
    await db.refresh(source)
    return source


@router.post("/unsubordinate", response_model=CategoryRead)
async def unsubordinate_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = (
        await db.execute(
            select(Category).where(
                Category.id == category_id, Category.user_id == current_user.id
            )
        )
    ).scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    category.parent_id = None
    await db.flush()
    await db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: uuid.UUID,
    data: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, Category.user_id == current_user.id
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = data.model_dump(exclude_unset=True)
    if "parent_id" in update_data and update_data["parent_id"] is not None:
        await validate_parent_assignment(
            db, current_user.id, category_id, update_data["parent_id"]
        )

    for key, value in update_data.items():
        setattr(category, key, value)
    await db.flush()
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, Category.user_id == current_user.id
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if category.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system category")

    await db.delete(category)
    await db.flush()
