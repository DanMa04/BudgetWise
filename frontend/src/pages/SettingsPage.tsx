import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { AccountManagement } from "@/components/settings/AccountManagement";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/context/ThemeContext";
import { useExtensionConnection } from "@/hooks/useExtensionConnection";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useResetOnboarding } from "@/hooks/useOnboarding";
import { useResetBudget, useWipeAllData } from "@/hooks/useDev";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function OnboardingResetCard() {
  const reset = useResetOnboarding();
  return (
    <div className="rounded-xl border border-white/8 bg-card/65 p-6 backdrop-blur-xl">
      <h2 className="font-semibold">Onboarding</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Replay the welcome wizard and checklist for setup steps.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {reset.isSuccess
            ? "Onboarding reset. Open the Dashboard to resume."
            : "This will clear completed-step markers; your accounts, goals, and budgets are untouched."}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
        >
          {reset.isPending ? "Resetting…" : "Restart onboarding"}
        </Button>
      </div>
    </div>
  );
}

function DangerZoneCard() {
  const wipe = useWipeAllData();
  const resetBudget = useResetBudget();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  function handleWipe() {
    wipe.mutate(undefined, { onSettled: () => setConfirmWipe(false) });
  }

  function handleResetBudget() {
    resetBudget.mutate(undefined, {
      onSettled: () => setConfirmReset(false),
    });
  }

  const wipeSummary = wipe.data
    ? Object.entries(wipe.data.wiped)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${k.replaceAll("_", " ")}`)
        .join(", ")
    : null;

  return (
    <div className="rounded-xl border border-red-200/60 bg-card/65 p-6 backdrop-blur-xl dark:border-red-900/50">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <h2 className="font-semibold text-red-900 dark:text-red-200">
          Danger zone
        </h2>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Destructive test utilities. Each action only affects your own data.
      </p>

      <div className="mt-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Reset budget</p>
            <p className="text-xs text-muted-foreground">
              Deletes all budgets and zeros every goal's planned monthly
              contribution. Keeps categories, rules, transactions, accounts,
              and goal progress.
            </p>
            {resetBudget.data && (
              <p className="mt-1 text-xs text-emerald-600">
                Cleared {resetBudget.data.budgets_deleted} budget(s); zeroed{" "}
                {resetBudget.data.goals_zeroed} goal contribution(s).
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmReset(true)}
            disabled={resetBudget.isPending}
          >
            {resetBudget.isPending ? "Resetting…" : "Reset budget"}
          </Button>
        </div>

        <div className="flex items-start justify-between gap-3 border-t pt-4">
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              Wipe all data
            </p>
            <p className="text-xs text-muted-foreground">
              Deletes accounts, transactions, budgets, goals, imports, Plaid
              links, snapshots, transfer rules, and your custom categories +
              rules. Re-seeds default categories and rules. Resets onboarding.
              Your user account, notification prefs, and extension tokens stay.
            </p>
            {wipeSummary && (
              <p className="mt-1 text-xs text-emerald-600">
                Wiped: {wipeSummary}.
              </p>
            )}
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmWipe(true)}
            disabled={wipe.isPending}
          >
            {wipe.isPending ? "Wiping…" : "Wipe all data"}
          </Button>
        </div>
      </div>

      <Dialog open={confirmReset}>
        <DialogContent onClose={() => setConfirmReset(false)}>
          <DialogHeader>
            <DialogTitle>Reset budget?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This deletes every budget row and sets each goal's planned monthly
            contribution to $0. Your transactions, accounts, categories, and
            goal progress are untouched.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmReset(false)}
              disabled={resetBudget.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleResetBudget} disabled={resetBudget.isPending}>
              {resetBudget.isPending ? "Resetting…" : "Yes, reset budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmWipe}>
        <DialogContent onClose={() => setConfirmWipe(false)}>
          <DialogHeader>
            <DialogTitle className="text-red-700 dark:text-red-300">
              Wipe all data?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes everything you've added to Kallio:
            accounts, transactions, budgets, goals, imports, Plaid connections,
            snapshots, transfer rules, and your custom categories and rules.
            Default categories and rules will be re-seeded.
          </p>
          <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-300">
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmWipe(false)}
              disabled={wipe.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleWipe}
              disabled={wipe.isPending}
            >
              {wipe.isPending ? "Wiping…" : "Yes, wipe everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExtensionCard() {
  const { extensionPresent, isConnected, expiresAt, isLoading, connect, disconnect } =
    useExtensionConnection();

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="rounded-xl border border-white/8 bg-card/65 p-6 backdrop-blur-xl">
      <h2 className="font-semibold">Browser Extension</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Get real-time budget warnings while shopping online.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Checking connection…</p>
      ) : !extensionPresent ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Install the Kallio extension, then return here to connect.
          </p>
          <a
            href="https://chromewebstore.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Install Extension
          </a>
        </div>
      ) : isConnected ? (
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium">Connected</span>
            </div>
            {expiresLabel && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Token expires {expiresLabel}
              </p>
            )}
          </div>
          <button
            onClick={disconnect}
            className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <button
            onClick={connect}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Connect Extension
          </button>
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences.
        </p>
      </div>

      <div className="rounded-xl border border-white/8 bg-card/65 p-6 backdrop-blur-xl">
        <h2 className="font-semibold">Appearance</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choose your preferred color scheme.
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm">Dark mode</span>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={(checked) =>
              setTheme(checked ? "dark" : "light")
            }
          />
        </div>
      </div>

      <ExtensionCard />

      <NotificationPreferences />

      <OnboardingResetCard />

      <DangerZoneCard />

      <AccountManagement />

      <p className="text-center text-xs text-muted-foreground pb-2">
        <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </a>
      </p>
    </div>
  );
}
