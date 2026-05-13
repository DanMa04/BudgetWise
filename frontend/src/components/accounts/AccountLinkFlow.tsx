import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useExchangeToken } from "@/hooks/usePlaid";

interface AccountLinkFlowProps {
  open: boolean;
  onClose: () => void;
}

const MOCK_INSTITUTIONS = [
  { id: "mock_bank", name: "Mock Bank" },
  { id: "mock_credit_union", name: "Mock Credit Union" },
  { id: "mock_investment", name: "Mock Investment Firm" },
];

type Step = "select" | "connecting" | "success";

export function AccountLinkFlow({ open, onClose }: AccountLinkFlowProps) {
  const [step, setStep] = useState<Step>("select");
  const [selectedInstitution, setSelectedInstitution] = useState<
    (typeof MOCK_INSTITUTIONS)[0] | null
  >(null);
  const exchangeToken = useExchangeToken();

  useEffect(() => {
    if (!open) {
      setStep("select");
      setSelectedInstitution(null);
    }
  }, [open]);

  function handleSelectInstitution(
    institution: (typeof MOCK_INSTITUTIONS)[0]
  ) {
    setSelectedInstitution(institution);
    setStep("connecting");

    setTimeout(() => {
      exchangeToken.mutate(
        {
          public_token: `mock-public-token-${institution.id}`,
          institution_id: institution.id,
          institution_name: institution.name,
        },
        {
          onSuccess: () => setStep("success"),
          onError: () => setStep("select"),
        }
      );
    }, 1500);
  }

  function handleClose() {
    setStep("select");
    setSelectedInstitution(null);
    onClose();
  }

  return (
    <Dialog open={open}>
      <DialogContent onClose={step !== "connecting" ? handleClose : undefined}>
        {step === "select" && (
          <>
            <DialogHeader>
              <DialogTitle>Select your bank</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {MOCK_INSTITUTIONS.map((institution) => (
                <button
                  key={institution.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                  onClick={() => handleSelectInstitution(institution)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {institution.name[0]}
                  </div>
                  <span className="font-medium">{institution.name}</span>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "connecting" && (
          <>
            <DialogHeader>
              <DialogTitle>Connecting...</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                Connecting to {selectedInstitution?.name}...
              </p>
            </div>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle>Connected!</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">
                Successfully linked {selectedInstitution?.name}. Your accounts
                have been imported.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
