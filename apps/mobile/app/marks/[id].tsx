import { useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useLocal } from "../../src/events";
import { useSession } from "../../src/session";
import { assessmentById, classLabel, learnersOf, scoresOf, studentName, subjectName } from "../../src/queries";
import { SaveError, saveMarks } from "../../src/ops";
import { Banner, Button, Card, Empty, Muted, Pill, Screen } from "../../src/ui";
import { colors } from "../../src/theme";

type Draft = { text: string; absent: boolean };

/**
 * Enter marks for an assessment, offline or not. Each learner: a mark out of the total, or AB
 * (absent). The server refuses marks once the assessment is completed or the entry window has
 * closed, and keeps a newer mark made on the web (you'll see it on the Sync page).
 */
export default function EnterMarks() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sync, online } = useSession();
  const d = useLocal(() => {
    const a = assessmentById(id);
    return a ? { a, learners: learnersOf(a.classId), scores: scoresOf(a.id) } : null;
  }, [id]);
  const [draft, setDraft] = useState<Map<string, Draft>>(new Map());

  const entered = useMemo(() => {
    if (!d) return 0;
    return d.learners.filter((l) => {
      const x = draft.get(l.id);
      return x ? x.absent || x.text.trim() !== "" : d.scores.has(l.id);
    }).length;
  }, [d, draft]);

  if (!d) return <Screen><Empty text="This assessment isn't on the phone any more." /></Screen>;
  const { a, learners, scores } = d;
  const editable = a.status === "PUBLISHED";

  const shown = (studentId: string): Draft => {
    const x = draft.get(studentId);
    if (x) return x;
    const s = scores.get(studentId);
    return s ? { text: s.isAbsent ? "" : String(s.marksObtained), absent: s.isAbsent } : { text: "", absent: false };
  };
  const set = (studentId: string, patch: Partial<Draft>) => setDraft((m) => new Map(m).set(studentId, { ...shown(studentId), ...patch }));

  const save = () => {
    const entries = [...draft.entries()].map(([studentId, x]) => {
      const n = x.text.trim() === "" ? null : Number(x.text.replace(",", "."));
      return { studentId, marks: n === null || Number.isNaN(n) ? null : n, absent: x.absent };
    });
    const bad = entries.find((e) => !e.absent && e.marks === null && draft.get(e.studentId)!.text.trim() !== "");
    if (bad) return Alert.alert("Not saved", "Marks must be numbers");
    try {
      const n = saveMarks(a, entries);
      setDraft(new Map());
      void sync();
      Alert.alert("Saved", n === 0 ? "Nothing had changed." : online ? `${n} mark(s) saved and being sent.` : `${n} mark(s) saved on the phone; sent when there's signal.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Not saved", e instanceof SaveError || e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Marks" }} />
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>{a.title}</Text>
        <Muted>
          {subjectName(a.subjectId)} · {classLabel(a.classId)} · out of {a.totalMarks} (pass {a.passMark})
        </Muted>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
          <Pill text={`${entered}/${learners.length} entered`} tone={entered >= learners.length ? "green" : "amber"} />
          {[...scores.values()].some((s) => s.waiting) && <Pill text="waiting to send" tone="amber" />}
        </View>
      </View>
      {!editable && <Banner icon="lock-closed" text="This assessment is completed: marks can only be looked at." />}
      <Card style={{ paddingVertical: 4 }}>
        {learners.map((l, i) => {
          const x = shown(l.id);
          const n = Number(x.text);
          const over = !x.absent && x.text !== "" && (Number.isNaN(n) || n < 0 || n > a.totalMarks);
          return (
            <View
              key={l.id}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: i < learners.length - 1 ? 1 : 0, borderBottomColor: colors.border }}
            >
              <Text style={{ width: 24, color: colors.muted }}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "600" }} numberOfLines={1}>
                  {studentName(l)}
                </Text>
                {scores.get(l.id)?.waiting && !draft.has(l.id) ? <Text style={{ color: colors.amber, fontSize: 11 }}>waiting to send</Text> : null}
              </View>
              {x.absent ? (
                <Text style={{ width: 64, textAlign: "center", fontWeight: "700", color: colors.amber }}>AB</Text>
              ) : (
                <TextInput
                  value={x.text}
                  editable={editable}
                  onChangeText={(t) => set(l.id, { text: t })}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colors.grey}
                  style={{
                    width: 64,
                    textAlign: "center",
                    borderWidth: 1,
                    borderColor: over ? colors.red : colors.border,
                    borderRadius: 8,
                    paddingVertical: 8,
                    fontSize: 16,
                    color: colors.text,
                    backgroundColor: colors.input,
                  }}
                />
              )}
              <Pressable
                disabled={!editable}
                onPress={() => set(l.id, { absent: !x.absent, text: x.absent ? x.text : "" })}
                style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: x.absent ? colors.amber : colors.amberSoft, opacity: editable ? 1 : 0.5 }}
                accessibilityLabel="absent"
              >
                <Text style={{ color: x.absent ? colors.onPrimary : colors.amber, fontWeight: "700" }}>AB</Text>
              </Pressable>
            </View>
          );
        })}
      </Card>
      {editable && <Button title={`Save marks${draft.size ? ` (${draft.size})` : ""}`} icon="save" onPress={save} disabled={draft.size === 0} />}
    </Screen>
  );
}
