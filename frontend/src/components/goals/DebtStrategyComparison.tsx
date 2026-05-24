import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { DebtStrategyChart } from "@/components/charts/DebtStrategyChart";
import { useAccounts } from "@/hooks/useAccounts";
import { useMultiDebtStrategy } from "@/hooks/useProjections";

export function DebtStrategyComparison() {
  const { data: accounts } = useAccounts();
  const [budgetOverride, setBudgetOverride] = useState<number | null>(null);

  const debtAccounts = accounts?.filter(
    (a) => a.account_type === "loan" || a.account_type === "credit"
  );

  const { data, isLoading, isError } = useMultiDebtStrategy(budgetOverride);

  if (!debtAccounts || debtAccounts.length < 2) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Debt Payoff Strategy</h2>
          <p className="text-sm text-muted-foreground">
            Compare snowball vs avalanche across {debtAccounts.length} debts
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="strategy-budget" className="text-xs">
            Monthly budget override
          </Label>
          <div className="relative w-36">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="strategy-budget"
              type="number"
              min={0}
              step={100}
              value={budgetOverride ?? ""}
              onChange={(e) =>
                setBudgetOverride(
                  e.target.value ? parseFloat(e.target.value) : null
                )
              }
              className="pl-6"
              placeholder="Auto"
            />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <Spinner className="h-6 w-6" />
          ) : isError ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Unable to load strategy comparison. Make sure your debt accounts
              have interest rates and minimum payments set.
            </p>
          ) : data ? (
            <DebtStrategyChart data={data} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
