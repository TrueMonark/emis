"use client";

import { WeekendClasses } from "@/components/attendance/weekend-classes";

// HODs also see "To approve" (the tab hides itself for everyone else).
const VIEWS: ("mine" | "to-approve")[] = ["mine", "to-approve"];

/** Teacher: ask for weekend classes and take their registers. */
export default function TeacherWeekendClassesPage() {
  return (
    <div className="px-4 lg:px-0 space-y-4 mt-5 lg:mt-2">
      <div className="hidden lg:block">
        <h1 className="text-xl font-bold">Weekend classes</h1>
        <p className="text-sm text-muted-foreground">Extra lessons on a Saturday or Sunday, approved by your HOD.</p>
      </div>
      <WeekendClasses views={VIEWS} />
    </div>
  );
}
