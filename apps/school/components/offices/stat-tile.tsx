import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@school/ui/components/card";
import { cn } from "@/lib/utils";

const ACCENT = {
  green: "border-t-[var(--zm-green)]",
  orange: "border-t-[var(--zm-orange)]",
  red: "border-t-[var(--zm-red)]",
  black: "border-t-[var(--zm-black)]",
} as const;

/** A headline figure for the office pages, with a thin flag-colour accent along the top. */
export function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  accent = "green",
  href,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  accent?: keyof typeof ACCENT;
  href?: string;
}) {
  const body = (
    <Card className={cn("h-full border-t-[3px] transition-colors", ACCENT[accent], href && "hover:bg-muted/40")}>
      <CardContent className="flex items-start gap-3 p-4">
        <Icon className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
