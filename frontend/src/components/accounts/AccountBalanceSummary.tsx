import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { Account } from "@/types/models";

interface AccountBalanceSummaryProps {
  accounts: Account[];
}

const ASSET_TYPES = ["checking", "savings", "investment"];
const LIABILITY_TYPES = ["credit", "credit_card", "loan"];

export function AccountBalanceSummary({
  accounts,
}: AccountBalanceSummaryProps) {
  const assets = accounts
    .filter((a) => ASSET_TYPES.includes(a.account_type))
    .reduce((sum, a) => sum + a.current_balance, 0);

  const liabilities = accounts
    .filter((a) => LIABILITY_TYPES.includes(a.account_type))
    .reduce((sum, a) => sum + Math.abs(a.current_balance), 0);

  const other = accounts
    .filter(
      (a) =>
        !ASSET_TYPES.includes(a.account_type) &&
        !LIABILITY_TYPES.includes(a.account_type)
    )
    .reduce((sum, a) => sum + a.current_balance, 0);

  const netWorth = assets + other - liabilities;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Net Worth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              netWorth < 0 ? "text-red-500" : "text-green-600"
            }`}
          >
            {formatCurrency(netWorth)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(assets + other)}
          </div>
          <p className="text-xs text-muted-foreground">
            Checking, savings, investments
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Liabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-500">
            {formatCurrency(liabilities)}
          </div>
          <p className="text-xs text-muted-foreground">Credit cards, loans</p>
        </CardContent>
      </Card>
    </div>
  );
}
