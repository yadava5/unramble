import type { CSSProperties, ReactNode } from "react";
import type { InstallPath } from "./copy";
import { color, font } from "./theme";

export const headline: CSSProperties = {
  fontFamily: font.sans,
  fontWeight: 600,
  letterSpacing: "-0.025em",
  color: color.paper,
  textWrap: "balance",
};

/** Commands are copied by hand: `--` must stay two hyphens, so no ligatures. */
export const commandChip: CSSProperties = {
  alignSelf: "flex-start",
  background: color.inkRaised,
  border: `1px solid ${color.hairline}`,
  borderRadius: 14,
  fontFamily: font.mono,
  fontVariantLigatures: "none",
  color: color.fg,
  whiteSpace: "pre",
  lineHeight: 1.5,
};

/** The short path is inverted, like the logo tile, so it is the one the eye takes first. */
export const primaryChip: CSSProperties = {
  ...commandChip,
  background: color.paper,
  border: `1px solid ${color.paper}`,
  color: color.canvas,
  fontWeight: 500,
};

/** Where a command is typed. Prose, so the text face; only the command itself is mono. */
export const where = (fontSize: number): CSSProperties => ({
  fontFamily: font.sans,
  fontWeight: 500,
  fontSize,
  lineHeight: 1.2,
  color: color.dim,
});

type InstallProps = { path: InstallPath; primary?: boolean; labelSize: number; fontSize: number; padding: string; style?: CSSProperties };

/** A label over its command chip; a path with several commands stacks them one per line. */
export const Install = ({ path, primary = false, labelSize, fontSize, padding, style }: InstallProps) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: Math.round(labelSize * 0.5), ...style }}>
    <div style={where(labelSize)}>{path.where}</div>
    <div style={{ ...(primary ? primaryChip : commandChip), fontSize, padding }}>{path.commands.join("\n")}</div>
  </div>
);

/** ⌃G set as a key name: JetBrains Mono carries the ⌃ glyph, Instrument Sans does not. */
export const Keys = ({ children }: { children: ReactNode }) => (
  <span style={{ fontFamily: font.mono, fontWeight: 600, letterSpacing: 0, fontSize: "0.9em" }}>{children}</span>
);
