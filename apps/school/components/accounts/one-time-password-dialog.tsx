"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@school/ui/components/dialog";
import { Button } from "@school/ui/components/button";
import { Check, Copy, KeyRound } from "lucide-react";

export interface IssuedPassword {
  /** Who it's for, e.g. "Mary Banda". */
  name: string;
  email: string;
  temporaryPassword: string;
  temporaryPasswordExpiresAt: string;
}

interface OneTimePasswordDialogProps {
  issued: IssuedPassword | null;
  /** "created" for a new account, "reset" after a password reset. */
  reason: "created" | "reset";
  onClose: () => void;
}

/**
 * Shows a one-time password exactly once, to the person who created or reset the account, so
 * they can hand it over. The server never shows it again.
 */
export function OneTimePasswordDialog({ issued, reason, onClose }: OneTimePasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the password is on screen to read out.
    }
  };

  const expires = issued
    ? new Date(issued.temporaryPasswordExpiresAt).toLocaleString("en-GB", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

  return (
    <Dialog
      open={issued !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
              <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle>
              {reason === "created" ? "Account created" : "Password reset"}
            </DialogTitle>
          </div>
          <DialogDescription className="pt-3 text-left">
            Give this one-time password to{" "}
            <span className="font-semibold text-foreground">{issued?.name}</span> in person or by
            phone. They will be asked to choose their own password when they log in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Login: </span>
            <span className="font-medium">{issued?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 rounded-md border bg-muted px-4 py-3 text-center font-mono text-xl font-semibold tracking-widest"
              data-testid="one-time-password">
              {issued?.temporaryPassword}
            </code>
            <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copy password">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            It works once and expires on {expires}. It won&apos;t be shown again. If it&apos;s lost,
            reset the password again.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>I&apos;ve noted it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
