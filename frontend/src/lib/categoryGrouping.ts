import type { SpendingByCategory, BudgetVsActual } from "@/types/models";

export function groupSpendingByParent(
  data: SpendingByCategory[]
): SpendingByCategory[] {
  const parentIds = new Set(
    data.filter((d) => d.parent_category_id).map((d) => d.parent_category_id!)
  );

  if (parentIds.size === 0) return data;

  const groups = new Map<
    string,
    {
      name: string;
      color: string;
      icon: string;
      total_amount: number;
      transaction_count: number;
    }
  >();

  const standalone: SpendingByCategory[] = [];

  for (const item of data) {
    if (parentIds.has(item.category_id)) {
      continue;
    }

    if (item.parent_category_id) {
      const key = item.parent_category_id;
      const existing = groups.get(key);
      if (existing) {
        existing.total_amount += item.total_amount;
        existing.transaction_count += item.transaction_count;
      } else {
        const parentItem = data.find((d) => d.category_id === key);
        groups.set(key, {
          name: item.parent_category_name ?? parentItem?.category_name ?? "Group",
          color: parentItem?.category_color ?? item.category_color,
          icon: parentItem?.category_icon ?? item.category_icon,
          total_amount: item.total_amount,
          transaction_count: item.transaction_count,
        });
      }
    } else {
      standalone.push(item);
    }
  }

  const grandTotal =
    standalone.reduce((s, d) => s + d.total_amount, 0) +
    Array.from(groups.values()).reduce((s, g) => s + g.total_amount, 0);

  const grouped: SpendingByCategory[] = Array.from(groups.entries()).map(
    ([id, g]) => ({
      category_id: id,
      parent_category_id: null,
      parent_category_name: null,
      category_name: g.name,
      category_color: g.color,
      category_icon: g.icon,
      total_amount: g.total_amount,
      transaction_count: g.transaction_count,
      percentage: grandTotal > 0 ? (g.total_amount / grandTotal) * 100 : 0,
    })
  );

  const result = [
    ...grouped,
    ...standalone.map((s) => ({
      ...s,
      percentage: grandTotal > 0 ? (s.total_amount / grandTotal) * 100 : 0,
    })),
  ].sort((a, b) => b.total_amount - a.total_amount);

  return result;
}

export function groupBudgetVsActualByParent(
  data: BudgetVsActual[]
): BudgetVsActual[] {
  const parentIds = new Set(
    data.filter((d) => d.parent_category_id).map((d) => d.parent_category_id!)
  );

  if (parentIds.size === 0) return data;

  const groups = new Map<
    string,
    { name: string; color: string; budgeted: number; actual: number }
  >();
  const standalone: BudgetVsActual[] = [];

  for (const item of data) {
    if (item.parent_category_id) {
      const key = item.parent_category_id;
      const existing = groups.get(key);
      if (existing) {
        existing.budgeted += item.budgeted_amount;
        existing.actual += item.actual_amount;
      } else {
        groups.set(key, {
          name: item.parent_category_name ?? item.category_name,
          color: item.category_color,
          budgeted: item.budgeted_amount,
          actual: item.actual_amount,
        });
      }
    } else {
      standalone.push(item);
    }
  }

  const grouped: BudgetVsActual[] = Array.from(groups.entries()).map(
    ([id, g]) => ({
      budget_id: id,
      category_id: id,
      parent_category_id: null,
      parent_category_name: null,
      category_name: g.name,
      category_color: g.color,
      budgeted_amount: g.budgeted,
      actual_amount: g.actual,
      difference: g.budgeted - g.actual,
      percentage_used: g.budgeted > 0 ? (g.actual / g.budgeted) * 100 : 0,
    })
  );

  return [...grouped, ...standalone].sort(
    (a, b) => b.budgeted_amount - a.budgeted_amount
  );
}
