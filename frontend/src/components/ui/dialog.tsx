import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function DialogOverlay({
  className,
  onClick,
  ...props
}: React.ComponentProps<"div"> & { onClick?: () => void }) {
  return (
    <div
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
        className
      )}
      onClick={onClick}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  onClose,
  ...props
}: React.ComponentProps<"div"> & { onClose?: () => void }) {
  return (
    <>
      <DialogOverlay onClick={onClose} />
      <div
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg",
          className
        )}
        {...props}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-sm p-1 text-muted-foreground opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </>
  );
}

function Dialog({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  // Portal into document.body so the dialog escapes any ancestor
  // containing block (e.g., another dialog with `transform` or
  // `overflow-y-auto`). Without this, dialogs opened from inside the
  // OnboardingWizard get clipped/mispositioned relative to the wizard
  // instead of the viewport.
  if (!open) return null;
  if (typeof document === "undefined") return null;
  return createPortal(<>{children}</>, document.body);
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("mb-4 flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn("text-lg font-semibold leading-none", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("mt-6 flex justify-end gap-2", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogOverlay,
};
