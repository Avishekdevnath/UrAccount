"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PasswordResetModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string) => Promise<void>;
  userEmail: string;
  isPending?: boolean;
};

export function PasswordResetModal({
  open,
  onClose,
  onSubmit,
  userEmail,
  isPending = false,
}: PasswordResetModalProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  function handleClose() {
    if (isPending) return;
    setPassword("");
    setConfirm("");
    setError("");
    onClose();
  }

  async function handleSubmit() {
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await onSubmit(password);
      setPassword("");
      setConfirm("");
    } catch {
      setError("Failed to reset password.");
    }
  }

  const isDisabled = isPending || password.length < 8 || password !== confirm;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for <span className="font-medium text-foreground">{userEmail}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              New password <span className="text-muted-foreground">(min 8 chars)</span>
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              disabled={isPending}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Confirm password
            </label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              disabled={isPending}
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isDisabled}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
