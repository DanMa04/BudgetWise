import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { exportMyData, deleteMyAccount } from "@/api/account";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function AccountManagement() {
  const { getToken, signOut } = useAuth();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await exportMyData(token);
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await deleteMyAccount(token);
      await signOut();
      navigate("/");
    } catch {
      setError("Deletion failed. Please try again.");
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/8 bg-card/65 p-6 backdrop-blur-xl space-y-6">
      <div>
        <h2 className="font-semibold">Your Data</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your personal data in accordance with your privacy rights.
        </p>
      </div>

      {/* Export */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Export my data</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Download a copy of all your transactions, budgets, goals, and account info.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {isExporting ? "Exporting…" : "Download"}
        </button>
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <p className="text-sm font-medium text-destructive">Danger zone</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently deletes your account and all financial data. Cannot be undone.
            </p>
          </div>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            Delete account
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog}>
        <DialogContent onClose={() => !isDeleting && setShowDeleteDialog(false)}>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes your account and all associated data — transactions,
            budgets, goals, accounts, and settings. This action cannot be undone.
          </p>
          <DialogFooter>
            <button
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isDeleting ? "Deleting…" : "Yes, delete permanently"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
