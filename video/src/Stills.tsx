import { AbsoluteFill } from "remotion";
import { Compare } from "./Compare";
import { INSTALL } from "./copy";
import { commandChip, headline, HOOK_FIRST, HOOK_SECOND, Keys } from "./LinkedIn";
import { Wordmark } from "./Mark";
import { color, spotlight } from "./theme";

const vignette = "radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.7) 100%)";

/** LinkedIn cover, 1080×1350: the hook over the before/after it promises. */
export const LinkedInCover = () => (
  <AbsoluteFill style={{ background: spotlight("50%", "55%", "80% 60%") }}>
    <AbsoluteFill style={{ background: vignette }} />
    <div style={{ ...headline, position: "absolute", left: 80, right: 80, top: 72, fontSize: 70, lineHeight: 1.04 }}>
      <div>{HOOK_FIRST}</div>
      <div style={{ marginTop: 16 }}>{HOOK_SECOND}</div>
    </div>
    <div style={{ position: "absolute", left: 48, top: 400 }}>
      {/* Frame far past the last strike: every dropped phrase is struck. */}
      <Compare frame={1000} width={984} fontSize={23} />
    </div>
    <div style={{ position: "absolute", left: 80, bottom: 48 }}>
      <Wordmark height={56} tile={color.paper} stroke={color.canvas} text={color.paper} />
    </div>
  </AbsoluteFill>
);

/** GitHub social preview, 1280×640. */
export const SocialPreview = () => (
  <AbsoluteFill style={{ background: spotlight("30%", "45%", "70% 90%"), justifyContent: "center", padding: "0 96px" }}>
    <Wordmark height={128} tile={color.paper} stroke={color.canvas} text={color.paper} />
    <div style={{ ...headline, fontSize: 46, lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.015em", marginTop: 44, maxWidth: 980 }}>
      Turns a rambling, dictated prompt into a clean one. Press <Keys>⌃G</Keys> in Claude Code.
    </div>
    <div style={{ ...commandChip, marginTop: 44, padding: "18px 26px", fontSize: 26 }}>{INSTALL}</div>
  </AbsoluteFill>
);
