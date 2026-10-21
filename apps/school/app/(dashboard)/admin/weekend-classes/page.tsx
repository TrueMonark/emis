"use client";

import { WeekendClasses } from "@/components/attendance/weekend-classes";

const VIEWS: ("to-approve" | "all" | "mine")[] = ["to-approve", "all", "mine"];

/** Head teacher / deputy: every weekend class, and the ones to decide (no HOD, or the HOD's own). */
export default function AdminWeekendClassesPage() {
  return (
    <div className="px-4 lg:px-0 space-y-4 mt-5 lg:mt-2">
      <div>
        <h1 className="text-xl font-bold">Weekend classes</h1>
        <p className="text-sm text-muted-foreground">
          Weekend lessons need approval by the subject&apos;s HOD; you can decide any of them, and your own need no
          approval.
        </p>
      </div>
      <WeekendClasses views={VIEWS} />
    </div>
  );
}
