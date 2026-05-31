import { Lock, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  feature: string;
  description: string;
}

export function UpgradePrompt({ open, onClose, feature, description }: Props) {
  return (
    <Dialog open={open}>
      <DialogContent onClose={onClose} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            {feature} is a Pro feature
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{description}</p>

        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 dark:border-indigo-800 dark:bg-indigo-950/50">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <p className="text-xs text-indigo-900 dark:text-indigo-100">
              Pro unlocks Plaid bank linking for automatic transaction sync.
              Everything else — imports, categorization, goals, budgets, and
              the AI assistant — stays available on Basic.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Not now
          </Button>
          <Button
            disabled
            title="Billing is not connected yet — coming soon."
          >
            Upgrade to Pro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
