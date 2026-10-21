import type { ReactNode } from "react";

/** Title row of a school fees page, with its buttons on the right. */
export function FinancePageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Note shown to the head teacher / deputy on pages where finance staff make changes. */
export function ViewOnlyNote() {
  return (
    <p className="mb-4 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      View only: finance staff record payments and change fees. You can view and print everything.
    </p>
  );
}
