"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogOut, ShieldCheck } from "lucide-react";
import { useContext } from "react";
import { Icon } from "@/lib/morphy-ux/ui";
import { Button } from "@/lib/morphy-ux/button";

// Import the context directly to check if it exists
import { VaultContext } from "@/lib/vault/vault-context";

interface ExitDialogProps {
  open: boolean;
  mode?: "exit" | "lock_only";
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Exit Hushh confirmation dialog with secure cleanup
 *
 * Uses AlertDialog for native-style confirmation popup that:
 * - Does NOT close when clicking outside (safer for exit confirmations)
 * - Has proper accessibility for destructive actions
 * - Provides built-in Cancel/Action buttons
 *
 * Security features:
 * - Locks vault (clears encryption key from memory)
 * - Clears session storage
 * - Removes sensitive localStorage items
 * - Then exits the app via Capacitor App.exitApp()
 */
export function ExitDialog({
  open,
  mode = "exit",
  onOpenChange,
  onConfirm,
}: ExitDialogProps) {
  // Safely try to get vault context (may not exist during SSR/static generation)
  const vaultContext = useContext(VaultContext);

  const handleExit = async () => {
    // 1. Lock vault if context is available (clears key from memory)
    if (vaultContext?.lockVault) {
      vaultContext.lockVault();
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("vault-lock-requested", {
          detail: { reason: isLockOnly ? "manual_lock" : "exit_app" },
        })
      );
    }

    // 2. Clear sensitive session data
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear();
    }

    // 3. Clear sensitive localStorage items
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("user_id");
      localStorage.removeItem("vault_token");
      localStorage.removeItem("vault_unlocked");
    }

    // 4. Call the exit callback (which calls App.exitApp())
    onConfirm();
    onOpenChange(false);
  };

  const isLockOnly = mode === "lock_only";
  const title = isLockOnly ? "Lock Vault" : "Exit Hushh";
  const description = isLockOnly
    ? "Lock your vault now? You can close the app manually from iOS app switcher."
    : "Are you sure you want to exit? Your vault will be locked for security.";
  const actionLabel = isLockOnly ? "Lock Vault" : "Lock Vault & Exit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        showCloseButton={false}
        className="bg-background/95 border-border/60 shadow-xl sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon={ShieldCheck} size="md" className="text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="none"
            effect="fade"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            effect="fade"
            onClick={() => void handleExit()}
            className="shadow-md"
          >
            <Icon icon={LogOut} size="sm" className="mr-2" />
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
