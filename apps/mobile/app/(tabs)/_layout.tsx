import { Tabs } from "expo-router";
import { colors } from "../../src/theme";
import { FloatingTabBar } from "../../src/tab-bar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="timetable" options={{ title: "Timetable" }} />
      <Tabs.Screen name="registers" options={{ title: "Registers" }} />
      <Tabs.Screen name="marks" options={{ title: "Marks" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />
    </Tabs>
  );
}
