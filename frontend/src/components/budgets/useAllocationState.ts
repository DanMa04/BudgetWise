import { useReducer, useCallback } from "react";
import type { AllocationData } from "@/types/models";

const FIXED_EXPENSE_NAMES = new Set([
  "housing",
  "mortgage & rent",
  "car payment",
  "insurance",
  "utilities",
  "bills & utilities",
  "internet",
  "subscriptions",
  "credit card payment",
  "taxes",
  "federal tax",
  "state tax",
]);

function isFixedExpense(name: string): boolean {
  return FIXED_EXPENSE_NAMES.has(name.toLowerCase());
}

export interface AllocationItem {
  id: string;
  type: "category" | "goal";
  name: string;
  color: string | null;
  icon: string | null;
  amount: number;
  isLocked: boolean;
  averageSpend?: number;
  budgetId?: string;
  parentId?: string | null;
  targetAmount?: number;
  currentAmount?: number;
  monthlyRate?: number;
  targetDate?: string | null;
}

interface AllocationState {
  income: number;
  items: AllocationItem[];
}

type Action =
  | { type: "SET_INCOME"; income: number }
  | { type: "SET_SLIDER"; id: string; amount: number }
  | { type: "SET_MANUAL"; id: string; amount: number }
  | { type: "TOGGLE_LOCK"; id: string }
  | { type: "SET_GROUP_AMOUNTS"; updates: Array<{ id: string; amount: number }> }
  | { type: "INIT"; data: AllocationData };

function getEffectiveLockInfo(items: AllocationItem[]) {
  const parentItemIds = new Set(
    items
      .filter((it) => it.parentId)
      .map((it) => it.parentId!)
      .filter((pid) => items.some((it) => it.id === pid))
  );
  const lockedParentIds = new Set(
    items
      .filter((it) => parentItemIds.has(it.id) && it.isLocked)
      .map((it) => it.id)
  );

  function isEffectivelyLocked(item: AllocationItem): boolean {
    if (parentItemIds.has(item.id)) return true;
    if (item.isLocked) return true;
    if (item.parentId && lockedParentIds.has(item.parentId)) return true;
    return false;
  }

  return { parentItemIds, lockedParentIds, isEffectivelyLocked };
}

function redistribute(
  items: AllocationItem[],
  changedId: string,
  newAmount: number,
  income: number
): AllocationItem[] {
  const { isEffectivelyLocked } = getEffectiveLockInfo(items);

  const lockedTotal = items.reduce(
    (sum, it) =>
      sum + (isEffectivelyLocked(it) && it.id !== changedId ? it.amount : 0),
    0
  );
  const pool = Math.max(0, income - lockedTotal);
  const clampedAmount = Math.min(Math.max(0, newAmount), pool);

  const otherUnlocked = items.filter(
    (it) => !isEffectivelyLocked(it) && it.id !== changedId
  );
  const remainingPool = Math.max(0, pool - clampedAmount);

  const otherTotal = otherUnlocked.reduce((sum, it) => sum + it.amount, 0);

  let distributed: Map<string, number>;
  if (otherUnlocked.length === 0) {
    distributed = new Map();
  } else if (otherTotal === 0) {
    const equal =
      Math.floor((remainingPool / otherUnlocked.length) * 100) / 100;
    distributed = new Map(otherUnlocked.map((it) => [it.id, equal]));
  } else {
    distributed = new Map(
      otherUnlocked.map((it) => [
        it.id,
        Math.floor(((it.amount / otherTotal) * remainingPool) * 100) / 100,
      ])
    );
  }

  if (otherUnlocked.length > 0) {
    const distributedSum = Array.from(distributed.values()).reduce(
      (a, b) => a + b,
      0
    );
    const diff = Math.round((remainingPool - distributedSum) * 100) / 100;
    if (diff !== 0) {
      const lastId = otherUnlocked[otherUnlocked.length - 1].id;
      distributed.set(lastId, (distributed.get(lastId) || 0) + diff);
    }
  }

  return items.map((it) => {
    if (it.id === changedId) return { ...it, amount: clampedAmount };
    if (distributed.has(it.id))
      return { ...it, amount: Math.max(0, distributed.get(it.id)!) };
    return it;
  });
}

function redistributeOnIncomeChange(
  items: AllocationItem[],
  newIncome: number
): AllocationItem[] {
  const { isEffectivelyLocked } = getEffectiveLockInfo(items);

  const lockedTotal = items.reduce(
    (sum, it) => sum + (isEffectivelyLocked(it) ? it.amount : 0),
    0
  );
  const pool = Math.max(0, newIncome - lockedTotal);

  const unlocked = items.filter((it) => !isEffectivelyLocked(it));
  const unlockedTotal = unlocked.reduce((sum, it) => sum + it.amount, 0);

  if (unlocked.length === 0) return items;

  let distributed: Map<string, number>;
  if (unlockedTotal === 0) {
    const equal = Math.floor((pool / unlocked.length) * 100) / 100;
    distributed = new Map(unlocked.map((it) => [it.id, equal]));
  } else {
    distributed = new Map(
      unlocked.map((it) => [
        it.id,
        Math.floor(((it.amount / unlockedTotal) * pool) * 100) / 100,
      ])
    );
  }

  const distributedSum = Array.from(distributed.values()).reduce(
    (a, b) => a + b,
    0
  );
  const diff = Math.round((pool - distributedSum) * 100) / 100;
  if (diff !== 0 && unlocked.length > 0) {
    const lastId = unlocked[unlocked.length - 1].id;
    distributed.set(lastId, (distributed.get(lastId) || 0) + diff);
  }

  return items.map((it) => {
    if (distributed.has(it.id))
      return { ...it, amount: Math.max(0, distributed.get(it.id)!) };
    return it;
  });
}

