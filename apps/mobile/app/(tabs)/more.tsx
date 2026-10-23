import { router } from "expo-router";
import { useLocal } from "../../src/events";
import { useSession } from "../../src/session";
import { lastSyncAt, offlineDays, pendingCount } from "../../src/sync";
import { dateTimeLabel } from "../../src/dates";
import { confirmSignOut } from "../../src/screens/auth";
import { Button, Card, Label, Muted, Row, Screen } from "../../src/ui";

export default function More() {
  const { session, signOut } = useSession();
  const info = useLocal(() => ({ last: lastSyncAt(), days: offlineDays(), waiting: pendingCount() }));
  return (
    <Screen>
      <Card style={{ gap: 4 }}>
        <Label>{session?.user.name}</Label>
        <Muted>{session?.user.email}</Muted>
        {session?.user.schoolName ? <Muted>{session.user.schoolName}</Muted> : null}
      </Card>
      <Card>
        <Row title="Sync" sub={`Last synced ${dateTimeLabel(info.last)} · ${info.waiting} waiting`} onPress={() => router.push("/sync")} />
        <Row title="My classes" onPress={() => router.push("/classes")} />
        <Row title="Special classes" onPress={() => router.push("/special-classes")} />
        <Row title="Reminders & appearance" sub="Lesson alarms, register reminders, light or dark" onPress={() => router.push("/settings")} />
      </Card>
      <Card style={{ gap: 4 }}>
        <Label>This phone</Label>
        <Muted>Server: {session?.serverUrl}</Muted>
        <Muted>Works offline for up to {info.days} days between syncs. Locks after 2 minutes in the background.</Muted>
        <Muted>Learners' birth dates, addresses and medical details are never stored on the phone.</Muted>
      </Card>
      <Button title="Sign out" kind="danger" icon="log-out" onPress={() => confirmSignOut(signOut)} />
      <Muted style={{ textAlign: "center" }}>Monark Edu · by Monark Devs</Muted>
    </Screen>
  );
}
