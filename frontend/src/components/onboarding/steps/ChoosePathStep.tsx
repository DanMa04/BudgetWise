import { ChevronRight, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onPickManual: () => void;
  onPickAi: () => void;
  onBack: () => void;
  aiEnabled: boolean;
  aiDisabledReason?: string;
}

export function ChoosePathStep({
  onPickManual,
  onPickAi,
  onBack,
  aiEnabled,
  aiDisabledReason,
}: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">
          Now that your data is in, how would you like to finish?
        </h3>
        <p className="text-sm text-muted-foreground">
          Set up categories, goals, and budget yourself — or let the AI
          assistant propose a complete starter for you.
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={onPickManual}
          className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <ListChecks className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Set up manually</div>
            <div className="text-xs text-muted-foreground">
              Walk through each step yourself.
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        <button
          type="button"
          onClick={onPickAi}
          disabled={!aiEnabled}
          title={!aiEnabled ? aiDisabledReason : undefined}
          className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Let AI build my budget</div>
            <div className="text-xs text-muted-foreground">
              {aiEnabled
                ? "Answer a few questions and we'll propose categories, goals, and a budget."
                : aiDisabledReason ?? "Coming soon."}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex justify-start">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
