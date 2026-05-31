import { useState } from "react";
import { Building2, CheckCircle2, FileUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountLinkFlow } from "@/components/accounts/AccountLinkFlow";
import { UpgradePrompt } from "@/components/onboarding/UpgradePrompt";
import { InlineImportDialog } from "@/components/onboarding/InlineImportDialog";
import type { OnboardingState, Plan } from "@/types/models";

interface Props {
  plan: Plan;
  state: OnboardingState;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
  /** Kept for backward compatibility with the wizard signature. */
  onCloseWizard: () => void;
}

export function AccountsStep({
  plan,
  state,
  onContinue,
  onBack,
  onSkip,
}: Props) {
  const [showPlaid, setShowPlaid] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const accountCount = state.derived?.account_count ?? 0;
  const transactionCount = state.derived?.transaction_count ?? 0;
  const hasData = accountCount > 0 || transactionCount > 0;
  const isPro = plan === "pro";

  function handleLinkBank() {
    if (isPro) {
      setShowPlaid(true);
    } else {
      setShowUpgrade(true);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Connect your money</h3>
        <p className="text-sm text-muted-foreground">
          Link a bank for automatic sync, or import a file you exported from
          your bank.
        </p>
      </div>

      {hasData && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {accountCount} {accountCount === 1 ? "account" : "accounts"} •{" "}
            {transactionCount}{" "}
            {transactionCount === 1 ? "transaction" : "transactions"}
          </span>
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={handleLinkBank}
          className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 font-medium">
              Link a bank
              {!isPro && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <Lock className="h-2.5 w-2.5" />
                  Pro
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {isPro
                ? "Securely connect via Plaid."
                : "Auto-sync transactions with a Pro upgrade."}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <FileUp className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Import a file</div>
            <div className="text-xs text-muted-foreground">
              CSV or Excel from any of 8 supported banks.
            </div>
          </div>
        </button>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
          <Button onClick={onContinue} disabled={!hasData}>
            Continue
          </Button>
        </div>
      </div>

      <AccountLinkFlow open={showPlaid} onClose={() => setShowPlaid(false)} />
      <UpgradePrompt
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Bank linking"
        description="Linking a bank with Plaid auto-syncs transactions every day. It's available on Pro. On Basic, you can still import CSV/Excel files from any of 8 supported banks."
      />
      <InlineImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onContinueAfterImport={onContinue}
      />
    </div>
  );
}
