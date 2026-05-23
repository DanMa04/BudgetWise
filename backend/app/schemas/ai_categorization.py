from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    mode: str  # "subcategorize" or "merge"


class AnalyzeResponse(BaseModel):
    proposed_categories: list[dict]
    assignments: list[dict]
    summary: str
    stats: dict


class ApplyRequest(BaseModel):
    proposed_categories: list[dict]
    assignments: list[dict]


class ApplyResponse(BaseModel):
    categories_created: int
    categories_updated: int
    categories_deleted: int
    transactions_updated: int
