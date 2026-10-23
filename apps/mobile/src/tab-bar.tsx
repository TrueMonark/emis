import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, IconName> = {
  index: "home",
  timetable: "calendar",
  registers: "checkbox",
  marks: "school",
  more: "menu",
};

/** Space the floating bar takes at the bottom (pages add it as padding so nothing hides behind it). */
export const TAB_BAR_SPACE = 96;

/**
 * The floating "island" tab bar, like the website on a phone: a dark rounded bar clear of the
 * screen edges, with a blue glow; the open tab gets a blue chip. Same in light and dark.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom: Math.max(insets.bottom, 8) + 8, alignItems: "center" }}>
      <View
        style={{
          flexDirection: "row",
          width: "100%",
          maxWidth: 420,
          height: 64,
          borderRadius: 24,
          backgroundColor: "rgba(10,10,10,0.92)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.1)",
          ...Platform.select({
            ios: { shadowColor: "#3b82f6", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
            default: { elevation: 12 },
          }),
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key].options;
          const label = typeof options.title === "string" ? options.title : route.name;
          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              accessibilityRole="tab"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}
            >
              <View
                style={{
                  width: 40,
                  height: 28,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: focused ? "rgba(59,130,246,0.22)" : "transparent",
                }}
              >
                <Ionicons name={ICONS[route.name] ?? "ellipse"} size={20} color={focused ? "#60a5fa" : "#a3a3a3"} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: "600", color: focused ? "#60a5fa" : "#a3a3a3" }} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
