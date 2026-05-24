import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { InvestmentGrowthChart } from "@/components/charts/InvestmentGrowthChart";
import { useInvestmentProjection } from "@/hooks/useProjections";
import { formatCurrency } from "@/lib/formatters";
import { RETURN_RATE_PRESETS } from "@/lib/projections";
import type { Account } from "@/types/models";

interface InvestmentAccountDetailProps {
  account: Account;
  open: boolean;
  onClose: () => void;
}

export function InvestmentAccountDetail({
  account,
  open,
  onClose,
}: InvestmentAccountDetailProps) {
  const [contribution, setContribution] = useState<number | null>(null);
  const { data, isLoading, isError } = useInvestmentProjection(
    account.id,
    contribution
  );

  const presetInfo = account.return_rate_preset
    ? RETURN_RATE_PRESETS[account.return_rate_preset]
    : null;
  const rateLabel = presetInfo
    ? presetInfo.label
    : account.custom_return_rate != null
      ? `Custom (${account.custom_return_rate}%)`
      : "No rate set";

  return (
    <Dialog open={open}>
      <DialogContent onClose={onClose} className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">Balance</div>
            <div className="font-semibold text-green-600">
              {formatCurrency(account.current_balance)}
            </div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">Return Rate</div>
            <div className="font-semibold">{rateLabel}</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">Institution</div>
            <div className="font-semibold">
              {account.institution_name || "—"}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="monthly-contribution">Monthly Contribution</Label>
          <div className="relative w-40">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="monthly-contribution"
              type="number"
              min={0}
              step={50}
              value={contribution ?? ""}
              onChange={(e) =>
                setContribution(
                  e.target.value ? parseFloat(e.target.value) : null
                )
              }
              className="pl-6"
              placeholder="From budget"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Unable to load projection data.
          </div>
        ) : data ? (
          <InvestmentGrowthChart
            projection={data.projection}
            balance5y={data.balance_5y}
            balance10y={data.balance_10y}
            balance20y={data.balance_20y}
            balance30y={data.balance_30y}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