function reducer(state: AllocationState, action: Action): AllocationState {
  switch (action.type) {
    case "INIT": {
      const { data } = action;
      const income =
        data.monthly_income_override ?? data.suggested_monthly_income;

      const categoryItems: AllocationItem[] = data.categories
        .map((cat) => {
          const amount = cat.current_budget_amount ?? cat.average_monthly_spend;
          const fixed = isFixedExpense(cat.category_name);
          return {
            id: cat.category_id,
            type: "category" as const,
            name: cat.category_name,
            color: cat.category_color,
            icon: cat.category_icon,
            amount,
            isLocked: cat.is_locked || (fixed && amount > 0),
            averageSpend: cat.average_monthly_spend,
            budgetId: cat.budget_id ?? undefined,
            parentId: cat.parent_id,
          };
        })
        .sort((a, b) => b.amount - a.amount);

      const goalItems: AllocationItem[] = data.goals.map((goal) => ({
        id: goal.goal_id,
        type: "goal" as const,
        name: goal.name,
        color: goal.color,
        icon: null,
        amount: goal.planned_monthly_contribution ?? 0,
        isLocked: goal.planned_monthly_contribution != null,
        targetAmount: goal.target_amount,
        currentAmount: goal.current_amount,
        monthlyRate: goal.monthly_rate,
        targetDate: goal.target_date,
      }));

      const allItems = [...categoryItems, ...goalItems];
      const balanced = redistributeOnIncomeChange(allItems, income);
      return { income, items: balanced };
    }

    case "SET_INCOME": {
      const items = redistributeOnIncomeChange(state.items, action.income);
      return { income: action.income, items };
    }

    case "SET_SLIDER": {
      const items = redistribute(
        state.items,
        action.id,
        action.amount,
        state.income
      );
      return { ...state, items };
    }

    case "SET_MANUAL": {
      const items = redistribute(
        state.items,
        action.id,
        action.amount,
        state.income
      ).map((it) => (it.id === action.id ? { ...it, isLocked: true } : it));
      return { ...state, items };
    }

    case "SET_GROUP_AMOUNTS": {
      const updateMap = new Map(
        action.updates.map((u) => [u.id, u.amount])
      );
      return {
        ...state,
        items: state.items.map((it) =>
          updateMap.has(it.id)
            ? { ...it, amount: updateMap.get(it.id)! }
            : it
        ),
      };
    }

    case "TOGGLE_LOCK": {
      const toggled = state.items.map((it) =>
        it.id === action.id ? { ...it, isLocked: !it.isLocked } : it
      );
      const { isEffectivelyLocked } = getEffectiveLockInfo(toggled);

      const lockedTotal = toggled.reduce(
        (sum, it) => sum + (isEffectivelyLocked(it) ? it.amount : 0),
        0
      );
      const pool = Math.max(0, state.income - lockedTotal);
      const unlocked = toggled.filter((it) => !isEffectivelyLocked(it));
      const unlockedTotal = unlocked.reduce((sum, it) => sum + it.amount, 0);

      if (unlocked.length > 0 && unlockedTotal > 0) {
        const scale = pool / unlockedTotal;
        if (Math.abs(scale - 1) > 0.001) {
          const items = redistributeOnIncomeChange(toggled, state.income);
          return { ...state, items };
        }
      }

      return { ...state, items: toggled };
    }

    default:
      return state;
  }
}

export function useAllocationState() {
  const [state, dispatch] = useReducer(reducer, { income: 0, items: [] });

  const init = useCallback(
    (data: AllocationData) => dispatch({ type: "INIT", data }),
    []
  );
  const setIncome = useCallback(
    (income: number) => dispatch({ type: "SET_INCOME", income }),
    []
  );
  const setSlider = useCallback(
    (id: string, amount: number) =>
      dispatch({ type: "SET_SLIDER", id, amount }),
    []
  );
  const setManual = useCallback(
    (id: string, amount: number) =>
      dispatch({ type: "SET_MANUAL", id, amount }),
    []
  );
  const toggleLock = useCallback(
    (id: string) => dispatch({ type: "TOGGLE_LOCK", id }),
    []
  );
  const setGroupAmounts = useCallback(
    (updates: Array<{ id: string; amount: number }>) =>
      dispatch({ type: "SET_GROUP_AMOUNTS", updates }),
    []
  );

  const allocated = state.items.reduce((sum, it) => sum + it.amount, 0);
  const unallocated = Math.max(0, state.income - allocated);
  const lockedOverBudget =
    state.items.reduce(
      (sum, it) => sum + (it.isLocked ? it.amount : 0),
      0
    ) > state.income;

  return {
    income: state.income,
    items: state.items,
    allocated: Math.round(allocated * 100) / 100,
    unallocated: Math.round(unallocated * 100) / 100,
    lockedOverBudget,
    init,
    setIncome,
    setSlider,
    setManual,
    toggleLock,
    setGroupAmounts,
  };
}
