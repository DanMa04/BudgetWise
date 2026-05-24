import { useState } from "react";
import { useAccounts } from "@/hooks/useAccounts";
import { AccountCard } from "@/components/accounts/AccountCard";
import { DebtAccountDetail } from "@/components/accounts/DebtAccountDetail";
import { InvestmentAccountDetail } from "@/components/accounts/InvestmentAccountDetail";
import { Card, CardContent } from "@/components/ui/card";
import type { Account } from "@/types/models";

function AccountListSkeleton() {
  return (
    <div className="space-y-6" data-testid="account-list-skeleton">
      {[1, 2].map((group) => (
        <div key={group} className="space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((card) => (
              <Card key={card} className="py-4">
                <CardContent className="space-y-3">
                  <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const TYPE_GROUPS: Array<{ label: string; types: string[] }> = [
  { label: "Cash Accounts", types: ["checking", "savings"] },
  { label: "Debt Accounts", types: ["loan", "credit"] },
  { label: "Investment Accounts", types: ["investment"] },
  { label: "Other", types: ["other"] },
];

function groupByType(accounts: Account[]): Array<{ label: string; accounts: Account[] }> {
  const groups: Array<{ label: string; accounts: Account[] }> = [];
  const placed = new Set<string>();

  for (const group of TYPE_GROUPS) {
    const matching = accounts.filter((a) => group.types.includes(a.account_type));
    if (matching.length > 0) {
      groups.push({ label: group.label, accounts: matching });
      matching.forEach((a) => placed.add(a.id));
    }
  }

  const remaining = accounts.filter((a) => !placed.has(a.id));
  if (remaining.length > 0) {
    groups.push({ label: "Other", accounts: remaining });
  }

  return groups;
}

export function AccountList() {
  const { data: accounts, isLoading } = useAccounts();
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  if (isLoading) {
    return <AccountListSkeleton />;
  }

  if (!accounts || accounts.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-40 items-center justify-center text-muted-foreground">
          No accounts yet. Link a bank or create a manual account.
        </CardContent>
      </Card>
    );
  }

  const groups = groupByType(accounts);
  const isDebtAccount = selectedAccount?.account_type === "loan" || selectedAccount?.account_type === "credit";
  const isInvestmentAccount = selectedAccount?.account_type === "investment";

  return (
    <>
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.label} className="space-y-3">
            <h2 className="text-lg font-semibold">{group.label}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onClick={
                    account.account_type === "loan" ||
                    account.account_type === "credit" ||
                    account.account_type === "investment"
                      ? () => setSelectedAccount(account)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedAccount && isDebtAccount && (
        <DebtAccountDetail
          account={selectedAccount}
          open
          onClose={() => setSelectedAccount(null)}
        />
      )}

      {selectedAccount && isInvestmentAccount && (
        <InvestmentAccountDetail
          account={selectedAccount}
          open
          onClose={() => setSelectedAccount(null)}
        />
      )}
    </>
  );
}
