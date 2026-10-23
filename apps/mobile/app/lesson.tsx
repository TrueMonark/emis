import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useLocal } from "../src/events";
import { useSession } from "../src/session";
import { dayKeyOf, dayLabel, todayIso } from "../src/dates";
import { classLabel, lessonLog, slotById, subjectName } from "../src/queries";
import { SaveError, saveLessonLog } from "../src/ops";
import { Banner, Button, Card, Empty, Field, Muted, Screen } from "../src/ui";
import { colors } from "../src/theme";

/** What was taught in a lesson (topic and subtopics). */
export default function LessonLog() {
  const { slotId, day = todayIso() } = useLocalSearchParams<{ slotId: string; day?: string }>();
  const { sync, online } = useSession();
  const d = useLocal(() => {
    const slot = slotById(slotId);
    return slot ? { slot, log: lessonLog(slot.id, day) } : null;
  }, [slotId, day]);
  const [topic, setTopic] = useState(d?.log?.topic ?? "");
  const [subtopics, setSubtopics] = useState(d?.log?.subtopics ?? "");

  if (!d) return <Screen><Empty text="This lesson is no longer on your timetable." /></Screen>;
  const wrongDay = d.slot.dayOfWeek !== dayKeyOf(day);

  const save = () => {
    try {
      saveLessonLog(d.slot, day, topic, subtopics);
      void sync();
      Alert.alert("Saved", online ? "Lesson log saved and being sent." : "Saved on the phone; sent when there's signal.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert("Not saved", e instanceof SaveError || e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Lesson log" }} />
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
          {subjectName(d.slot.subjectId)} · {classLabel(d.slot.classId)}
        </Text>
        <Muted>
          {dayLabel(day)} · {d.slot.startTime}–{d.slot.endTime}
        </Muted>
      </View>
      {d.log?.waiting && <Banner text="This log is waiting to be sent." />}
      {wrongDay ? (
        <Banner icon="lock-closed" text="This lesson isn't on the timetable that day." />
      ) : (
        <Card style={{ gap: 12 }}>
          <Field label="Topic" value={topic} onChangeText={setTopic} placeholder="e.g. Simultaneous equations" />
          <Field label="Subtopics / notes (optional)" value={subtopics} onChangeText={setSubtopics} multiline style={{ minHeight: 90, textAlignVertical: "top" }} />
          <Button title="Save lesson log" icon="save" onPress={save} />
        </Card>
      )}
    </Screen>
  );
}
