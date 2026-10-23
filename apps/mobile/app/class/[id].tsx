import { Stack, router, useLocalSearchParams } from "expo-router";
import { useLocal } from "../../src/events";
import { todayIso } from "../../src/dates";
import { classLabel, learnersOf, myRegisterClasses, studentName } from "../../src/queries";
import { Button, Card, Empty, Muted, Row, Screen } from "../../src/ui";

/** A class list (names and learner numbers only: other details stay on the website). */
export default function ClassPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useLocal(() => ({ label: classLabel(id), learners: learnersOf(id), mine: myRegisterClasses(todayIso()).some((r) => r.classId === id) }), [id]);
  return (
    <Screen>
      <Stack.Screen options={{ title: d.label }} />
      {d.mine && <Button title="Take today's register" icon="checkbox" onPress={() => router.push({ pathname: "/register/daily", params: { classId: id, day: todayIso() } })} />}
      <Muted>{d.learners.length} learners</Muted>
      <Card>
        {d.learners.length === 0 ? (
          <Empty text="No learners on this class list." />
        ) : (
          d.learners.map((l, i) => <Row key={l.id} title={`${i + 1}. ${studentName(l)}`} sub={l.learnerNumber ?? undefined} />)
        )}
      </Card>
    </Screen>
  );
}
