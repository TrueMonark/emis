import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, gap, radius } from "./theme";
import { TAB_BAR_SPACE } from "./tab-bar";
import type { AttendanceStatus } from "./queries";

/** Building blocks of the app's screens. */

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const inner = <View style={[padded && { padding: 16, gap }]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["bottom"]}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + 16 }}>{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export const Card = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => <View style={[st().card, style]}>{children}</View>;

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={st().title}>{children}</Text>
      {sub ? <Text style={st().muted}>{sub}</Text> : null}
    </View>
  );
}

export const Muted = ({ children, style }: { children: ReactNode; style?: object }) => <Text style={[st().muted, style]}>{children}</Text>;
export const Label = ({ children }: { children: ReactNode }) => <Text style={st().label}>{children}</Text>;

type IconName = keyof typeof Ionicons.glyphMap;

/** A dashboard card: tap it to open what it counts. */
export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "primary",
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "primary" | "green" | "amber" | "red" | "grey";
  onPress: () => void;
}) {
  const t = TONES[tone];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st().card, st().stat, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
      <View style={[st().statIcon, { backgroundColor: t.soft }]}>
        <Ionicons name={icon} size={20} color={t.fg} />
      </View>
      <Text style={st().statValue}>{value}</Text>
      <Text style={st().statLabel}>{label}</Text>
      {hint ? <Text style={st().mutedSmall} numberOfLines={2}>{hint}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.grey} style={{ position: "absolute", top: 14, right: 12 }} />
    </Pressable>
  );
}

type Tone = "primary" | "green" | "amber" | "red" | "grey";
const TONES: Record<Tone, { readonly fg: string; readonly soft: string }> = {
  get primary() { return { fg: colors.primary, soft: colors.primarySoft }; },
  get green() { return { fg: colors.green, soft: colors.greenSoft }; },
  get amber() { return { fg: colors.amber, soft: colors.amberSoft }; },
  get red() { return { fg: colors.red, soft: colors.redSoft }; },
  get grey() { return { fg: colors.muted, soft: colors.greySoft }; },
};

export function Button({
  title,
  onPress,
  kind = "primary",
  disabled,
  busy,
  icon,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "outline" | "danger";
  disabled?: boolean;
  busy?: boolean;
  icon?: IconName;
}) {
  const bg = kind === "primary" ? colors.primary : kind === "danger" ? colors.red : colors.card;
  const fg = kind === "outline" ? colors.primary : colors.onPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        st().button,
        { backgroundColor: bg, borderColor: kind === "outline" ? colors.border : bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
      accessibilityRole="button"
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[st().buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <TextInput placeholderTextColor={colors.grey} style={st().input} {...props} />
    </View>
  );
}

export function Pill({ text, tone = "grey" }: { text: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View style={[st().pill, { backgroundColor: t.soft }]}>
      <Text style={{ color: t.fg, fontSize: 12, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}

export function Banner({ text, tone = "amber", icon = "information-circle" }: { text: string; tone?: Tone; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View style={[st().banner, { backgroundColor: t.soft }]}>
      <Ionicons name={icon} size={18} color={t.fg} />
      <Text style={{ color: t.fg, flex: 1 }}>{text}</Text>
    </View>
  );
}

export function Empty({ icon = "file-tray-outline", text }: { icon?: IconName; text: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
      <Ionicons name={icon} size={36} color={colors.grey} />
      <Muted style={{ textAlign: "center" }}>{text}</Muted>
    </View>
  );
}

/** A tappable row with a title, a line under it and something on the right. */
export function Row({ title, sub, right, onPress }: { title: string; sub?: string; right?: ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st().row, pressed && onPress && { backgroundColor: colors.greySoft }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={st().rowTitle}>{title}</Text>
        {sub ? <Text style={st().mutedSmall}>{sub}</Text> : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.grey} /> : null}
    </Pressable>
  );
}

const statuses = (): { value: AttendanceStatus; short: string; fg: string; bg: string }[] => [
  { value: "PRESENT", short: "P", fg: colors.green, bg: colors.greenSoft },
  { value: "ABSENT", short: "A", fg: colors.red, bg: colors.redSoft },
  { value: "LATE", short: "L", fg: colors.amber, bg: colors.amberSoft },
  { value: "EXCUSED", short: "E", fg: colors.muted, bg: colors.greySoft },
];

/** P / A / L / E buttons for one learner. */
export function StatusPicker({ value, onChange, disabled }: { value: AttendanceStatus | null; onChange: (v: AttendanceStatus) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {statuses().map((x) => {
        const on = value === x.value;
        return (
          <Pressable
            key={x.value}
            disabled={disabled}
            onPress={() => onChange(x.value)}
            accessibilityLabel={x.value.toLowerCase()}
            style={[st().status, { backgroundColor: on ? x.fg : x.bg, opacity: disabled ? 0.5 : 1 }]}
          >
            <Text style={{ color: on ? colors.onPrimary : x.fg, fontWeight: "700" }}>{x.short}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius, padding: 14, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  muted: { color: colors.muted, fontSize: 14 },
  mutedSmall: { color: colors.muted, fontSize: 12 },
  label: { color: colors.text, fontWeight: "600", fontSize: 14 },
  stat: { flex: 1, minWidth: 150, gap: 4 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  button: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  buttonText: { fontWeight: "700", fontSize: 15 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: colors.text },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
  banner: { flexDirection: "row", gap: 8, alignItems: "center", padding: 12, borderRadius: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  status: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
});

// Styles depend on the palette (light or dark): made once per palette.
const cache: Partial<Record<"light" | "dark", ReturnType<typeof makeStyles>>> = {};
export const st = () => (cache[colors.scheme] ??= makeStyles());
