import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { KeyCaps } from "./KeyCaps";
import { Terminal } from "./Terminal";
import { spotlight } from "./theme";
import { T } from "./timeline";

export const DEMO_HOLD = 120; // refined state on screen after the toast lands
export const DEMO_OUT = 16; // fade back to the empty box so the GIF loops without a jump
export const DEMO_DURATION = T.toast + DEMO_HOLD + DEMO_OUT;

/** README demo, 1600×900. Loops: the last frame matches the first. */
export const Demo = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const margin = 56;
  return (
    <AbsoluteFill style={{ background: spotlight("50%", "45%", "75% 80%") }}>
      <div style={{ position: "absolute", left: margin, top: margin }}>
        <Terminal
          // Once the fade-out completes, show frame 0 exactly so the loop seam is invisible.
          frame={frame >= durationInFrames - 2 ? 0 : frame}
          width={width - 2 * margin}
          height={height - 2 * margin}
          fontSize={28}
          outStart={durationInFrames - DEMO_OUT}
        />
      </div>
      <div style={{ position: "absolute", right: margin + 64, bottom: margin + 56 }}>
        <KeyCaps frame={frame} size={112} />
      </div>
    </AbsoluteFill>
  );
};
