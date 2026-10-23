import { useEffect } from "react";
import { Stack, router, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { LoadingScreen } from "../src/loader";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../src/session";
import { PrefsProvider, takeReopen, usePrefs } from "../src/prefs";
import { useReminders } from "../src/reminders";
import { ChangePasswordScreen, SetPinScreen, SignInScreen, UnlockScreen } from "../src/screens/auth";
import { colors } from "../src/theme";

/**
 * Monark Edu teacher app (Phase 6). Until the teacher is signed in and has unlocked the app
 * with their PIN, only the sign-in / PIN screens show; after that, the tabs and their pages.
 */
function Signed() {
  useReminders();
  const nav = useRootNavigationState();
  useEffect(() => {
    if (!nav?.key) return;
    const path = takeReopen();
    if (path) setTimeout(() => router.push(path), 0);
  }, [nav?.key]);
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="register/daily" options={{ title: "Daily register" }} />
      <Stack.Screen name="register/period" options={{ title: "Period register" }} />
      <Stack.Screen name="register/special" options={{ title: "Special class register" }} />
      <Stack.Screen name="marks/[id]" options={{ title: "Enter marks" }} />
      <Stack.Screen name="lesson" options={{ title: "Lesson log" }} />
      <Stack.Screen name="sync" options={{ title: "Sync" }} />
      <Stack.Screen name="classes" options={{ title: "My classes" }} />
      <Stack.Screen name="class/[id]" options={{ title: "Class" }} />
      <Stack.Screen name="special-classes" options={{ title: "Special classes" }} />
      <Stack.Screen name="settings" options={{ title: "Reminders & appearance" }} />
    </Stack>
  );
}

function Gate() {
  const { stage } = useSession();
  const { loaded } = usePrefs();
  if (stage === "loading" || !loaded) return <LoadingScreen />;
  if (stage === "signedOut") return <SignInScreen />;
  if (stage === "changePassword") return <ChangePasswordScreen />;
  if (stage === "setPin") return <SetPinScreen />;
  if (stage === "locked") return <UnlockScreen />;
  return <Signed />;
}

/** Light or dark: everything is re-drawn with the new colours when it changes. */
function Themed() {
  const { scheme } = usePrefs();
  const { stage } = useSession();
  // Dark blue headers once signed in; the sign-in pages follow light / dark.
  const bar = stage === "ready" || scheme === "dark" ? "light" : "dark";
  return (
    <View key={scheme} style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={bar} />
      <Gate />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <SessionProvider>
          <Themed />
        </SessionProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
