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

export function AccountsPage() {
  const [linkOpen, setLinkOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const { data: accounts } = useAccounts();
  const createAccount = useCreateAccount();

  const [formData, setFormData] = useState({
    name: "",
    account_type: "checking",
    institution_name: "",
    current_balance: "",
  });

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
      },
      {
        onSuccess: () => {
          setManualOpen(false);
          setFormData({
            name: "",
            account_type: "checking",
            institution_name: "",
            current_balance: "",
          });
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">
            Manage your bank accounts and connections.
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
        <DialogContent onClose={() => setManualOpen(false)}>
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
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-type">Account Type</Label>
              <Select
                id="account-type"
                value={formData.account_type}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    account_type: e.target.value,
                  }))
                }
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
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    institution_name: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="opening-balance">Opening Balance</Label>
              <Input
                id="opening-balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.current_balance}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    current_balance: e.target.value,
                  }))
                }
              />
            </div>

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
