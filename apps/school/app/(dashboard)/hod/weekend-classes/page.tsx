"use client";

import { WeekendClasses } from "@/components/attendance/weekend-classes";

const VIEWS: ("to-approve" | "mine")[] = ["to-approve", "mine"];

/** HOD: approve weekend classes for the department's subjects (and ask for your own). */
export default function HodWeekendClassesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Weekend classes</h1>
        <p className="text-sm text-muted-foreground">
          Teachers in your department ask to teach on a Saturday or Sunday. Approve or turn them down; only approved
          weekend classes can have a register.
        </p>
      </div>
      <WeekendClasses views={VIEWS} />
    </div>
  );
}
