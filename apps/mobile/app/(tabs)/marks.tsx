import { router } from "expo-router";
import { useLocal } from "../../src/events";
import { classLabel, learnersOf, myAssessments, scoresOf, subjectName } from "../../src/queries";
import { Card, Empty, Label, Pill, Row, Screen } from "../../src/ui";

const EXAM: Record<string, string> = { CAT: "CAT", MID: "Mid-term", EOT: "End of term" };

/** Assessments of my classes and subjects: open ones to enter marks, completed ones to look at. */
export default function Marks() {
  const list = useLocal(() =>
    myAssessments().map((a) => {
      const learners = learnersOf(a.classId).length;
      const scores = scoresOf(a.id);
      return { a, learners, entered: scores.size, waiting: [...scores.values()].some((x) => x.waiting) };
    })
  );
  const open = list.filter((x) => x.a.status === "PUBLISHED");
  const done = list.filter((x) => x.a.status === "COMPLETED");
  const row = (x: (typeof list)[number]) => (
    <Row
      key={x.a.id}
      title={x.a.title}
      sub={`${subjectName(x.a.subjectId)} · ${classLabel(x.a.classId)} · ${EXAM[x.a.examType] ?? x.a.examType} · out of ${x.a.totalMarks}`}
      right={
        x.waiting ? (
          <Pill text="waiting" tone="amber" />
        ) : (
          <Pill text={`${x.entered}/${x.learners}`} tone={x.entered >= x.learners && x.learners > 0 ? "green" : x.entered ? "amber" : "grey"} />
        )
      }
      onPress={() => router.push({ pathname: "/marks/[id]", params: { id: x.a.id } })}
    />
  );
  return (
    <Screen>
      <Card>
        <Label>Open for marks</Label>
        {open.length ? open.map(row) : <Empty icon="school-outline" text="No published assessments for your classes. Drafts are published on the website." />}
      </Card>
      {done.length > 0 && (
        <Card>
          <Label>Completed (view only)</Label>
          {done.map(row)}
        </Card>
      )}
    </Screen>
  );
}
