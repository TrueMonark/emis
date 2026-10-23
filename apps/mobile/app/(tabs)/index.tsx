import { RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocal } from "../../src/events";
import { useSession } from "../../src/session";
import { outbox, pendingCount } from "../../src/db";
import { useSyncState } from "../../src/sync";
import { dayKeyOf, dayLabel, todayIso } from "../../src/dates";
import {
  learnersOf,
  lessonLog,
  myAssessments,
  myClasses,
  myRegisterClasses,
  mySlots,
  mySpecialClasses,
  noSchoolReason,
  registerMarks,
  scoresOf,
} from "../../src/queries";
import { SyncStatus } from "../../src/status-banner";
import { StatCard } from "../../src/ui";
import { colors } from "../../src/theme";
import { TAB_BAR_SPACE } from "../../src/tab-bar";

/** Home: the day at a glance. Every card opens what it counts. */
export default function Home() {
  const { session, sync } = useSession();
  const { syncing } = useSyncState();
  const today = todayIso();

  const d = useLocal(() => {
    const off = noSchoolReason(today);
    const slots = off ? [] : mySlots(dayKeyOf(today));
    const now = new Date();
    const nowHm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const registers = off ? [] : myRegisterClasses(today);
    const dailyOpen = registers.filter((r) => registerMarks(r.classId, today, null).size < learnersOf(r.classId).length).length;
    const periodOpen = slots.filter((s) => s.startTime <= nowHm && registerMarks(s.classId, today, s.id).size === 0).length;
    const toLog = slots.filter((s) => s.startTime <= nowHm && !lessonLog(s.id, today)).length;

    const assessments = myAssessments().filter((a) => a.status === "PUBLISHED");
    const marksOpen = assessments.filter((a) => scoresOf(a.id).size < learnersOf(a.classId).length).length;

    const classes = myClasses();
    const special = mySpecialClasses().filter((s) => s.status === "APPROVED" && s.date.slice(0, 10) >= today).length;
    const specialWaiting = mySpecialClasses().filter((s) => s.status === "PENDING").length;
    const rejected = outbox("rejected").length;
    return {
      off,
      lessons: slots.length,
      next: slots.find((s) => s.endTime > nowHm),
      registersOpen: dailyOpen + periodOpen,
      dailyOpen,
      periodOpen,
      toLog,
      marksOpen,
      assessments: assessments.length,
      classes: classes.length,
      learners: classes.reduce((n, c) => n + c.learners, 0),
      special,
      specialWaiting,
      waiting: pendingCount(),
      rejected,
    };
  }, [today]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: TAB_BAR_SPACE + 16 }}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={sync} />}
      >
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>Hello, {session?.user.name.split(" ")[0]}</Text>
          <Text style={{ color: colors.muted }}>
            {dayLabel(today)}
            {session?.user.schoolName ? ` · ${session.user.schoolName}` : ""}
          </Text>
        </View>
        <SyncStatus />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <StatCard
            icon="time"
            label="Today's lessons"
            value={d.lessons}
            hint={d.off ? `No school: ${d.off}` : d.next ? `Next: ${d.next.startTime}` : d.lessons ? "Done for today" : "None on your timetable"}
            onPress={() => router.push("/timetable")}
          />
          <StatCard
            icon="checkbox"
            label="Registers to take"
            value={d.registersOpen}
            tone={d.registersOpen ? "amber" : "green"}
            hint={d.off ? "None today" : `${d.dailyOpen} daily · ${d.periodOpen} lessons so far`}
            onPress={() => router.push("/registers")}
          />
          <StatCard
            icon="school"
            label="Marks to enter"
            value={d.marksOpen}
            tone={d.marksOpen ? "amber" : "green"}
            hint={`${d.assessments} open assessment(s)`}
            onPress={() => router.push("/marks")}
          />
          <StatCard
            icon="cloud-upload"
            label="Waiting to sync"
            value={d.waiting}
            tone={d.rejected ? "red" : d.waiting ? "amber" : "green"}
            hint={d.rejected ? `${d.rejected} refused — tap to see why` : d.waiting ? "Sent when there's signal" : "Everything sent"}
            onPress={() => router.push("/sync")}
          />
          <StatCard icon="people" label="My classes" value={d.classes} hint={`${d.learners} learners`} onPress={() => router.push("/classes")} />
          <StatCard
            icon="book"
            label="Lessons to log"
            value={d.toLog}
            tone={d.toLog ? "amber" : "green"}
            hint="Today's lessons without a log"
            onPress={() => router.push("/timetable")}
          />
          <StatCard
            icon="calendar-number"
            label="Special classes"
            value={d.special}
            hint={d.specialWaiting ? `${d.specialWaiting} waiting for the HOD` : "Approved, coming up"}
            onPress={() => router.push("/special-classes")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
