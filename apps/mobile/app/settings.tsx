import { useEffect, useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { usePrefs, reopenAfterThemeChange, type ReminderPrefs, type ThemeMode } from "../src/prefs";
import { ensurePermission, permissionGranted, planReminders, sendTestReminder } from "../src/reminders";
import { Banner, Button, Card, Label, Muted, Screen } from "../src/ui";
import { colors } from "../src/theme";

function Choice<T extends string | number>({ options, value, onChange, format }: { options: T[]; value: T; onChange: (v: T) => void; format?: (v: T) => string }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={String(o)}
            onPress={() => onChange(o)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: on ? colors.primary : colors.border,
              backgroundColor: on ? colors.primary : colors.card,
            }}
          >
            <Text style={{ color: on ? colors.onPrimary : colors.text, fontWeight: "600" }}>{format ? format(o) : String(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Toggle({ title, sub, value, onChange, children }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <View style={{ gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 15 }}>{title}</Text>
          <Muted style={{ fontSize: 12 }}>{sub}</Muted>
        </View>
        <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} />
      </View>
      {value && children}
    </View>
  );
}

const mins = (m: number) => `${m} min`;

/** Light / dark, and which reminders this phone gives. */
export default function Settings() {
  const { prefs, update } = usePrefs();
  const r = prefs.reminders;
  const [granted, setGranted] = useState<boolean | null>(null);
  const upcoming = planReminders(r).length;

  useEffect(() => {
    permissionGranted().then(setGranted).catch(() => setGranted(false));
  }, []);

  const set = <K extends keyof ReminderPrefs>(key: K, value: ReminderPrefs[K]) =>
    update((p) => ({ ...p, reminders: { ...p.reminders, [key]: value } }));
  const setTheme = (theme: ThemeMode) => {
    if (theme === prefs.theme) return;
    reopenAfterThemeChange("/settings");
    update((p) => ({ ...p, theme }));
  };

  return (
    <Screen>
      <Card style={{ gap: 10 }}>
        <Label>Appearance</Label>
        <Choice<ThemeMode>
          options={["system", "light", "dark"]}
          value={prefs.theme}
          onChange={setTheme}
          format={(t) => (t === "system" ? "Follow the phone" : t === "light" ? "Light" : "Dark")}
        />
      </Card>

      <Card>
        <Label>Reminders</Label>
        <Muted style={{ fontSize: 12, marginTop: 4 }}>
          They come from the phone itself, so they work without signal. None on weekends, public holidays or closure days, and none
          between {r.quietAfter} and {r.quietBefore}.
        </Muted>
        {granted === false && (
          <View style={{ gap: 8, marginTop: 10 }}>
            <Banner tone="red" icon="notifications-off" text="Notifications are off for this app in the phone's settings, so no reminders will show." />
            <Button
              title="Allow notifications"
              kind="outline"
              onPress={async () => {
                const ok = await ensurePermission();
                setGranted(ok);
                if (!ok) void Linking.openSettings();
              }}
            />
          </View>
        )}
        <Toggle title="Before each lesson" sub="From your timetable" value={r.lessons.on} onChange={(on) => set("lessons", { ...r.lessons, on })}>
          <Choice options={[5, 10, 15, 20]} value={r.lessons.minutes} onChange={(minutes) => set("lessons", { ...r.lessons, minutes })} format={mins} />
        </Toggle>
        <Toggle
          title="Morning register"
          sub="For your class (or one you're covering), if it isn't taken yet"
          value={r.register.on}
          onChange={(on) => set("register", { ...r.register, on })}
        >
          <Choice options={["06:45", "07:00", "07:20", "07:45", "08:00"]} value={r.register.time} onChange={(time) => set("register", { ...r.register, time })} />
        </Toggle>
        <Toggle title="Lesson logs" sub="Later in the day, if today's lessons aren't logged" value={r.logs.on} onChange={(on) => set("logs", { ...r.logs, on })}>
          <Choice options={["13:30", "15:00", "15:30", "16:30", "18:00"]} value={r.logs.time} onChange={(time) => set("logs", { ...r.logs, time })} />
        </Toggle>
        <Toggle title="Special classes" sub="Before an approved weekend or holiday class" value={r.special.on} onChange={(on) => set("special", { ...r.special, on })}>
          <Choice options={[15, 30, 60]} value={r.special.minutes} onChange={(minutes) => set("special", { ...r.special, minutes })} format={mins} />
        </Toggle>
        <Toggle title="Not sent yet" sub="Two hours after saving, if changes are still waiting to sync" value={r.unsynced.on} onChange={(on) => set("unsynced", { on })} />
        <Toggle title="Offline limit" sub="Two days before the phone must sync to keep saving" value={r.offlineLimit.on} onChange={(on) => set("offlineLimit", { on })} />
        <View style={{ gap: 8, paddingTop: 12 }}>
          <Muted>{upcoming} reminder(s) set for the next 7 days.</Muted>
          <Button title="Send a test reminder (in 5 seconds)" kind="outline" icon="notifications" onPress={() =>
              sendTestReminder()
                .then(() => Alert.alert("Test reminder", "It will show in about 5 seconds. Lock the phone or leave the app to see it."))
                .catch((e) => Alert.alert("Couldn't set the test reminder", e instanceof Error ? e.message : String(e)))
                .finally(() => void permissionGranted().then(setGranted))
            } />
        </View>
      </Card>
    </Screen>
  );
}
