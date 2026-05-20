import { apiFetch } from "@/api/client";
import type {
  Category,
  CategoryWithSpend,
  CreateCategoryData,
  MergeCategoryRequest,
  MergeCategoryResponse,
  MergeSuggestion,
  SubordinateCategoryRequest,
} from "@/types/models";

export async function getCategories(token: string): Promise<Category[]> {
  return apiFetch<Category[]>("/api/v1/categories", {}, token);
}

export async function createCategory(
  data: CreateCategoryData,
  token: string
): Promise<Category> {
  return apiFetch<Category>(
    "/api/v1/categories",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function updateCategory(
  id: string,
  data: Partial<CreateCategoryData>,
  token: string
): Promise<Category> {
  return apiFetch<Category>(
    `/api/v1/categories/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function deleteCategory(
  id: string,
  token: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/categories/${id}`,
    { method: "DELETE" },
    token
  );
}

export async function getCategoriesWithSpend(
  token: string
): Promise<CategoryWithSpend[]> {
  return apiFetch<CategoryWithSpend[]>(
    "/api/v1/categories/with-spend",
    {},
    token
  );
}

export async function getMergeSuggestions(
  token: string
): Promise<MergeSuggestion[]> {
  return apiFetch<MergeSuggestion[]>(
    "/api/v1/categories/merge-suggestions",
    {},
    token
  );
}

export async function mergeCategories(
  data: MergeCategoryRequest,
  token: string
): Promise<MergeCategoryResponse> {
  return apiFetch<MergeCategoryResponse>(
    "/api/v1/categories/merge",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function subordinateCategory(
  data: SubordinateCategoryRequest,
  token: string
): Promise<Category> {
  return apiFetch<Category>(
    "/api/v1/categories/subordinate",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
}

export async function unsubordinateCategory(
  categoryId: string,
  token: string
): Promise<Category> {
  return apiFetch<Category>(
    `/api/v1/categories/unsubordinate?category_id=${categoryId}`,
    { method: "POST" },
    token
  );
}
