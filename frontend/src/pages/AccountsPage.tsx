import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AccountList } from "@/components/accounts/AccountList";
import { AccountLinkFlow } from "@/components/accounts/AccountLinkFlow";
import { AccountBalanceSummary } from "@/components/accounts/AccountBalanceSummary";
import { AccountSyncButton } from "@/components/accounts/AccountSyncButton";
import { useAccounts, useCreateAccount } from "@/hooks/useAccounts";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit Card" },
  { value: "investment", label: "Investment" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
];

const RETURN_PRESETS = [
  { value: "sp500", label: "S&P 500 avg (10%)" },
  { value: "bond", label: "Bond fund (4%)" },
  { value: "conservative", label: "Conservative (6%)" },
  { value: "aggressive", label: "Aggressive (12%)" },
  { value: "custom", label: "Custom" },
];

interface FormData {
  name: string;
  account_type: string;
  institution_name: string;
  current_balance: string;
  interest_rate: string;
  original_balance: string;
  minimum_payment: string;
  loan_term_months: string;
  loan_start_date: string;
  return_rate_preset: string;
  custom_return_rate: string;
}

const EMPTY_FORM: FormData = {
  name: "",
  account_type: "checking",
  institution_name: "",
  current_balance: "",
  interest_rate: "",
  original_balance: "",
  minimum_payment: "",
  loan_term_months: "",
  loan_start_date: "",
  return_rate_preset: "sp500",
  custom_return_rate: "",
};

export function AccountsPage() {
  const [linkOpen, setLinkOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const { data: accounts } = useAccounts();
  const createAccount = useCreateAccount();
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });

  const isDebt = formData.account_type === "loan" || formData.account_type === "credit";
  const isInvestment = formData.account_type === "investment";

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    createAccount.mutate(
      {
        name: formData.name,
        account_type: formData.account_type,
        institution_name: formData.institution_name || undefined,
        current_balance: formData.current_balance
          ? parseFloat(formData.current_balance)
          : 0,
        ...(isDebt && {
          interest_rate: formData.interest_rate
            ? parseFloat(formData.interest_rate)
            : undefined,
          original_balance: formData.original_balance
            ? parseFloat(formData.original_balance)
            : undefined,
          minimum_payment: formData.minimum_payment
            ? parseFloat(formData.minimum_payment)
            : undefined,
          loan_term_months: formData.loan_term_months
            ? parseInt(formData.loan_term_months)
            : undefined,
          loan_start_date: formData.loan_start_date || undefined,
        }),
        ...(isInvestment && {
          return_rate_preset: formData.return_rate_preset || undefined,
          custom_return_rate:
            formData.return_rate_preset === "custom" && formData.custom_return_rate
              ? parseFloat(formData.custom_return_rate)
              : undefined,
        }),
      },
      {
        onSuccess: () => {
          setManualOpen(false);
          setFormData({ ...EMPTY_FORM });
        },
      }
    );
  }

  function update(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">
            Manage your bank accounts, debts, and investments.
          </p>
        </div>
        <div className="flex gap-2">
          <AccountSyncButton />
          <Button variant="outline" onClick={() => setManualOpen(true)}>
            Add Manual
          </Button>
          <Button onClick={() => setLinkOpen(true)}>Link Bank</Button>
        </div>
      </div>

      {accounts && accounts.length > 0 && (
        <AccountBalanceSummary accounts={accounts} />
      )}

      <AccountList />

      <AccountLinkFlow open={linkOpen} onClose={() => setLinkOpen(false)} />

      <Dialog open={manualOpen}>
        <DialogContent onClose={() => setManualOpen(false)} className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Manual Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-name">Account Name</Label>
              <Input
                id="account-name"
                placeholder="e.g. My Checking"
                value={formData.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-type">Account Type</Label>
              <Select
                id="account-type"
                value={formData.account_type}
                onChange={(e) => update("account_type", e.target.value)}
              >
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="institution-name">
                Institution Name (optional)
              </Label>
              <Input
                id="institution-name"
                placeholder="e.g. Chase Bank"
                value={formData.institution_name}
                onChange={(e) => update("institution_name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="opening-balance">
                {isDebt ? "Current Balance Owed" : "Opening Balance"}
              </Label>
              <Input
                id="opening-balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.current_balance}
                onChange={(e) => update("current_balance", e.target.value)}
              />
            </div>

            {/* Debt-specific fields */}
            {isDebt && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interest-rate">Interest Rate (%)</Label>
                    <Input
                      id="interest-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="6.5"
                      value={formData.interest_rate}
                      onChange={(e) => update("interest_rate", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min-payment">Min Monthly Payment</Label>
                    <Input
                      id="min-payment"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="1580"
                      value={formData.minimum_payment}
                      onChange={(e) => update("minimum_payment", e.target.value)}
                    />
                  </div>
                </div>

                {formData.account_type === "loan" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="original-balance">
                        Original Loan Amount
                      </Label>
                      <Input
                        id="original-balance"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="250000"
                        value={formData.original_balance}
                        onChange={(e) =>
                          update("original_balance", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loan-term">Loan Term (months)</Label>
                      <Input
                        id="loan-term"
                        type="number"
                        min="1"
                        placeholder="360"
                        value={formData.loan_term_months}
                        onChange={(e) =>
                          update("loan_term_months", e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}

                {formData.account_type === "loan" && (
                  <div className="space-y-2">
                    <Label htmlFor="loan-start">Loan Start Date</Label>
                    <Input
                      id="loan-start"
                      type="date"
                      value={formData.loan_start_date}
                      onChange={(e) =>
                        update("loan_start_date", e.target.value)
                      }
                    />
                  </div>
                )}
              </>
            )}

            {/* Investment-specific fields */}
            {isInvestment && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="return-preset">Expected Return Rate</Label>
                  <Select
                    id="return-preset"
                    value={formData.return_rate_preset}
                    onChange={(e) => update("return_rate_preset", e.target.value)}
                  >
                    {RETURN_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {formData.return_rate_preset === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-return">Custom Return Rate (%)</Label>
                    <Input
                      id="custom-return"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="8.0"
                      value={formData.custom_return_rate}
                      onChange={(e) =>
                        update("custom_return_rate", e.target.value)
                      }
                    />
                  </div>
                )}
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setManualOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createAccount.isPending}>
                {createAccount.isPending ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
