"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Input } from "@school/ui/components/input";
import { Label } from "@school/ui/components/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@school/ui/components/card";
import { MonarkDevsCredit } from "@/components/layout/monark-devs-credit";

/**
 * "Forgot password?" (Phase 4b). Sends a reset request to the person's head teacher and deputy
 * head (or, for office staff and lone heads, the office above). The reply never says whether the
 * account exists. Like sign-in, this is the one other call made before signing in, so it uses a
 * bare fetch.
 */
export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(body?.data?.message ?? "Your request has been sent.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background p-4">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold">Forgot your password?</CardTitle>
          <CardDescription>
            Enter the email address or mobile number you sign in with. Your head teacher or deputy
            head is asked to reset it (office staff: the office above yours).
          </CardDescription>
        </CardHeader>

        {sent ? (
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p>{sent}</p>
            </div>
            <p className="text-muted-foreground">
              They will check it&apos;s really you, then give you a one-time password (in person, by
              phone, or by SMS). Sign in with it and you&apos;ll be asked to choose your own password
              straight away. It expires after 24 hours if it isn&apos;t used.
            </p>
          </CardContent>
        ) : (
          <form onSubmit={submit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="identifier">Email or mobile number</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="identifier"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    placeholder="teacher@school.zm or 0977 123 456"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="pl-10"
                    required
                    disabled={sending}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={sending || !identifier.trim()}>
                {sending ? "Sending…" : "Ask for a new password"}
              </Button>
            </CardContent>
          </form>
        )}

        <CardFooter>
          <Link href="/login" className="text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
      <MonarkDevsCredit />
    </div>
  );
}
