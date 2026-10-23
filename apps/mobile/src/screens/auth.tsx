import { useEffect, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../session";
import { loadServerUrl } from "../storage";
import { Banner, Button, Card, Field, Muted, Title } from "../ui";
import { colors } from "../theme";
import { pendingCount } from "../db";
import { LoadingOverlay } from "../loader";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Image source={require("../../assets/monark-devs-mark.png")} style={{ width: 64, height: 64, borderRadius: 32 }} />
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>Monark Edu</Text>
            <Muted>Teacher app</Muted>
          </View>
          {children}
          <Muted style={{ textAlign: "center", marginTop: 12 }}>by Monark Devs</Muted>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Signing out removes everything from the phone: warn about changes not yet sent. */
export function confirmSignOut(signOut: () => Promise<void>) {
  const waiting = pendingCount();
  Alert.alert(
    "Sign out?",
    waiting > 0
      ? `${waiting} change(s) haven't been sent yet and will be lost. Sync first if you can.`
      : "Your registers and marks are all sent. The phone's copy will be removed.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]
  );
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function SignInScreen() {
  const { signIn } = useSession();
  const [server, setServer] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = pendingCount();

  useEffect(() => {
    loadServerUrl().then((u) => u && setServer(u));
  }, []);

  const submit = async () => {
    setError(null);
    if (!server.trim() || !identifier.trim() || !password) return setError("Fill in the server address, your email or mobile number, and your password");
    setBusy(true);
    try {
      await signIn(server, identifier, password);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <Card style={{ gap: 14 }}>
        <Title sub="Sign in once with signal. After that the app works offline, opened with your PIN.">Sign in</Title>
        {waiting > 0 && <Banner text={`${waiting} change(s) on this phone are still waiting to sync. Sign in again as the same teacher to send them.`} />}
        <Field
          label="Server address"
          placeholder="e.g. 192.168.1.20:4000"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={server}
          onChangeText={setServer}
        />
        <Field
          label="Email or mobile number"
          placeholder="you@school.example or 097…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={identifier}
          onChangeText={setIdentifier}
        />
        <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        {error && <Banner tone="red" icon="alert-circle" text={error} />}
        <Button title="Sign in" onPress={submit} busy={busy} />
        <LoadingOverlay visible={busy} text="Signing in and downloading your classes…" />
        <Muted>Forgot your password? Use "Forgot password?" on the website; your head teacher resets it.</Muted>
      </Card>
    </Frame>
  );
}

export function ChangePasswordScreen() {
  const { changePassword, signOut } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (next.length < 8) return setError("The new password must be at least 8 characters");
    if (next !== again) return setError("The two new passwords don't match");
    setBusy(true);
    try {
      await changePassword(current, next);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <Card style={{ gap: 14 }}>
        <Title sub="You signed in with a one-time password. Choose your own before anything else.">Choose your password</Title>
        <Field label="One-time password" secureTextEntry value={current} onChangeText={setCurrent} autoCapitalize="characters" />
        <Field label="New password (at least 8 characters)" secureTextEntry value={next} onChangeText={setNext} />
        <Field label="New password again" secureTextEntry value={again} onChangeText={setAgain} />
        {error && <Banner tone="red" icon="alert-circle" text={error} />}
        <Button title="Save password" onPress={submit} busy={busy} />
        <LoadingOverlay visible={busy} text="Saving your password and downloading your classes…" />
        <Button title="Cancel" kind="outline" onPress={() => confirmSignOut(signOut)} />
      </Card>
    </Frame>
  );
}

/** Four to six digits, typed on a number pad. */
function PinPad({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone?: (v: string) => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return (
    <View style={{ gap: 16, alignItems: "center" }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              borderWidth: 2,
              borderColor: i < 4 || value.length > i ? colors.primary : colors.border,
              backgroundColor: value.length > i ? colors.primary : "transparent",
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", width: 270, gap: 12, justifyContent: "center" }}>
        {keys.map((k, i) => (
          <Pressable
            key={i}
            disabled={!k}
            onPress={() => {
              if (k === "⌫") onChange(value.slice(0, -1));
              else if (value.length < 6) {
                const v = value + k;
                onChange(v);
                if (v.length === 6) onDone?.(v);
              }
            }}
            style={({ pressed }) => ({
              width: 78,
              height: 58,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: k ? (pressed ? colors.primarySoft : colors.card) : "transparent",
              borderWidth: k ? 1 : 0,
              borderColor: colors.border,
            })}
          >
            <Text style={{ fontSize: 22, fontWeight: "600", color: colors.text }}>{k}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function SetPinScreen() {
  const { choosePin, session } = useSession();
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPinValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Takes the PIN as an argument so the 6th digit (which moves on by itself) is never lost.
  const next = async (value: string = pin) => {
    if (busy) return;
    setError(null);
    if (value.length < 4) return setError("Use 4 to 6 digits");
    if (/^(\d)\1+$/.test(value) || "0123456789".includes(value) || "9876543210".includes(value)) {
      setPinValue("");
      return setError("Choose a PIN that isn't easy to guess (not 1111 or 1234).");
    }
    if (!first) {
      setFirst(value);
      setPinValue("");
      return;
    }
    if (value !== first) {
      setFirst(null);
      setPinValue("");
      return setError("The two PINs didn't match. Start again.");
    }
    setBusy(true);
    try {
      await choosePin(value);
    } catch (e) {
      setError(`The PIN couldn't be saved on this phone: ${message(e)}`);
      setFirst(null);
      setPinValue("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <Card style={{ gap: 16, alignItems: "stretch" }}>
        <Title sub={first ? "Step 2 of 2: type the same PIN again to confirm it." : `Step 1 of 2. Hello ${session?.user.name ?? ""}: you'll open the app with this PIN, with or without signal.`}>
          {first ? "Type the PIN again" : "Choose a PIN"}
        </Title>
        <PinPad value={pin} onChange={setPinValue} onDone={(v) => void next(v)} />
        {error && <Banner tone="red" icon="alert-circle" text={error} />}
        <Button title={first ? "Save PIN" : "Next"} onPress={() => void next()} disabled={pin.length < 4} busy={busy} />
        {first && (
          <Button
            title="Start again"
            kind="outline"
            onPress={() => {
              setFirst(null);
              setPinValue("");
              setError(null);
            }}
          />
        )}
      </Card>
    </Frame>
  );
}

export function UnlockScreen() {
  const { unlock, session, signOut } = useSession();
  const [pin, setPinValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tryPin = async (value = pin) => {
    if (value.length < 4) return;
    const r = await unlock(value);
    if (!r.ok) {
      setPinValue("");
      setError(r.attemptsLeft > 0 ? `Wrong PIN. ${r.attemptsLeft} more tries, then you'll need your password.` : null);
    }
  };

  return (
    <Frame>
      <Card style={{ gap: 16 }}>
        <Title sub={session ? `${session.user.name}${session.user.schoolName ? ` · ${session.user.schoolName}` : ""}` : undefined}>Enter your PIN</Title>
        <PinPad value={pin} onChange={setPinValue} onDone={tryPin} />
        {error && <Banner tone="red" icon="alert-circle" text={error} />}
        <Button title="Open" onPress={() => tryPin()} disabled={pin.length < 4} />
        <Button title="Not you? Sign out" kind="outline" onPress={() => confirmSignOut(signOut)} />
      </Card>
    </Frame>
  );
}
