import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocal } from "../src/events";
import { dateTimeLabel } from "../src/dates";
import { announcements } from "../src/queries";
import { acknowledgeAnnouncement, markAnnouncementRead } from "../src/ops";
import { syncNow } from "../src/sync";
import { useSession } from "../src/session";
import { colors } from "../src/theme";
import { Banner, Button, Card, Empty, Muted, Pill, Screen } from "../src/ui";

const FROM: Record<string, string> = { HQ: "HQ", PROVINCIAL: "PEO", DISTRICT: "DEBS" };
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Announcements from the education offices (Phase 9c), kept on the phone and readable offline.
 * Opening one records that it was read; the head or deputy can acknowledge it for the school.
 * Both are sent with the next sync. Attachments open on the website (they're private files).
 */
export default function Announcements() {
  const { session } = useSession();
  const list = useLocal(() => announcements());
  const [open, setOpen] = useState<string | null>(null);

  const toggle = (id: string, read: boolean) => {
    const next = open === id ? null : id;
    setOpen(next);
    if (next) {
      markAnnouncementRead(id, read);
      if (session && !read) syncNow(session).catch(() => undefined);
    }
  };

  const acknowledge = (id: string, title: string) =>
    Alert.alert("Acknowledge for the school?", "The office will see that your school has received this announcement.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Acknowledge",
        onPress: () => {
          acknowledgeAnnouncement(id, title);
          if (session) syncNow(session).catch(() => undefined);
        },
      },
    ]);

  return (
    <Screen>
      {list.length === 0 ? (
        <Card>
          <Empty icon="megaphone-outline" text="No announcements yet. They arrive with each sync." />
        </Card>
      ) : (
        list.map((a) => {
          const isOpen = open === a.id;
          return (
            <Card key={a.id} style={{ gap: 8, borderColor: a.canAcknowledge ? colors.amber : undefined, borderWidth: a.canAcknowledge ? 1 : 0 }}>
              <Pressable onPress={() => toggle(a.id, !!a.readAt)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: a.readAt ? "transparent" : colors.primary }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: a.readAt ? "500" : "700" }}>{a.title}</Text>
                  <Muted>
                    {FROM[a.office.type] ?? ""} {a.office.name} · {dateTimeLabel(a.publishedAt)}
                  </Muted>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                    {a.withdrawnAt ? <Pill text="Withdrawn" /> : null}
                    {a.canAcknowledge ? <Pill text="Acknowledge" tone="amber" /> : null}
                    {a.ackWaiting ? <Pill text="Acknowledgement waiting to send" tone="amber" /> : null}
                    {a.schoolAcknowledged ? <Pill text="Acknowledged" tone="green" /> : null}
                  </View>
                </View>
                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.grey} />
              </Pressable>
              {isOpen ? (
                <View style={{ gap: 10 }}>
                  {a.withdrawnAt ? (
                    <Banner tone="grey" text={`Withdrawn by the office on ${dateTimeLabel(a.withdrawnAt)}${a.withdrawReason ? `: ${a.withdrawReason}` : ""}`} />
                  ) : null}
                  <Text style={{ color: colors.text, lineHeight: 21 }}>{a.body}</Text>
                  {a.attachments.length > 0 ? (
                    <View style={{ gap: 4 }}>
                      {a.attachments.map((f, i) => (
                        <View key={i} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                          <Ionicons name="attach" size={16} color={colors.muted} />
                          <Muted>
                            {f.fileName} ({size(f.sizeBytes)})
                          </Muted>
                        </View>
                      ))}
                      <Muted>Open the attachments on the website (Announcements).</Muted>
                    </View>
                  ) : null}
                  {a.schoolAcknowledged ? (
                    <Muted>
                      Acknowledged for the school{a.schoolAcknowledged.by ? ` by ${a.schoolAcknowledged.by}` : ""} on {dateTimeLabel(a.schoolAcknowledged.at)}
                    </Muted>
                  ) : a.canAcknowledge ? (
                    <Button title="Acknowledge for the school" icon="checkmark-done" onPress={() => acknowledge(a.id, a.title)} />
                  ) : a.requiresAck && !a.withdrawnAt && !a.ackWaiting ? (
                    <Muted>The office has asked the head teacher or deputy to acknowledge this.</Muted>
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
