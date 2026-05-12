import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Category, CreateBudgetData } from "@/types/models";

interface BudgetFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBudgetData) => void;
  categories: Category[];
  initialData?: Partial<CreateBudgetData>;
}

export function BudgetForm({
  open,
  onClose,
  onSubmit,
  categories,
  initialData,
}: BudgetFormProps) {
  const expenseCategories = categories.filter((c) => !c.is_income);

  const [categoryId, setCategoryId] = useState(initialData?.category_id ?? "");
  const [name, setName] = useState(initialData?.name ?? "");
  const [amount, setAmount] = useState(initialData?.amount?.toString() ?? "");
  const [periodType, setPeriodType] = useState(
    initialData?.period_type ?? "monthly"
  );
  const [startDate, setStartDate] = useState(initialData?.start_date ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || !name || !amount || !startDate) return;

    onSubmit({
      category_id: categoryId,
      name,
      amount: parseFloat(amount),
      period_type: periodType,
      start_date: startDate,
    });
  }

  return (
    <Dialog open={open}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Budget" : "Create Budget"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="budget-category">Category</Label>
            <Select
              id="budget-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Select category</option>
              {expenseCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-name">Name</Label>
            <Input
              id="budget-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Monthly Groceries"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-amount">Amount</Label>
            <Input
              id="budget-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-period">Period</Label>
            <Select
              id="budget-period"
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-start">Start Date</Label>
            <Input
              id="budget-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? "Save Changes" : "Create Budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
