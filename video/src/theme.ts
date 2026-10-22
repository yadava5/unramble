import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Monochrome. Contrast measured (WCAG 2 / APCA Lc), not estimated:
//   paper on canvas 21.0 / -107.9 · fg on ink 16.91 / -96.0
//   dim on ink 9.44 / -61.1 · dim on inkRaised 8.79 / -60.5 · dim on canvas 10.02 / -61.2
//   border on ink 3.45 (non-text). hairline is decorative only (1.46).
export const color = {
  canvas: "#000000",
  spot: "#171717", // centre of the soft light behind the terminal
  paper: "#FFFFFF",
  ink: "#0A0A0A", // terminal ground
  inkRaised: "#141414", // title bar, toast, command chip
  fg: "#EDEDED",
  dim: "#B3B3B3", // secondary text; the Lc 60 floor
  border: "#666666", // the prompt box outline
  hairline: "#2A2A2A",
} as const;

export const font = {
  // Instrument Sans (OFL): every caption, headline and label.
  sans: "Instrument Sans",
  // JetBrains Mono (OFL): terminal content, commands, URLs. Machine values only.
  mono: "JetBrains Mono",
} as const;

// JetBrains Mono advance width is 600/1000 em, so terminal layout is exact.
export const MONO_ADVANCE = 0.6;

/** A soft light from above the subject; the only "lighting" in the system. */
export const spotlight = (x = "50%", y = "42%", size = "70% 60%") =>
  `radial-gradient(${size} at ${x} ${y}, ${color.spot} 0%, ${color.canvas} 100%)`;

// loadFont holds the render (delayRender) until each face is ready.
loadFont({
  family: font.sans,
  url: staticFile("fonts/InstrumentSans-Variable.ttf"),
  weight: "400 700",
  stretch: "75% 100%",
});
loadFont({
  family: font.mono,
  url: staticFile("fonts/JetBrainsMono-Variable.ttf"),
  weight: "100 800",
});
