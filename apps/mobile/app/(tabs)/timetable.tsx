import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useLocal } from "../../src/events";
import { WEEKDAYS, addDays, dayKeyOf, dayName, todayIso, type DayKey } from "../../src/dates";
import { classLabel, lessonLog, mySlots, noSchoolReason, registerMarks, subjectName } from "../../src/queries";
import { Banner, Card, Empty, Pill, Screen } from "../../src/ui";
import { colors } from "../../src/theme";

/** This week's date for a weekday (Monday–Friday of the current week). */
function dateThisWeek(key: DayKey): string {
  const today = todayIso();
  const order = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const diff = order.indexOf(key) - order.indexOf(dayKeyOf(today));
  return addDays(today, diff);
}

export default function Timetable() {
  const todayKey = dayKeyOf(todayIso());
  const [day, setDay] = useState<DayKey>(WEEKDAYS.includes(todayKey) ? todayKey : "MONDAY");
  const date = dateThisWeek(day);
  const isPastOrToday = date <= todayIso();

  const rows = useLocal(
    () =>
      mySlots(day).map((s) => ({
        slot: s,
        subject: subjectName(s.subjectId),
        klass: classLabel(s.classId),
        register: isPastOrToday ? registerMarks(s.classId, date, s.id).size : 0,
        logged: isPastOrToday ? !!lessonLog(s.id, date) : false,
      })),
    [day, date]
  );
  const off = noSchoolReason(date);

  return (
    <Screen>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {WEEKDAYS.map((k) => (
          <Pressable
            key={k}
            onPress={() => setDay(k)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: k === day ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: k === day ? colors.primary : colors.border,
            }}
          >
            <Text style={{ color: k === day ? colors.onPrimary : colors.text, fontWeight: "700" }}>{dayName(k).slice(0, 3)}</Text>
            {k === todayKey && <Text style={{ color: k === day ? colors.onPrimary : colors.primary, fontSize: 10 }}>today</Text>}
          </Pressable>
        ))}
      </View>
      {off && <Banner icon="sunny" text={`No school on ${date}: ${off}. Registers aren't taken.`} />}
      {rows.length === 0 ? (
        <Empty icon="calendar-outline" text={`No lessons on ${dayName(day)} on your timetable.`} />
      ) : (
        rows.map(({ slot, subject, klass, register, logged }) => (
          <Card key={slot.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "700", color: colors.text, fontSize: 16 }}>
                {slot.startTime}–{slot.endTime}
              </Text>
              <Text style={{ color: colors.muted }}>Period {slot.periodNumber}{slot.roomNumber ? ` · ${slot.roomNumber}` : ""}</Text>
            </View>
            <Text style={{ fontSize: 15, color: colors.text }}>
              {subject} · {klass}
            </Text>
            {isPastOrToday && !off && (
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Pressable onPress={() => router.push({ pathname: "/register/period", params: { slotId: slot.id, day: date } })}>
                  <Pill text={register ? `Register: ${register} marked` : "Take register"} tone={register ? "green" : "amber"} />
                </Pressable>
                <Pressable onPress={() => router.push({ pathname: "/lesson", params: { slotId: slot.id, day: date } })}>
                  <Pill text={logged ? "Lesson logged" : "Log lesson"} tone={logged ? "green" : "primary"} />
                </Pressable>
              </View>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}
