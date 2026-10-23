import { Stack, useLocalSearchParams } from "expo-router";
import { useLocal } from "../../src/events";
import { dayLabel, todayIso } from "../../src/dates";
import { classLabel, learnersOf, myRegisterClasses, noSchoolReason, registerMarks } from "../../src/queries";
import { saveRegister } from "../../src/ops";
import { RegisterEditor } from "../../src/register-editor";
import { Screen } from "../../src/ui";

/** The morning register of a class (class teacher, or a teacher covering it). */
export default function DailyRegister() {
  const { classId, day = todayIso() } = useLocalSearchParams<{ classId: string; day?: string }>();
  const d = useLocal(() => {
    const off = noSchoolReason(day);
    const mine = myRegisterClasses(day).some((r) => r.classId === classId);
    return {
      label: classLabel(classId),
      learners: learnersOf(classId),
      marks: registerMarks(classId, day, null),
      blocked: off
        ? `No register on ${off}.`
        : day > todayIso()
          ? "This register opens on the day."
          : !mine
            ? "You're not this class's class teacher (or covering it) on this day."
            : null,
    };
  }, [classId, day]);
  return (
    <Screen>
      <Stack.Screen options={{ title: d.label }} />
      <RegisterEditor
        title={`Daily register · ${d.label}`}
        subtitle={dayLabel(day)}
        learners={d.learners}
        marks={d.marks}
        blocked={d.blocked}
        onSave={(marks) => saveRegister({ classId, day, slot: null, marks })}
      />
    </Screen>
  );
}
