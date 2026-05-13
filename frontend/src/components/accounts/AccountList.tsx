import { useAccounts } from "@/hooks/useAccounts";
import { AccountCard } from "@/components/accounts/AccountCard";
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

function groupByInstitution(accounts: Account[]): Record<string, Account[]> {
  const groups: Record<string, Account[]> = {};

  for (const account of accounts) {
    const key = account.institution_name ?? "Manual Accounts";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(account);
  }

  return groups;
}

export function AccountList() {
  const { data: accounts, isLoading } = useAccounts();

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

  const groups = groupByInstitution(accounts);

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([institution, groupAccounts]) => (
        <div key={institution} className="space-y-3">
          <h2 className="text-lg font-semibold">{institution}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupAccounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
