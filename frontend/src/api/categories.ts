import { apiFetch } from "@/api/client";
import type { Category, CreateCategoryData } from "@/types/models";

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
