import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocal } from "../src/events";
import { useSession } from "../src/session";
import { outbox, type OutboxItem } from "../src/db";
import { useSyncState } from "../src/sync";
import { dateTimeLabel } from "../src/dates";
import { SyncStatus } from "../src/status-banner";
import { CrownLoader } from "../src/loader";
import { Button, Card, Empty, Label, Muted, Pill } from "../src/ui";
import { colors } from "../src/theme";

/** What happened to the changes made on this phone: waiting, sent, or refused (and why). */
function conflictsOf(item: OutboxItem): number {
  const r = item.result as { conflicts?: unknown[] } | null;
  return Array.isArray(r?.conflicts) ? r!.conflicts!.length : 0;
}

export default function SyncPage() {
  const { sync, online } = useSession();
  const { syncing } = useSyncState();
  const items = useLocal(() => outbox());
  const waiting = items.filter((i) => i.status === "pending");
  const refused = items.filter((i) => i.status === "rejected");
  const sent = items.filter((i) => i.status === "applied");

  const item = (i: OutboxItem) => {
    const conflicts = conflictsOf(i);
    return (
      <View key={i.opId} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 4 }}>
        <Text style={{ color: colors.text, fontWeight: "600" }}>{i.label}</Text>
        <Muted style={{ fontSize: 12 }}>Saved {dateTimeLabel(i.madeAt)}{i.status !== "pending" ? ` · answered ${dateTimeLabel(i.updatedAt)}` : ""}</Muted>
        {i.status === "rejected" && <Text style={{ color: colors.red }}>{i.error}</Text>}
        {conflicts > 0 && (
          <Text style={{ color: colors.amber }}>
            {conflicts} learner(s) were changed by someone else after you; their newer mark was kept.
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={syncing} onRefresh={sync} />}>
        <SyncStatus />
        {syncing && <CrownLoader size={90} text="Syncing with the school…" />}
        <Button title={syncing ? "Syncing…" : "Sync now"} icon="sync" onPress={sync} busy={syncing} disabled={!online} />
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Label>Waiting to send</Label>
            <Pill text={String(waiting.length)} tone={waiting.length ? "amber" : "green"} />
          </View>
          {waiting.length ? waiting.map(item) : <Empty icon="checkmark-circle-outline" text="Nothing waiting." />}
        </Card>
        {refused.length > 0 && (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Label>Refused by the school system</Label>
              <Pill text={String(refused.length)} tone="red" />
            </View>
            <Muted style={{ fontSize: 12 }}>These weren't saved. Fix the reason (or ask the head teacher) and save again.</Muted>
            {refused.map(item)}
          </Card>
        )}
        <Card>
          <Label>Sent (last two weeks)</Label>
          {sent.length ? sent.map(item) : <Empty icon="cloud-done-outline" text="Nothing sent yet." />}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
