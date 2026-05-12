import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import type { Category } from "@/types/models";

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  className,
  placeholder = "Select category",
}: CategoryPickerProps) {
  const expenseCategories = categories.filter((c) => !c.is_income);
  const incomeCategories = categories.filter((c) => c.is_income);

  return (
    <Select
      className={cn(className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Category"
    >
      <option value="">{placeholder}</option>
      {expenseCategories.length > 0 && (
        <optgroup label="Expenses">
          {expenseCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </optgroup>
      )}
      {incomeCategories.length > 0 && (
        <optgroup label="Income">
          {incomeCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
}
