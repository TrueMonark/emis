import { useState } from "react";
import { router } from "expo-router";
import { useLocal } from "../../src/events";
import { dayKeyOf, todayIso } from "../../src/dates";
import { classLabel, learnersOf, myRegisterClasses, mySlots, mySpecialClasses, noSchoolReason, registerMarks, subjectName } from "../../src/queries";
import { DayPicker } from "../../src/day-picker";
import { Banner, Button, Card, Empty, Label, Pill, Row, Screen } from "../../src/ui";

/** Registers for a day: the daily register of my class(es), my lessons, special classes. */
export default function Registers() {
  const [day, setDay] = useState(todayIso());
  const off = noSchoolReason(day);
  const d = useLocal(() => {
    const daily = off ? [] : myRegisterClasses(day).map((r) => ({ ...r, marked: registerMarks(r.classId, day, null).size, learners: learnersOf(r.classId).length }));
    const lessons = off
      ? []
      : mySlots(dayKeyOf(day)).map((s) => ({ slot: s, marked: registerMarks(s.classId, day, s.id).size, learners: learnersOf(s.classId).length }));
    const special = mySpecialClasses().filter((s) => s.date.slice(0, 10) === day);
    return { daily, lessons, special };
  }, [day, off]);

  return (
    <Screen>
      <DayPicker day={day} onChange={setDay} />
      {off && <Banner icon="sunny" text={`No registers on ${off}. Lessons that day are special classes (approved by your HOD).`} />}

      {!off && (
        <Card>
          <Label>Daily register</Label>
          {d.daily.length === 0 ? (
            <Empty icon="people-outline" text="You're not a class teacher (and have no register cover) on this day." />
          ) : (
            d.daily.map((r) => (
              <Row
                key={r.classId}
                title={r.label}
                sub={r.cover ? "Register cover" : "Class teacher"}
                right={<Pill text={`${r.marked}/${r.learners}`} tone={r.marked >= r.learners && r.learners > 0 ? "green" : r.marked ? "amber" : "grey"} />}
                onPress={() => router.push({ pathname: "/register/daily", params: { classId: r.classId, day } })}
              />
            ))
          )}
        </Card>
      )}

      {!off && (
        <Card>
          <Label>My lessons</Label>
          {d.lessons.length === 0 ? (
            <Empty icon="time-outline" text="No lessons on your timetable this day." />
          ) : (
            d.lessons.map(({ slot, marked, learners }) => (
              <Row
                key={slot.id}
                title={`${slot.startTime} ${subjectName(slot.subjectId)}`}
                sub={classLabel(slot.classId)}
                right={<Pill text={`${marked}/${learners}`} tone={marked >= learners && learners > 0 ? "green" : marked ? "amber" : "grey"} />}
                onPress={() => router.push({ pathname: "/register/period", params: { slotId: slot.id, day } })}
              />
            ))
          )}
        </Card>
      )}

      {d.special.length > 0 && (
        <Card>
          <Label>Special classes</Label>
          {d.special.map((sc) => (
            <Row
              key={sc.id}
              title={`${sc.startTime} ${sc.topic}`}
              sub={`${subjectName(sc.subjectId)} · ${classLabel(sc.classId)}`}
              right={<Pill text={sc.status === "APPROVED" ? "Approved" : sc.status === "PENDING" ? "Waiting for HOD" : sc.status.toLowerCase()} tone={sc.status === "APPROVED" ? "green" : "amber"} />}
              onPress={sc.status === "APPROVED" ? () => router.push({ pathname: "/register/special", params: { id: sc.id } }) : undefined}
            />
          ))}
        </Card>
      )}
      {off && <Button title="Special classes" kind="outline" icon="calendar-number" onPress={() => router.push("/special-classes")} />}
    </Screen>
  );
}
