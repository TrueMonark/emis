import { Stack, useLocalSearchParams } from "expo-router";
import { useLocal } from "../../src/events";
import { dayKeyOf, dayLabel, todayIso } from "../../src/dates";
import { classLabel, learnersOf, noSchoolReason, registerMarks, slotById, subjectName } from "../../src/queries";
import { saveRegister } from "../../src/ops";
import { RegisterEditor } from "../../src/register-editor";
import { Empty, Screen } from "../../src/ui";

/** The register of one lesson on the timetable. */
export default function PeriodRegister() {
  const { slotId, day = todayIso() } = useLocalSearchParams<{ slotId: string; day?: string }>();
  const d = useLocal(() => {
    const slot = slotById(slotId);
    if (!slot) return null;
    const off = noSchoolReason(day);
    return {
      slot,
      label: `${subjectName(slot.subjectId)} · ${classLabel(slot.classId)}`,
      learners: learnersOf(slot.classId),
      marks: registerMarks(slot.classId, day, slot.id),
      blocked: off
        ? `No register on ${off}.`
        : slot.dayOfWeek !== dayKeyOf(day)
          ? "This lesson isn't on the timetable that day."
          : day > todayIso()
            ? "This register opens on the day."
            : null,
    };
  }, [slotId, day]);
  if (!d) return <Screen><Empty text="This lesson is no longer on your timetable." /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: subjectName(d.slot.subjectId) }} />
      <RegisterEditor
        title={d.label}
        subtitle={`${dayLabel(day)} · ${d.slot.startTime}–${d.slot.endTime}`}
        learners={d.learners}
        marks={d.marks}
        blocked={d.blocked}
        onSave={(marks) => saveRegister({ classId: d.slot.classId, day, slot: d.slot, marks })}
      />
    </Screen>
  );
}
