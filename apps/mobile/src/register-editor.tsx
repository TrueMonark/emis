import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { router } from "expo-router";
import { useSession } from "./session";
import { SaveError } from "./ops";
import { studentName, type AttendanceStatus, type Mark, type Student } from "./queries";
import { Banner, Button, Card, Empty, Muted, Pill, StatusPicker } from "./ui";
import { colors } from "./theme";

/**
 * A register: one row per learner with P / A / L / E. "All present" fills the unmarked ones.
 * Saving keeps it on the phone and sends it when there's signal.
 */
export function RegisterEditor({
  title,
  subtitle,
  learners,
  marks,
  blocked,
  onSave,
}: {
  title: string;
  subtitle?: string;
  learners: Student[];
  marks: Map<string, Mark>;
  /** Why this register can't be taken (shown instead of the buttons) */
  blocked?: string | null;
  onSave: (marks: { studentId: string; status: AttendanceStatus }[]) => number | void;
}) {
  const { sync, online } = useSession();
  const [draft, setDraft] = useState<Map<string, AttendanceStatus>>(new Map());
  // What's saved (server or waiting to send); the teacher's taps stay on top until saved, even
  // if a sync brings new data meanwhile.
  const saved = useMemo(() => new Map([...marks].map(([id, m]) => [id, m.status])), [marks]);

  const value = (id: string) => draft.get(id) ?? saved.get(id) ?? null;
  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, none: 0 };
    for (const l of learners) {
      const v = draft.get(l.id) ?? saved.get(l.id);
      if (v) c[v]++;
      else c.none++;
    }
    return c;
  }, [learners, draft, saved]);
  const waiting = [...marks.values()].some((m) => m.waiting);

  const set = (id: string, v: AttendanceStatus) => setDraft((d) => new Map(d).set(id, v));
  const allPresent = () =>
    setDraft((d) => {
      const n = new Map(d);
      for (const l of learners) if (!n.get(l.id) && !saved.get(l.id)) n.set(l.id, "PRESENT");
      return n;
    });

  const save = () => {
    const out = learners.map((l) => ({ studentId: l.id, status: value(l.id) })).filter((x): x is { studentId: string; status: AttendanceStatus } => !!x.status);
    try {
      const n = onSave(out);
      setDraft(new Map());
      void sync();
      Alert.alert(
        "Saved",
        n === 0 ? "Nothing had changed." : online ? "Saved and being sent now." : "Saved on the phone. It will be sent when there's signal.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert("Not saved", e instanceof SaveError || e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>{title}</Text>
        {subtitle ? <Muted>{subtitle}</Muted> : null}
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          <Pill text={`${counts.PRESENT} present`} tone="green" />
          <Pill text={`${counts.ABSENT} absent`} tone="red" />
          <Pill text={`${counts.LATE} late`} tone="amber" />
          <Pill text={`${counts.EXCUSED} excused`} />
          {counts.none > 0 && <Pill text={`${counts.none} not marked`} tone="primary" />}
          {waiting && <Pill text="waiting to send" tone="amber" />}
        </View>
      </View>
      {blocked ? (
        <Banner icon="lock-closed" text={blocked} />
      ) : (
        <Button title="Mark the rest present" kind="outline" icon="checkmark-done" onPress={allPresent} disabled={counts.none === 0} />
      )}
      <Card style={{ paddingVertical: 4 }}>
        {learners.length === 0 ? (
          <Empty icon="people-outline" text="No learners on this class list." />
        ) : (
          learners.map((l, i) => (
            <View
              key={l.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 10,
                gap: 8,
                borderBottomWidth: i < learners.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ width: 24, color: colors.muted }}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "600" }} numberOfLines={1}>
                  {studentName(l)}
                </Text>
                {marks.get(l.id)?.waiting && !draft.has(l.id) ? <Text style={{ color: colors.amber, fontSize: 11 }}>waiting to send</Text> : null}
              </View>
              <StatusPicker value={value(l.id)} onChange={(v) => set(l.id, v)} disabled={!!blocked} />
            </View>
          ))
        )}
      </Card>
      {!blocked && <Button title="Save register" icon="save" onPress={save} disabled={learners.length === 0} />}
    </View>
  );
}
