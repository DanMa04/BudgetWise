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

  return (
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
        value={filters.category_id ?? ""}
        onChange={(val) => updateFilter("category_id", val)}
        placeholder="All categories"
        className="w-48"
      />
    </div>
  );
}
