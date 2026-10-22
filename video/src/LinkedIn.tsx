import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Compare } from "./Compare";
import { INSTALL, REPO } from "./copy";
import { KeyCaps } from "./KeyCaps";
import { Wordmark } from "./Mark";
import { Terminal } from "./Terminal";
import { color, font, spotlight } from "./theme";
import { T } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const rise = (frame: number, start: number, length = 12) => interpolate(frame, [start, start + length], [0, 1], { ...clamp, easing: ease });

export const HOOK_FIRST = "You talk faster than you type.";
export const HOOK_SECOND = "Claude Code reads every um.";

// Scenes: hook → the live demo → before/after → end card. Each overlaps the next by 8 frames.
const DEMO_FROM = 84;
const DEMO_LENGTH = T.toast + 45;
const COMPARE_FROM = DEMO_FROM + DEMO_LENGTH - 8;
const COMPARE_LENGTH = 186;
const END_FROM = COMPARE_FROM + COMPARE_LENGTH - 8;
const END_LENGTH = 200;
export const LINKEDIN_DURATION = END_FROM + END_LENGTH;

const M = 48; // outer margin, shared by captions, panels and the terminal edge

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
};

/** ⌃G set as a key name: JetBrains Mono carries the ⌃ glyph, Instrument Sans does not. */
export const Keys = ({ children }: { children: ReactNode }) => (
  <span style={{ fontFamily: font.mono, fontWeight: 600, letterSpacing: 0, fontSize: "0.9em" }}>{children}</span>
);

/** Soft light that follows the subject of each scene, plus a vignette. No grain:
 * LinkedIn re-encodes uploads, and fine grain comes back as blocks. */
const Light = ({ frame }: { frame: number }) => {
  const at = [0, DEMO_FROM, COMPARE_FROM, END_FROM];
  const x = interpolate(frame, at, [30, 50, 50, 30], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const y = interpolate(frame, at, [44, 52, 50, 46], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: spotlight(`${x}%`, `${y}%`, "80% 60%") }} />
      <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.7) 100%)" }} />
    </AbsoluteFill>
  );
};

const Hook = () => {
  const frame = useCurrentFrame();
  const first = rise(frame, 4, 14);
  const words = HOOK_SECOND.split(" ");
  const exit = interpolate(frame, [68, 82], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${M + 32}px`, opacity: 1 - exit, transform: `translateY(${-exit * 60}px)` }}>
      <div style={{ ...headline, fontSize: 100, lineHeight: 1.04, maxWidth: 920 }}>
        <div style={{ opacity: first, transform: `translateY(${(1 - first) * 24}px)` }}>{HOOK_FIRST}</div>
        <div style={{ marginTop: 40 }}>
          {words.map((word, i) => {
            // The second line lands word by word, in the same rhythm as dictation.
            const p = rise(frame, 34 + i * 5 + (i > 2 ? 4 : 0), 6);
            return (
              <span key={word} style={{ opacity: p, display: "inline-block", transform: `translateY(${(1 - p) * 14}px)` }}>
                {word}
                {i < words.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

type Caption = { from: number; to: number; text: ReactNode };

const Captions = ({ frame, items }: { frame: number; items: Caption[] }) => (
  <div style={{ position: "absolute", left: M, right: M, top: 76, height: 200 }}>
    {items.map(({ from, to, text }, i) => {
      const o = Math.min(rise(frame, from, 8), 1 - rise(frame, to - 6, 6));
      return (
        <div key={i} style={{ ...headline, position: "absolute", bottom: 0, fontSize: 56, lineHeight: 1.1, opacity: o, transform: `translateY(${(1 - o) * 10}px)` }}>
          {text}
        </div>
      );
    })}
  </div>
);

const DemoPart = () => {
  const frame = useCurrentFrame();
  const enter = rise(frame, 0, 16);
  const exit = interpolate(frame, [DEMO_LENGTH - 12, DEMO_LENGTH], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: 1 - exit }}>
      <Captions
        frame={frame}
        items={[
          { from: 6, to: T.keysIn - 4, text: "Dictate the prompt the way it comes out." },
          { from: T.keysIn - 4, to: T.refineStart + 26, text: <>Press <Keys>⌃G</Keys>.</> },
          { from: T.refineStart + 26, to: T.swap + 6, text: "It rewrites the prompt on your own Claude Code plan." },
          { from: T.swap + 6, to: DEMO_LENGTH + 12, text: "Back in about three seconds, in the same box." },
        ]}
      />
      <div style={{ position: "absolute", left: M, top: 306, opacity: enter, transform: `translateY(${(1 - enter) * 90}px) scale(${1 - exit * 0.04})` }}>
        <Terminal frame={frame} width={1080 - 2 * M} height={820} fontSize={26} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1158, display: "flex", justifyContent: "center" }}>
        <KeyCaps frame={frame} size={120} />
      </div>
    </AbsoluteFill>
  );
};

const ComparePart = () => {
  const frame = useCurrentFrame();
  const exit = interpolate(frame, [COMPARE_LENGTH - 12, COMPARE_LENGTH], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: 1 - exit }}>
      <Captions frame={frame} items={[{ from: 4, to: COMPARE_LENGTH + 12, text: "Same meaning. Fillers gone, correction applied, tasks numbered." }]} />
      <div style={{ position: "absolute", left: M, top: 306 }}>
        <Compare frame={frame} width={1080 - 2 * M} fontSize={26} strikeFrom={30} strikeGap={8} />
      </div>
    </AbsoluteFill>
  );
};

export const EndCard = ({ frame }: { frame: number }) => {
  const tile = rise(frame, 0, 14);
  const draw = interpolate(frame, [8, 42], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const word = rise(frame, 30, 12);
  const line = rise(frame, 46);
  const chip = rise(frame, 56);
  const repo = rise(frame, 64);
  const lift = (p: number): CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * 18}px)` });
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${M + 32}px` }}>
      <div style={{ opacity: tile, transform: `scale(${0.92 + 0.08 * tile})`, transformOrigin: "left center" }}>
        <Wordmark height={150} tile={color.paper} stroke={color.canvas} text={color.paper} draw={draw} textOpacity={word} />
      </div>
      <div style={{ ...headline, ...lift(line), fontSize: 50, lineHeight: 1.14, fontWeight: 500, letterSpacing: "-0.015em", marginTop: 72, maxWidth: 920, textWrap: "wrap" }}>
        {/* No-break spaces keep "Claude Code" and "No API key." whole, so the line breaks after "plan." */}
        Free. Runs on your Claude{" "}Code plan. No{" "}API{" "}key.
      </div>
      <div style={{ ...commandChip, ...lift(chip), marginTop: 56, padding: "22px 28px", fontSize: 25 }}>{INSTALL}</div>
      <div style={{ ...lift(repo), marginTop: 30, fontFamily: font.mono, fontSize: 30, color: color.dim }}>{REPO}</div>
    </AbsoluteFill>
  );
};

/** LinkedIn launch, 1080×1350: hook, the live demo, before/after, end card. Reads without sound. */
export const LinkedIn = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: color.canvas }}>
      <Light frame={frame} />
      <Sequence durationInFrames={DEMO_FROM + 12}>
        <Hook />
      </Sequence>
      <Sequence from={DEMO_FROM} durationInFrames={DEMO_LENGTH}>
        <DemoPart />
      </Sequence>
      <Sequence from={COMPARE_FROM} durationInFrames={COMPARE_LENGTH}>
        <ComparePart />
      </Sequence>
      <Sequence from={END_FROM}>
        <EndCard frame={frame - END_FROM} />
      </Sequence>
    </AbsoluteFill>
  );
};
