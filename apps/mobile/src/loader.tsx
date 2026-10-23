import { Modal, Text, View } from "react-native";
import { Image } from "expo-image";
import { colors } from "./theme";

const crown = require("../assets/crown-loader.webp");

/** The Monark crown, animated: shown whenever the app is busy loading. */
export function CrownLoader({ size = 120, text }: { size?: number; text?: string }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", gap: 12 }} accessibilityRole="progressbar" accessibilityLabel={text ?? "Loading"}>
      <Image source={crown} style={{ width: size, height: size }} contentFit="contain" autoplay />
      {text ? <Text style={{ color: colors.muted, fontWeight: "600", textAlign: "center" }}>{text}</Text> : null}
    </View>
  );
}

/** Full screen, while the app starts. */
export function LoadingScreen({ text }: { text?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <CrownLoader size={160} text={text} />
    </View>
  );
}

/** Over the current page, while something longer runs (signing in, the first download). */
export function LoadingOverlay({ visible, text }: { visible: boolean; text?: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.scheme === "dark" ? "rgba(5,8,18,0.88)" : "rgba(244,246,251,0.92)" }}>
        <CrownLoader size={150} text={text} />
      </View>
    </Modal>
  );
}
