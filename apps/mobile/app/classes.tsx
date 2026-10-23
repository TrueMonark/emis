import { router } from "expo-router";
import { useLocal } from "../src/events";
import { myClasses } from "../src/queries";
import { Card, Empty, Pill, Row, Screen } from "../src/ui";

/** Classes I teach or am class teacher of. */
export default function Classes() {
  const classes = useLocal(() => myClasses());
  return (
    <Screen>
      <Card>
        {classes.length === 0 ? (
          <Empty icon="people-outline" text="No classes on your account this year." />
        ) : (
          classes.map((c) => (
            <Row
              key={c.classId}
              title={c.label}
              sub={c.roles.join(" · ")}
              right={<Pill text={`${c.learners} learners`} />}
              onPress={() => router.push({ pathname: "/class/[id]", params: { id: c.classId } })}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
