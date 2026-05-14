import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRules, useDeleteRule } from "@/hooks/useCategorization";

interface RuleListProps {
  categoryId: string;
  onEdit?: (ruleId: string) => void;
}

const ruleTypeColors: Record<string, string> = {
  exact: "bg-purple-100 text-purple-700 border-purple-200",
  contains: "bg-blue-100 text-blue-700 border-blue-200",
  starts_with: "bg-cyan-100 text-cyan-700 border-cyan-200",
  regex: "bg-orange-100 text-orange-700 border-orange-200",
  merchant: "bg-green-100 text-green-700 border-green-200",
};

export function RuleList({ categoryId, onEdit }: RuleListProps) {
  const { data: rules = [], isLoading } = useRules(categoryId);
  const deleteRule = useDeleteRule();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8">
        <p className="text-sm font-medium text-muted-foreground">
          No rules yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Rules are created when you correct transaction categories.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Pattern
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Type
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Priority
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Matches
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Created By
            </th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr
              key={rule.id}
              className="border-b last:border-0 hover:bg-muted/30"
            >
              <td className="px-4 py-2 font-mono text-xs">
                {rule.pattern}
              </td>
              <td className="px-4 py-2">
                <Badge
                  className={
                    ruleTypeColors[rule.rule_type] ??
                    "bg-gray-100 text-gray-700 border-gray-200"
                  }
                >
                  {rule.rule_type}
                </Badge>
              </td>
              <td className="px-4 py-2">{rule.priority}</td>
              <td className="px-4 py-2">{rule.match_count}</td>
              <td className="px-4 py-2 capitalize">{rule.created_by}</td>
              <td className="px-4 py-2 text-right">
                <div className="flex justify-end gap-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(rule.id)}
                      aria-label={`Edit rule ${rule.pattern}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteRule.mutate(rule.id)}
                    aria-label={`Delete rule ${rule.pattern}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
