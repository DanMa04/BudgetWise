import { useState } from "react";
import { Pencil, Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateTransferRule,
  useDeleteTransferRule,
  useTransferRules,
  useUpdateTransferRule,
} from "@/hooks/useTransferRules";
import { useRescanTransactions } from "@/hooks/useCategorization";
import type {
  Category,
  TransferRule,
  TransferRuleMatchType,
} from "@/types/models";

interface TransferRulesDialogProps {
  open: boolean;
  onClose: () => void;
  sourceCategory: Category;
  allCategories: Category[];
}

interface FormState {
  name: string;
  target_category_id: string;
  amount_exact: string;
  amount_min: string;
  amount_max: string;
  day_of_month: string;
  day_tolerance: string;
  counterparty_pattern: string;
  counterparty_match_type: TransferRuleMatchType;
  match_all_categories: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  target_category_id: "",
  amount_exact: "",
  amount_min: "",
  amount_max: "",
  day_of_month: "",
  day_tolerance: "2",
  counterparty_pattern: "",
  counterparty_match_type: "contains",
  match_all_categories: false,
};

function formFromRule(rule: TransferRule): FormState {
  return {
    name: rule.name,
    target_category_id: rule.target_category_id,
    amount_exact: rule.amount_exact != null ? String(rule.amount_exact) : "",
    amount_min: rule.amount_min != null ? String(rule.amount_min) : "",
    amount_max: rule.amount_max != null ? String(rule.amount_max) : "",
    day_of_month: rule.day_of_month != null ? String(rule.day_of_month) : "",
    day_tolerance: String(rule.day_tolerance ?? 2),
    counterparty_pattern: rule.counterparty_pattern ?? "",
    counterparty_match_type: rule.counterparty_match_type ?? "contains",
    match_all_categories: rule.match_all_categories ?? false,
  };
}

