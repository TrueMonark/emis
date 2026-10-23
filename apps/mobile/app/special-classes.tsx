import { router } from "expo-router";
import { useLocal } from "../src/events";
import { dayLabel, todayIso } from "../src/dates";
import { classLabel, mySpecialClasses, specialMarks, subjectName } from "../src/queries";
import { Banner, Card, Empty, Pill, Row, Screen } from "../src/ui";

const STATUS: Record<string, { text: string; tone: "green" | "amber" | "red" | "grey" }> = {
  APPROVED: { text: "Approved", tone: "green" },
  PENDING: { text: "Waiting for HOD", tone: "amber" },
  REJECTED: { text: "Turned down", tone: "red" },
  CANCELLED: { text: "Cancelled", tone: "grey" },
};

/** My special classes (weekends, public holidays, closure days). Asking for one is on the website. */
export default function SpecialClasses() {
  const today = todayIso();
  const list = useLocal(() => mySpecialClasses().map((sc) => ({ sc, taken: specialMarks(sc.id).size })));
  return (
    <Screen>
      <Banner text="Ask for a special class on the website (Weekend classes). Once your HOD approves it, take its register here on the day." />
      <Card>
        {list.length === 0 ? (
          <Empty icon="calendar-outline" text="No special classes." />
        ) : (
          list.map(({ sc, taken }) => {
            const day = sc.date.slice(0, 10);
            const st = STATUS[sc.status] ?? { text: sc.status, tone: "grey" as const };
            const open = sc.status === "APPROVED" && day <= today;
            return (
              <Row
                key={sc.id}
                title={sc.topic}
                sub={`${dayLabel(day)} ${sc.startTime}–${sc.endTime} · ${subjectName(sc.subjectId)} · ${classLabel(sc.classId)}`}
                right={<Pill text={open && taken ? "Register taken" : st.text} tone={open && taken ? "green" : st.tone} />}
                onPress={sc.status === "APPROVED" ? () => router.push({ pathname: "/register/special", params: { id: sc.id } }) : undefined}
              />
            );
          })
        )}
      </Card>
    </Screen>
  );
}
