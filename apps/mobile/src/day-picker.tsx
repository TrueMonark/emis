import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addDays, dayLabel, todayIso } from "./dates";
import { colors } from "./theme";

/** ‹ Fri 16/10/2026 › — no later than today, at most `back` days ago. */
export function DayPicker({ day, onChange, back = 21 }: { day: string; onChange: (d: string) => void; back?: number }) {
  const today = todayIso();
  const min = addDays(today, -back);
  const btn = (name: "chevron-back" | "chevron-forward", to: string, disabled: boolean) => (
    <Pressable onPress={() => onChange(to)} disabled={disabled} style={{ padding: 8, opacity: disabled ? 0.3 : 1 }} accessibilityLabel={name === "chevron-back" ? "Previous day" : "Next day"}>
      <Ionicons name={name} size={22} color={colors.primary} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
      {btn("chevron-back", addDays(day, -1), day <= min)}
      <Pressable onPress={() => onChange(today)}>
        <Text style={{ fontWeight: "700", color: colors.text }}>{day === today ? `Today · ${dayLabel(day)}` : dayLabel(day)}</Text>
      </Pressable>
      {btn("chevron-forward", addDays(day, 1), day >= today)}
    </View>
  );
}
