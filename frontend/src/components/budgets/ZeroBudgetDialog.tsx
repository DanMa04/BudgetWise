import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useAllocationData, useSaveBulkBudget } from "@/hooks/useBudgets";
import { useAllocationState } from "./useAllocationState";
import { IncomeHeader } from "./IncomeHeader";
import { AllocationGrid } from "./AllocationGrid";
import { AllocationSummaryBar } from "./AllocationSummaryBar";
import type { BulkBudgetSave } from "@/types/models";

interface ZeroBudgetDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ZeroBudgetDialog({ open, onClose }: ZeroBudgetDialogProps) {
  const { data, isLoading } = useAllocationData();
  const saveMutation = useSaveBulkBudget();
  const {
    income,
    items,
    allocated,
    unallocated,
    lockedOverBudget,
    init,
    setIncome,
    setSlider,
    setManual,
    toggleLock,
    setGroupAmounts,
  } = useAllocationState();

  useEffect(() => {
    if (data && open) {
      init(data);
    }
  }, [data, open, init]);

  function handleSave() {
    const parentIds = new Set(
      items.filter((it) => it.parentId).map((it) => it.parentId!)
    );
    const payload: BulkBudgetSave = {
      monthly_income: income,
      period_type: "monthly",
      allocations: items
        .filter((it) => it.type === "category" && !parentIds.has(it.id))
        .map((it) => ({
          category_id: it.id,
          amount: it.amount,
          is_locked: it.isLocked,
        })),
      goal_contributions: items
        .filter((it) => it.type === "goal")
        .map((it) => ({
          goal_id: it.id,
          monthly_amount: it.amount,
        })),
    };
    saveMutation.mutate(payload, { onSuccess: onClose });
  }

  return (
    <Dialog open={open}>
      <DialogContent
        onClose={onClose}
        className="max-h-[90vh] max-w-5xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Zero-Based Budget</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <div className="space-y-6">
            <IncomeHeader
              income={income}
              allocated={allocated}
              unallocated={unallocated}
              lockedOverBudget={lockedOverBudget}
              onIncomeChange={setIncome}
            />

            <AllocationSummaryBar items={items} income={income} />

            <AllocationGrid
              items={items}
              income={income}
              onSliderChange={setSlider}
              onManualEntry={setManual}
              onToggleLock={toggleLock}
              onSetGroupAmounts={setGroupAmounts}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending || isLoading}
          >
            {saveMutation.isPending ? "Saving..." : "Save Budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
