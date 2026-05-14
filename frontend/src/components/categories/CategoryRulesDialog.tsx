import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RuleList } from "@/components/categories/RuleList";
import { RuleForm } from "@/components/categories/RuleForm";
import { useRules } from "@/hooks/useCategorization";
import type { Category } from "@/types/models";

interface CategoryRulesDialogProps {
  category: Category;
  open: boolean;
  onClose: () => void;
}

export function CategoryRulesDialog({
  category,
  open,
  onClose,
}: CategoryRulesDialogProps) {
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editRuleId, setEditRuleId] = useState<string | null>(null);
  const { data: rules = [] } = useRules(category.id);

  const editRule = editRuleId
    ? rules.find((r) => r.id === editRuleId)
    : undefined;

  function handleEdit(ruleId: string) {
    setEditRuleId(ruleId);
    setRuleFormOpen(true);
  }

  function handleFormClose() {
    setRuleFormOpen(false);
    setEditRuleId(null);
  }

  return (
    <Dialog open={open}>
      <DialogContent onClose={onClose} className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Rules for {category.name}</DialogTitle>
            <Button
              size="sm"
              onClick={() => setRuleFormOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Rule
            </Button>
          </div>
        </DialogHeader>

        <RuleList categoryId={category.id} onEdit={handleEdit} />

        <RuleForm
          categoryId={category.id}
          rule={editRule}
          open={ruleFormOpen}
          onClose={handleFormClose}
        />
      </DialogContent>
    </Dialog>
  );
}
