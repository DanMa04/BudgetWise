import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  useOnboardingState,
  useUpdateOnboardingState,
} from "@/hooks/useOnboarding";
import { WelcomeStep } from "@/components/onboarding/steps/WelcomeStep";
import { ChoosePathStep } from "@/components/onboarding/steps/ChoosePathStep";
import { AccountsStep } from "@/components/onboarding/steps/AccountsStep";
import { CategorizeStep } from "@/components/onboarding/steps/CategorizeStep";
import { GoalsStep } from "@/components/onboarding/steps/GoalsStep";
import { BudgetStep } from "@/components/onboarding/steps/BudgetStep";
import { CompleteStep } from "@/components/onboarding/steps/CompleteStep";
import { AiTakeTheWheelChat } from "@/components/onboarding/AiTakeTheWheelChat";

export type WizardStep =
  | "welcome"
  | "accounts"
  | "choose-path"
  | "categorize"
  | "goals"
  | "budget"
  | "ai-chat"
  | "complete";

const STEP_TITLES: Record<WizardStep, string> = {
  welcome: "Welcome to Kallio",
  accounts: "Step 1 of 4 — Accounts",
  "choose-path": "How would you like to continue?",
  categorize: "Step 2 of 4 — Categories",
  goals: "Step 3 of 4 — Goals",
  budget: "Step 4 of 4 — Budget",
  "ai-chat": "AI Setup Assistant",
  complete: "All done",
};

interface Props {
  open: boolean;
  onClose: () => void;
  initialStep?: WizardStep;
}

export function OnboardingWizard({ open, onClose, initialStep }: Props) {
  const { displayName } = useAuth();
  const { data: state } = useOnboardingState();
  const update = useUpdateOnboardingState();
  const [step, setStep] = useState<WizardStep>(initialStep ?? "welcome");

  useEffect(() => {
    if (open && initialStep) setStep(initialStep);
  }, [open, initialStep]);

  function goTo(next: WizardStep, patch?: Partial<{ path: "manual" | "ai" }>) {
    setStep(next);
    update.mutate({ last_step: next, ...patch });
  }

  function handleClose() {
    onClose();
  }

  if (!state) return null;

  return (
    <Dialog open={open}>
      <DialogContent
        onClose={handleClose}
        className="top-[5vh] translate-y-0 max-h-[90vh] max-w-lg overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
        </DialogHeader>

        {step === "welcome" && (
          <WelcomeStep
            displayName={displayName}
            onContinue={() => goTo("accounts")}
            onSkip={handleClose}
          />
        )}

        {step === "accounts" && (
          <AccountsStep
            plan={state.plan}
            state={state}
            onContinue={() => goTo("choose-path")}
            onBack={() => goTo("welcome")}
            onSkip={() => goTo("choose-path")}
            onCloseWizard={handleClose}
          />
        )}

        {step === "choose-path" && (
          <ChoosePathStep
            aiEnabled={(state.derived?.transaction_count ?? 0) > 0}
            aiDisabledReason="Add accounts or import transactions first so the AI has something to work with."
            onPickManual={() => goTo("categorize", { path: "manual" })}
            onPickAi={() => goTo("ai-chat", { path: "ai" })}
            onBack={() => goTo("accounts")}
          />
        )}

        {step === "ai-chat" && (
          <AiTakeTheWheelChat
            onApplied={() => goTo("complete")}
            onBack={() => goTo("choose-path")}
          />
        )}

        {step === "categorize" && (
          <CategorizeStep
            state={state}
            onContinue={() => goTo("goals")}
            onBack={() => goTo("choose-path")}
            onSkip={() => goTo("goals")}
            onCloseWizard={handleClose}
          />
        )}

        {step === "goals" && (
          <GoalsStep
            state={state}
            onContinue={() => goTo("budget")}
            onBack={() => goTo("categorize")}
            onSkip={() => goTo("budget")}
          />
        )}

        {step === "budget" && (
          <BudgetStep
            state={state}
            onContinue={() => goTo("complete")}
            onBack={() => goTo("goals")}
            onSkip={() => goTo("complete")}
          />
        )}

        {step === "complete" && <CompleteStep onDone={handleClose} />}
      </DialogContent>
    </Dialog>
  );
}
