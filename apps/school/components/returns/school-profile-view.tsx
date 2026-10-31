"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { FiguresView, KeyIndicatorsTable } from "./figures-view";
import { FacilitiesView } from "./facilities";
import { dateTime, day } from "./format";
import type { SchoolProfile } from "./types";

/**
 * A school's profile: its indicators beside its district's, the counts, and its facilities
 * (the office's school page and the school's own School profile page).
 */
export function SchoolProfileView({ data, facilitiesSlot }: { data: SchoolProfile; facilitiesSlot?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Compared with the district</CardTitle>
            <p className="text-xs text-muted-foreground">
              {data.district.name}: {data.district.schools} school(s). Period {day(data.period.from)} to {day(data.period.to)}.
            </p>
          </CardHeader>
          <CardContent>
            <KeyIndicatorsTable derived={data.derived} compare={{ label: "District", derived: data.district.derived }} />
          </CardContent>
        </Card>
        {facilitiesSlot ?? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Facilities</CardTitle>
              <p className="text-xs text-muted-foreground">
                {data.facilitiesUpdatedAt ? `Last updated by the school ${dateTime(data.facilitiesUpdatedAt)}` : "The school hasn't given its facilities yet"}
              </p>
            </CardHeader>
            <CardContent>
              <FacilitiesView value={data.facilities} />
              {data.facilitiesNotes && <p className="mt-2 text-sm text-muted-foreground">{data.facilitiesNotes}</p>}
            </CardContent>
          </Card>
        )}
      </div>
      <FiguresView figures={data.figures} />
    </div>
  );
}
