import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { RETURN_RATE_PRESETS } from "@/lib/projections";
import type { Account } from "@/types/models";

interface AccountCardProps {
  account: Account;
  onClick?: () => void;
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

export function AccountCard({ account, onClick }: AccountCardProps) {
  const isLinked = !!account.plaid_item_id;
  const isDebt = account.account_type === "loan" || account.account_type === "credit";
  const isInvestment = account.account_type === "investment";
  const isNegative = account.current_balance < 0;

  return (
    <Card
      className={`py-4 ${onClick ? "cursor-pointer transition-colors hover:bg-muted/50" : ""}`}
      onClick={onClick}
    >
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
            isDebt || isNegative ? "text-red-500" : "text-green-600"
          }`}
        >
          {formatCurrency(isDebt ? Math.abs(account.current_balance) : account.current_balance)}
        </div>

        {isDebt && account.interest_rate != null && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{account.interest_rate}% APR</span>
            {account.minimum_payment != null && (
              <>
                <span>·</span>
                <span>{formatCurrency(account.minimum_payment)}/mo min</span>
              </>
            )}
          </div>
        )}

        {isInvestment && account.return_rate_preset && (
          <div className="text-xs text-muted-foreground">
            {RETURN_RATE_PRESETS[account.return_rate_preset]?.label ??
              `${account.custom_return_rate ?? 0}% return`}
          </div>
        )}

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
