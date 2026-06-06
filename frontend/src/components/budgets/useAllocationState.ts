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
  linkedAccountType?: string;
  linkedAccountRate?: number;
  linkedAccountBalance?: number;
  minimumPayment?: number;
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Goal-first redistribution.
 *
 * When the user adjusts a CATEGORY:
 *   - Reducing it: the freed amount is spread evenly to unlocked goals so
 *     funds preferentially become savings rather than other discretionary
 *     spend.
 *   - Increasing it: if the new total stays at or under income, the
 *     change just eats into the unallocated pool. Goals are untouched.
 *     Only when the increase would push total > income do we pull the
 *     overflow proportionally from unlocked goals.
 *
 * When the user adjusts a GOAL, we fall back to the original symmetric
 * redistribution across unlocked siblings — they're directly managing
 * the goal so the goal-protection rule doesn't apply.
 */
function redistribute(
  items: AllocationItem[],
  changedId: string,
  newAmount: number,
  income: number
): AllocationItem[] {
  const { isEffectivelyLocked } = getEffectiveLockInfo(items);
  const changedItem = items.find((it) => it.id === changedId);
  if (!changedItem) return items;

  if (changedItem.type === "goal") {
    return redistributeSymmetric(items, changedId, newAmount, income);
  }

  const unlockedGoals = items.filter(
    (it) => it.type === "goal" && !isEffectivelyLocked(it)
  );
  const goalsCapacity = unlockedGoals.reduce((s, g) => s + g.amount, 0);

  // Clamp upper bound to: income + everything we could reclaim from
  // unlocked goals. If the user tries to go above that, the budget would
  // be over even with all goals zeroed — so we just refuse the extra.
  const otherTotal = items.reduce(
    (s, it) => (it.id === changedId ? s : s + it.amount),
    0
  );
  const upperBound = Math.max(0, income - (otherTotal - goalsCapacity));
  const clamped = Math.max(0, Math.min(newAmount, upperBound));

  const delta = clamped - changedItem.amount;
  if (Math.abs(delta) < 0.005) {
    return items.map((it) =>
      it.id === changedId ? { ...it, amount: clamped } : it
    );
  }

  if (delta < 0) {
    // Reduction → spread freed funds evenly across unlocked goals.
    if (unlockedGoals.length === 0) {
      // No goals — freed amount becomes unallocated.
      return items.map((it) =>
        it.id === changedId ? { ...it, amount: clamped } : it
      );
    }
    const freed = -delta;
    const perGoal = round2(freed / unlockedGoals.length);
    const goalIds = new Set(unlockedGoals.map((g) => g.id));
    // Apply a residual to the last goal so the math sums exactly.
    const residual = round2(freed - perGoal * unlockedGoals.length);
    const lastGoalId = unlockedGoals[unlockedGoals.length - 1].id;
    return items.map((it) => {
      if (it.id === changedId) return { ...it, amount: clamped };
      if (!goalIds.has(it.id)) return it;
      const add = perGoal + (it.id === lastGoalId ? residual : 0);
      return { ...it, amount: round2(it.amount + add) };
    });
  }

  // Increase. Compute whether it fits within unallocated headroom.
  const newTotal = otherTotal + clamped;
  if (newTotal <= income + 0.005) {
    // Plenty of room — just set it, unallocated absorbs the change.
    return items.map((it) =>
      it.id === changedId ? { ...it, amount: clamped } : it
    );
  }

  // Overflow — pull proportionally from unlocked goals.
  const overflow = newTotal - income;
  if (unlockedGoals.length === 0 || goalsCapacity <= 0) {
    // No goals available to pull from. Allow the over-budget state so
    // the UI's "over budget" indicator can flag it.
    return items.map((it) =>
      it.id === changedId ? { ...it, amount: clamped } : it
    );
  }
  const totalGoalAmount = goalsCapacity;
  const goalDeltas = new Map<string, number>();
  let absorbed = 0;
  for (const goal of unlockedGoals) {
    const share = (goal.amount / totalGoalAmount) * overflow;
    const reduction = Math.min(goal.amount, share);
    goalDeltas.set(goal.id, reduction);
    absorbed += reduction;
  }
  // Any residual (due to a goal being clamped at 0) gets pulled from
  // remaining goals with capacity.
  let remaining = round2(overflow - absorbed);
  while (remaining > 0.005) {
    const withCapacity = unlockedGoals.filter(
      (g) => g.amount - (goalDeltas.get(g.id) ?? 0) > 0.005
    );
    if (withCapacity.length === 0) break;
    const each = remaining / withCapacity.length;
    for (const g of withCapacity) {
      const already = goalDeltas.get(g.id) ?? 0;
      const cap = g.amount - already;
      const take = Math.min(each, cap);
      goalDeltas.set(g.id, already + take);
      remaining = round2(remaining - take);
    }
  }
  return items.map((it) => {
    if (it.id === changedId) return { ...it, amount: clamped };
    if (goalDeltas.has(it.id)) {
      const reduced = round2(it.amount - (goalDeltas.get(it.id) ?? 0));
      return { ...it, amount: Math.max(0, reduced) };
    }
    return it;
  });
}

/**
 * Original symmetric redistribution. Used when the user directly adjusts
 * a goal — in that case we preserve the prior behavior of spreading the
 * delta proportionally across unlocked siblings.
 */
function redistributeSymmetric(
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
        linkedAccountType: goal.linked_account_type ?? undefined,
        linkedAccountRate: goal.linked_account_rate ?? undefined,
        linkedAccountBalance: goal.linked_account_balance ?? undefined,
        minimumPayment: goal.linked_account_minimum_payment ?? undefined,
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
