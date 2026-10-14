import Link from "next/link";
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
 * Until the reset-request flow (Phase 4, docs/design/phase-3-foundation.md §3b) is built,
 * resets are done by the head teacher or deputy head from the Teachers page.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background p-4">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold">Forgot your password?</CardTitle>
          <CardDescription>
            Ask your head teacher or deputy head to reset it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            They will give you a one-time password. Sign in with it, and you will be asked to
            choose your own password straight away.
          </p>
          <p>The one-time password expires after 24 hours if it isn&apos;t used.</p>
        </CardContent>
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
