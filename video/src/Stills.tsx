import { AbsoluteFill } from "remotion";
import { INSTALL } from "./copy";
import { Wordmark } from "./Mark";
import { headline, Install, Keys } from "./parts";
import { color, spotlight } from "./theme";

/** GitHub social preview, 1280×640. The two install paths sit side by side, short one first. */
export const SocialPreview = () => (
  <AbsoluteFill style={{ background: spotlight("30%", "45%", "70% 90%"), justifyContent: "center", padding: "0 88px" }}>
    <Wordmark height={116} tile={color.paper} stroke={color.canvas} text={color.paper} />
    <div style={{ ...headline, fontSize: 46, lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.015em", marginTop: 40, maxWidth: 980 }}>
      Turns a rambling, dictated prompt into a clean one. Press <Keys>⌃G</Keys> in Claude Code.
    </div>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 32, marginTop: 44 }}>
      <Install path={INSTALL.terminal} primary labelSize={24} fontSize={24} padding="16px 24px" />
      <Install path={INSTALL.claudeCode} labelSize={24} fontSize={24} padding="16px 24px" />
    </div>
  </AbsoluteFill>
);
