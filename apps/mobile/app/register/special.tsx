import { Stack, useLocalSearchParams } from "expo-router";
import { useLocal } from "../../src/events";
import { dayLabel, todayIso } from "../../src/dates";
import { classLabel, learnersOf, specialClassById, specialMarks, subjectName } from "../../src/queries";
import { saveSpecialRegister } from "../../src/ops";
import { RegisterEditor } from "../../src/register-editor";
import { Empty, Screen } from "../../src/ui";

/** The register of an approved special class (weekend, holiday or closure day). */
export default function SpecialRegister() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useLocal(() => {
    const sc = specialClassById(id);
    if (!sc) return null;
    const day = sc.date.slice(0, 10);
    return {
      sc,
      day,
      learners: learnersOf(sc.classId),
      marks: specialMarks(sc.id),
      blocked: sc.status !== "APPROVED" ? "Not approved by the HOD yet." : day > todayIso() ? "The register opens on the day of the class." : null,
    };
  }, [id]);
  if (!d) return <Screen><Empty text="This special class isn't on the phone any more." /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: "Special class" }} />
      <RegisterEditor
        title={`${d.sc.topic}`}
        subtitle={`${subjectName(d.sc.subjectId)} · ${classLabel(d.sc.classId)} · ${dayLabel(d.day)} ${d.sc.startTime}–${d.sc.endTime}`}
        learners={d.learners}
        marks={d.marks}
        blocked={d.blocked}
        onSave={(marks) => saveSpecialRegister(d.sc, marks)}
      />
    </Screen>
  );
}
