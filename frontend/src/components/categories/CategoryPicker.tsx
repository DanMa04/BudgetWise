import { useMemo } from "react";
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
  const { expenseGroups, expenseStandalone, incomeCategories } = useMemo(() => {
    const expense = categories.filter((c) => !c.is_income);
    const income = categories.filter((c) => c.is_income);

    const childIds = new Set(
      expense.filter((c) => c.parent_id).map((c) => c.id)
    );
    const parentIds = new Set(
      expense.filter((c) => c.parent_id).map((c) => c.parent_id!)
    );

    const groups: { parent: Category; children: Category[] }[] = [];
    const standalone: Category[] = [];

    for (const cat of expense) {
      if (childIds.has(cat.id)) continue;

      if (parentIds.has(cat.id)) {
        const children = expense
          .filter((c) => c.parent_id === cat.id)
          .sort((a, b) => a.name.localeCompare(b.name));
        groups.push({ parent: cat, children });
      } else {
        standalone.push(cat);
      }
    }

    groups.sort((a, b) => a.parent.name.localeCompare(b.parent.name));
    standalone.sort((a, b) => a.name.localeCompare(b.name));

    return {
      expenseGroups: groups,
      expenseStandalone: standalone,
      incomeCategories: income.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [categories]);

  return (
    <Select
      className={cn(className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Category"
    >
      <option value="">{placeholder}</option>

      {expenseGroups.map((group) => (
        <optgroup key={group.parent.id} label={group.parent.name}>
          <option value={group.parent.id}>
            {group.parent.name} (General)
          </option>
          {group.children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.name}
            </option>
          ))}
        </optgroup>
      ))}

      {expenseStandalone.length > 0 && (
        <optgroup label="Expenses">
          {expenseStandalone.map((cat) => (
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
