import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onContinue: () => void;
  onSkip: () => void;
  displayName: string;
}

export function WelcomeStep({ onContinue, onSkip, displayName }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Welcome, {displayName}</h3>
          <p className="text-sm text-muted-foreground">
            Let's get Kallio set up in just a few minutes.
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        We'll walk you through connecting accounts, organizing your spending,
        and building a budget that fits your goals. You can always skip a step
        and come back to it later.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onSkip}>
          Not now
        </Button>
        <Button onClick={onContinue}>Get started</Button>
      </div>
    </div>
  );
}
