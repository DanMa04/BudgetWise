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
import { AmortizationChart } from "@/components/charts/AmortizationChart";
import { useDebtProjection } from "@/hooks/useProjections";
import { formatCurrency } from "@/lib/formatters";
import type { Account } from "@/types/models";

interface DebtAccountDetailProps {
  account: Account;
  open: boolean;
  onClose: () => void;
}

export function DebtAccountDetail({
  account,
  open,
  onClose,
}: DebtAccountDetailProps) {
  const [extraPayment, setExtraPayment] = useState(0);
  const { data, isLoading, isError } = useDebtProjection(
    account.id,
    extraPayment
  );

  const hasRequiredFields =
    account.interest_rate != null &&
    account.minimum_payment != null &&
    account.current_balance > 0;

  return (
    <Dialog open={open}>
      <DialogContent onClose={onClose} className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">Balance</div>
            <div className="font-semibold text-red-500">
              {formatCurrency(account.current_balance)}
            </div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">Rate</div>
            <div className="font-semibold">
              {account.interest_rate != null
                ? `${account.interest_rate}%`
                : "—"}
            </div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">Min Payment</div>
            <div className="font-semibold">
              {account.minimum_payment != null
                ? formatCurrency(account.minimum_payment)
                : "—"}
            </div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">Original</div>
            <div className="font-semibold">
              {account.original_balance != null
                ? formatCurrency(account.original_balance)
                : "—"}
            </div>
          </div>
        </div>

        {!hasRequiredFields ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Add interest rate and minimum payment to see payoff projections.
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="extra-payment">Extra Monthly Payment</Label>
              <div className="relative w-40">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="extra-payment"
                  type="number"
                  min={0}
                  step={50}
                  value={extraPayment || ""}
                  onChange={(e) =>
                    setExtraPayment(parseFloat(e.target.value) || 0)
                  }
                  className="pl-6"
                  placeholder="0"
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
              <>
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">
                      Payoff (min only):{" "}
                    </span>
                    <span className="font-medium">{data.payoff_date_min}</span>
                  </div>
                  {extraPayment > 0 && data.payoff_date_extra && (
                    <div>
                      <span className="text-muted-foreground">
                        With extra:{" "}
                      </span>
                      <span className="font-medium text-green-600">
                        {data.payoff_date_extra}
                      </span>
                    </div>
                  )}
                </div>

                <AmortizationChart
                  scheduleMinOnly={data.schedule_min_only}
                  scheduleWithExtra={
                    extraPayment > 0 ? data.schedule_with_extra : []
                  }
                  monthsSaved={data.months_saved}
                  interestSaved={data.interest_saved}
                />
              </>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
