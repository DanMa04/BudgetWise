import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onDone: () => void;
}

export function CompleteStep({ onDone }: Props) {
  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300">
          <PartyPopper className="h-7 w-7" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">You're set up</h3>
          <p className="text-sm text-muted-foreground">
            Your dashboard now reflects your accounts, categories, goals, and
            budget. Come back any time to refine.
          </p>
        </div>
      </div>
      <Button onClick={onDone} className="w-full">
        Go to Dashboard
      </Button>
    </div>
  );
}
