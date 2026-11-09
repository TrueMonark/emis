import { cn } from "@/lib/utils";

/**
 * A thin stripe in the colours of the Zambian flag (green field, then red, black and orange),
 * as on the flag's fly. An accent for the office pages; decorative only.
 */
export function FlagStripe({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-1 w-full shrink-0", className)} aria-hidden>
      <span className="flex-[7] bg-[var(--zm-green)]" />
      <span className="flex-1 bg-[var(--zm-red)]" />
      <span className="flex-1 bg-[var(--zm-black)]" />
      <span className="flex-1 bg-[var(--zm-orange)]" />
    </div>
  );
}
