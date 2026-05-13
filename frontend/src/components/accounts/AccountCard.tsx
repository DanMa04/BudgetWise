import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import type { Account } from "@/types/models";

interface AccountCardProps {
  account: Account;
}

function formatLastSynced(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function AccountCard({ account }: AccountCardProps) {
  const isLinked = !!account.plaid_item_id;
  const isNegative = account.current_balance < 0;

  return (
    <Card className="py-4">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{account.name}</h3>
            {account.institution_name && (
              <p className="text-sm text-muted-foreground">
                {account.institution_name}
              </p>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0 capitalize">
            {account.account_type}
          </Badge>
        </div>

        <div
          className={`text-2xl font-bold ${
            isNegative ? "text-red-500" : "text-green-600"
          }`}
        >
          {formatCurrency(account.current_balance)}
        </div>

        {isLinked && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Linked
            </span>
            {account.updated_at && (
              <span>Synced {formatLastSynced(account.updated_at)}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
