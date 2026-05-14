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
import { useCreateRule, useUpdateRule } from "@/hooks/useCategorization";
import type { CategorizationRule } from "@/types/models";

interface RuleFormProps {
  categoryId: string;
  rule?: CategorizationRule;
  open: boolean;
  onClose: () => void;
}

export function RuleForm({ categoryId, rule, open, onClose }: RuleFormProps) {
  const [pattern, setPattern] = useState(rule?.pattern ?? "");
  const [ruleType, setRuleType] = useState(rule?.rule_type ?? "contains");
  const [priority, setPriority] = useState(
    rule?.priority?.toString() ?? "0"
  );

  const createRule = useCreateRule();
  const updateRule = useUpdateRule();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pattern) return;

    if (rule) {
      updateRule.mutate(
        {
          id: rule.id,
          data: {
            pattern,
            rule_type: ruleType,
            priority: parseInt(priority, 10),
          },
        },
        { onSuccess: onClose }
      );
    } else {
      createRule.mutate(
        {
          category_id: categoryId,
          pattern,
          rule_type: ruleType,
          priority: parseInt(priority, 10),
        },
        { onSuccess: onClose }
      );
    }
  }

  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <Dialog open={open}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>{rule ? "Edit Rule" : "Add Rule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-pattern">Pattern</Label>
            <Input
              id="rule-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g., WALMART or grocery"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-type">Type</Label>
            <Select
              id="rule-type"
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value)}
            >
              <option value="exact">Exact</option>
              <option value="contains">Contains</option>
              <option value="starts_with">Starts With</option>
              <option value="regex">Regex</option>
              <option value="merchant">Merchant</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-priority">Priority</Label>
            <Input
              id="rule-priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              min={0}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : rule ? "Save Changes" : "Add Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
