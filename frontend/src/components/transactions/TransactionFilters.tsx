import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import type { Category, TransactionFilters as FiltersType } from "@/types/models";

interface TransactionFiltersProps {
  filters: FiltersType;
  onFilterChange: (filters: FiltersType) => void;
  categories: Category[];
}

export function TransactionFilters({
  filters,
  onFilterChange,
  categories,
}: TransactionFiltersProps) {
  function updateFilter(key: keyof FiltersType, value: string) {
    onFilterChange({ ...filters, [key]: value || undefined, page: 1 });
  }

  function clearAllFilters() {
    onFilterChange({
      page: 1,
      per_page: filters.per_page,
      sort_by: filters.sort_by,
      sort_dir: filters.sort_dir,
    });
  }

  const isUncategorizedFilter = filters.category_id === "__uncategorized__";
  const hasActiveFilters =
    isUncategorizedFilter ||
    filters.search ||
    filters.date_from ||
    filters.date_to ||
    (filters.category_id && !isUncategorizedFilter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Search transactions..."
          value={filters.search ?? ""}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="w-full sm:w-64"
        />
        <Input
          type="date"
          value={filters.date_from ?? ""}
          onChange={(e) => updateFilter("date_from", e.target.value)}
          className="w-36"
          aria-label="From date"
        />
        <Input
          type="date"
          value={filters.date_to ?? ""}
          onChange={(e) => updateFilter("date_to", e.target.value)}
          className="w-36"
          aria-label="To date"
        />
        <CategoryPicker
          categories={categories}
          value={isUncategorizedFilter ? "" : (filters.category_id ?? "")}
          onChange={(val) => updateFilter("category_id", val)}
          placeholder="All categories"
          className="w-48"
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <X className="mr-1 h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>

      {isUncategorizedFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            Showing: Uncategorized only
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-1 rounded-full hover:bg-muted-foreground/20"
              aria-label="Clear uncategorized filter"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}
    </div>
  );
}
