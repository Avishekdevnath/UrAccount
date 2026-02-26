"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import type { CompanyMember } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AssignableTeamRole = "Admin" | "Accountant" | "Viewer";

type TeamMemberRoleModalProps = {
  open: boolean;
  member: CompanyMember | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (role: AssignableTeamRole) => Promise<void>;
};

function getInitialRole(member: CompanyMember | null): AssignableTeamRole {
  const firstRole = member?.roles?.[0];
  if (firstRole === "Admin" || firstRole === "Accountant" || firstRole === "Viewer") {
    return firstRole;
  }
  return "Viewer";
}

export function TeamMemberRoleModal({ open, member, pending, onClose, onSubmit }: TeamMemberRoleModalProps) {
  const [role, setRole] = useState<AssignableTeamRole>(() => getInitialRole(member));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(role);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Member Role</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Member</p>
            <p className="text-sm font-medium text-foreground">{member?.user_email ?? "-"}</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Role</p>
            <Select value={role} onValueChange={(value) => setRole(value as AssignableTeamRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Accountant">Accountant</SelectItem>
                <SelectItem value="Viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Role"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
