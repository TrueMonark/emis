/**
 * Colours of the Monark Edu teacher app, light and dark.
 *
 * `colors` is the palette in use. Screens read it while they render; when the teacher switches
 * between light and dark (or the phone does, on "Follow the phone"), `applyPalette` swaps the
 * values and the app re-draws everything (see ThemeProvider in src/prefs.tsx).
 */
const light = {
  scheme: "light" as "light" | "dark",
  bg: "#f4f6fb",
  card: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  input: "#ffffff",
  primary: "#1d4ed8",
  primaryDark: "#1e3a8a",
  primarySoft: "#dbeafe",
  /** Text on a filled primary / green / red / amber background */
  onPrimary: "#ffffff",
  green: "#15803d",
  greenSoft: "#dcfce7",
  red: "#b91c1c",
  redSoft: "#fee2e2",
  amber: "#b45309",
  amberSoft: "#fef3c7",
  grey: "#9ca3af",
  greySoft: "#f3f4f6",
};

const dark: typeof light = {
  scheme: "dark",
  bg: "#0b1020",
  card: "#141a2e",
  text: "#e5e7eb",
  muted: "#9ca3af",
  border: "#263049",
  input: "#0f1527",
  primary: "#60a5fa",
  primaryDark: "#0f172a",
  primarySoft: "#1e3a8a55",
  onPrimary: "#0b1020",
  green: "#4ade80",
  greenSoft: "#14532d66",
  red: "#f87171",
  redSoft: "#7f1d1d66",
  amber: "#fbbf24",
  amberSoft: "#78350f66",
  grey: "#6b7280",
  greySoft: "#1f2937",
};

export const palettes = { light, dark };
export type Palette = typeof light;

export const colors: Palette = { ...light };

export function applyPalette(scheme: "light" | "dark") {
  Object.assign(colors, palettes[scheme]);
}

export const radius = 14;
export const gap = 12;