export function TransferRulesDialog({
  open,
  onClose,
  sourceCategory,
  allCategories,
}: TransferRulesDialogProps) {
  const { data: rules = [] } = useTransferRules(sourceCategory.id);
  const createRule = useCreateTransferRule();
  const updateRule = useUpdateTransferRule();
  const deleteRule = useDeleteTransferRule();
  const rescan = useRescanTransactions();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const targetCategories = allCategories.filter(
    (c) => c.id !== sourceCategory.id && !c.is_income
  );

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(rule: TransferRule) {
    setForm(formFromRule(rule));
    setEditingId(rule.id);
    setShowForm(true);
  }

  const formPayload = () => ({
    target_category_id: form.target_category_id,
    name: form.name,
    amount_exact: form.amount_exact ? parseFloat(form.amount_exact) : null,
    amount_min: form.amount_min ? parseFloat(form.amount_min) : null,
    amount_max: form.amount_max ? parseFloat(form.amount_max) : null,
    day_of_month: form.day_of_month ? parseInt(form.day_of_month) : null,
    day_tolerance: parseInt(form.day_tolerance) || 2,
    counterparty_pattern: form.counterparty_pattern || null,
    counterparty_match_type: form.counterparty_match_type,
    match_all_categories: form.match_all_categories,
  });

  function handleSubmit(applyAfter: boolean) {
    if (!form.name || !form.target_category_id) return;

    if (editingId) {
      updateRule.mutate(
        { id: editingId, data: formPayload() },
        {
          onSuccess: () => {
            resetForm();
            if (applyAfter) rescan.mutate(sourceCategory.id);
          },
        }
      );
    } else {
      createRule.mutate(
        { source_category_id: sourceCategory.id, ...formPayload() },
        {
          onSuccess: () => {
            resetForm();
            if (applyAfter) rescan.mutate(sourceCategory.id);
          },
        }
      );
    }
  }

  function toggleActive(rule: TransferRule) {
    updateRule.mutate({ id: rule.id, data: { is_active: !rule.is_active } });
  }

  const submitPending = createRule.isPending || updateRule.isPending;
  const submitLabel = editingId
    ? (updateRule.isPending ? "Saving..." : "Save Changes")
    : (createRule.isPending ? "Creating..." : "Create Rule");

  return (
    <Dialog open={open}>
      <DialogContent
        onClose={onClose}
        className="max-h-[85vh] max-w-lg overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            <span
              className="mr-2 inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: sourceCategory.color || "#6b7280" }}
            />
            {sourceCategory.name} — Transfer Rules
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Automatically re-categorize {sourceCategory.name} transfers based on
          amount, date, or counterparty.
        </p>

        {rescan.isSuccess && rescan.data && (
          <p className="text-xs text-muted-foreground bg-muted rounded-md px-2.5 py-1.5">
            Re-scan complete: {rescan.data.updated} of {rescan.data.scanned} transactions updated.
          </p>
        )}

        {rules.length > 0 && (
          <div className="space-y-2">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                categories={allCategories}
                onToggle={() => toggleActive(rule)}
                onEdit={() => startEdit(rule)}
                onDelete={() => deleteRule.mutate(rule.id)}
                isEditing={editingId === rule.id}
              />
            ))}
          </div>
        )}

        {rules.length === 0 && !showForm && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No transfer rules yet. Add one to auto-categorize transfers.
          </p>
        )}

        {showForm ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(false);
            }}
            className="space-y-3 rounded-lg border p-3"
          >
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">
                {editingId ? "Edit rule" : "New rule"}
              </p>
              {editingId && (
                <p className="text-xs text-muted-foreground">
                  Changes apply to future scans.
                </p>
              )}
            </div>

            <div>
              <Label>Rule name</Label>
              <Input
                placeholder="e.g., Rent from roommate"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Re-categorize to</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.target_category_id}
                onChange={(e) =>
                  setForm({ ...form, target_category_id: e.target.value })
                }
              >
                <option value="">Select category...</option>
                {targetCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Exact amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="150.00"
                  value={form.amount_exact}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amount_exact: e.target.value,
                      amount_min: "",
                      amount_max: "",
                    })
                  }
                />
              </div>
              <div>
                <Label>Min amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="20.00"
                  value={form.amount_min}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amount_min: e.target.value,
                      amount_exact: "",
                    })
                  }
                />
              </div>
              <div>
                <Label>Max amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="50.00"
                  value={form.amount_max}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amount_max: e.target.value,
                      amount_exact: "",
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Day of month</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="1"
                  value={form.day_of_month}
                  onChange={(e) =>
                    setForm({ ...form, day_of_month: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Day tolerance (±)</Label>
                <Input
                  type="number"
                  min="0"
                  max="15"
                  value={form.day_tolerance}
                  onChange={(e) =>
                    setForm({ ...form, day_tolerance: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_140px] gap-2">
              <div>
                <Label>Description / counterparty</Label>
                <Input
                  placeholder="e.g., Jane Doe"
                  value={form.counterparty_pattern}
                  onChange={(e) =>
                    setForm({ ...form, counterparty_pattern: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Match type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.counterparty_match_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      counterparty_match_type: e.target.value as TransferRuleMatchType,
                    })
                  }
                >
                  <option value="contains">Contains</option>
                  <option value="exact">Exact match</option>
                </select>
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.match_all_categories}
                onChange={(e) =>
                  setForm({ ...form, match_all_categories: e.target.checked })
                }
              />
              <div>
                <div className="font-medium">Match across all categories</div>
                <div className="text-xs text-muted-foreground">
                  When off, this rule only applies to transactions already in{" "}
                  <span className="font-medium">{sourceCategory.name}</span>.
                  Turn on to match by description/amount/date regardless of
                  current category — useful when transactions are still
                  uncategorized.
                </div>
              </div>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={
                  !form.name || !form.target_category_id || submitPending
                }
              >
                {submitLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={
                  !form.name ||
                  !form.target_category_id ||
                  submitPending ||
                  rescan.isPending
                }
                onClick={() => handleSubmit(true)}
              >
                {rescan.isPending
                  ? "Scanning..."
                  : editingId
                    ? "Save & Apply"
                    : "Create & Apply"}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={startCreate}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Transfer Rule
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RuleCard({
  rule,
  categories,
  onToggle,
  onEdit,
  onDelete,
  isEditing,
}: {
  rule: TransferRule;
  categories: Category[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
}) {
  const target = categories.find((c) => c.id === rule.target_category_id);

  const conditions: string[] = [];
  if (rule.amount_exact != null) conditions.push(`=$${rule.amount_exact}`);
  if (rule.amount_min != null || rule.amount_max != null) {
    const min = rule.amount_min != null ? `$${rule.amount_min}` : "any";
    const max = rule.amount_max != null ? `$${rule.amount_max}` : "any";
    conditions.push(`${min}–${max}`);
  }
  if (rule.day_of_month != null)
    conditions.push(`day ${rule.day_of_month}±${rule.day_tolerance}`);
  if (rule.counterparty_pattern) {
    const op =
      rule.counterparty_match_type === "exact" ? "=" : "contains";
    conditions.push(`desc ${op} "${rule.counterparty_pattern}"`);
  }
  if (rule.match_all_categories) {
    conditions.push("any category");
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border p-2.5 ${
        rule.is_active ? "" : "opacity-50"
      } ${isEditing ? "ring-2 ring-primary" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{rule.name}</span>
          <span className="text-xs text-muted-foreground">
            → {target?.name ?? "Unknown"}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {conditions.length > 0 ? conditions.join(" · ") : "No conditions (matches all)"}
          {rule.match_count > 0 && (
            <span className="ml-1.5">({rule.match_count} matched)</span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onEdit}
        title="Edit"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onToggle}
        title={rule.is_active ? "Disable" : "Enable"}
      >
        {rule.is_active ? (
          <ToggleRight className="h-4 w-4 text-green-600" />
        ) : (
          <ToggleLeft className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
