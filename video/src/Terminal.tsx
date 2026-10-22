import type { CSSProperties } from "react";
import { Easing, interpolate, interpolateColors } from "remotion";
import { BAND, REFINED, TOAST } from "./copy";
import { color, font, MONO_ADVANCE } from "./theme";
import { T, WORD_FRAMES, WORDS, wordsAt } from "./timeline";

type Props = {
  /** Frame relative to the demo's start. */
  frame: number;
  width: number;
  height: number;
  fontSize: number;
  /** If set, everything fades back to the empty box from this frame (for loops). */
  outStart?: number;
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.22, 1, 0.36, 1);

/** Greedy word wrap; returns word indexes per line so each word can animate. */
const wrapWords = (words: string[], cols: number): number[][] => {
  const lines: number[][] = [[]];
  let used = 0;
  words.forEach((word, i) => {
    const need = used === 0 ? word.length : used + 1 + word.length;
    if (need > cols && used > 0) {
      lines.push([i]);
      used = word.length;
    } else {
      lines[lines.length - 1].push(i);
      used = need;
    }
  });
  return lines;
};

/** Wrap REFINED paragraph by paragraph; blank lines stay blank. */
const wrapRefined = (cols: number): string[] =>
  REFINED.split("\n").flatMap((para) => {
    if (para === "") return [""];
    const words = para.split(" ");
    return wrapWords(words, cols).map((line) => line.map((i) => words[i]).join(" "));
  });

export const Terminal = ({ frame, width, height, fontSize, outStart }: Props) => {
  const charW = fontSize * MONO_ADVANCE;
  const lineH = Math.round(fontSize * 1.5);
  const padX = Math.round(fontSize * 1.25);
  const titleH = Math.round(fontSize * 1.75);
  const boxPadY = Math.round(lineH * 0.4);
  const border = 2;
  const boxInner = width - 2 * padX - 2 * border - 2 * charW;
  const textCols = Math.floor(boxInner / charW) - 2; // "> " prefix

  const shown = wordsAt(frame);
  const roughLines = wrapWords(WORDS.slice(0, Math.max(shown, 0)), textCols);
  const refinedLines = wrapRefined(textCols);
  const allRoughLines = wrapWords(WORDS, textCols).length;

  // Phase progress
  const refining = interpolate(frame, [T.refineStart, T.refineStart + 8], [0, 1], clamp);
  const swapOut = interpolate(frame, [T.swap, T.swap + 8], [0, 1], clamp);
  const swapGrow = interpolate(frame, [T.swap, T.swap + 16], [0, 1], { ...clamp, easing: ease });
  const out = outStart === undefined ? 0 : interpolate(frame, [outStart, outStart + 14], [0, 1], { ...clamp, easing: ease });
  const isRefined = frame >= T.swap;

  // Box height: grows line by line while typing, eases to the refined height on swap,
  // eases back to one empty line on loop-out.
  const roughCount = isRefined ? allRoughLines : Math.max(1, roughLines.length);
  let lines = roughCount + (refinedLines.length - roughCount) * swapGrow;
  lines = lines + (1 - lines) * out;
  const boxH = lines * lineH + 2 * boxPadY + 2 * border;

  // Band above the box
  const bandIn = interpolate(frame, [WORD_FRAMES[2], WORD_FRAMES[2] + 6], [0, 1], clamp) * (1 - out);
  const bandText = isRefined ? BAND.refined : frame >= T.refineStart ? BAND.refining : BAND.ready;
  const live = frame >= T.refineStart && !isRefined;

  // Caret: solid while words land, blinking at rest, hidden while refining.
  const lastWordFrame = WORD_FRAMES[Math.max(shown - 1, 0)];
  const resting = isRefined ? frame - (T.swap + 20) : frame - lastWordFrame;
  const caretOn = (resting < 8 || Math.floor(resting / 16) % 2 === 0) && !live && (!isRefined || frame >= T.swap + 20) && out < 0.5;

  // One line if it fits the window, else break after the "·" (words unchanged).
  const toastCols = Math.floor((width - 2 * padX - 2.4 * charW - 2) / (charW * 0.86)) - 2;
  const dot = TOAST.indexOf(" · ");
  const toastLines = TOAST.length <= toastCols ? [TOAST] : [TOAST.slice(0, dot + 2), TOAST.slice(dot + 3)];

  const toastIn = interpolate(frame, [T.toast, T.toast + 12], [0, 1], { ...clamp, easing: ease }) * (1 - out);

  const mono: CSSProperties = {
    fontFamily: font.mono,
    fontSize,
    lineHeight: `${lineH}px`,
    whiteSpace: "pre",
    fontVariantLigatures: "none",
  };

  const caret = (
    <span
      style={{
        display: "inline-block",
        width: charW,
        height: lineH * 0.78,
        verticalAlign: "middle",
        marginTop: -lineH * 0.08,
        background: color.fg,
        opacity: caretOn ? 1 : 0,
      }}
    />
  );

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 16,
        background: color.ink,
        boxShadow: `0 0 0 1px ${color.hairline}, 0 40px 120px rgba(0, 0, 0, 0.9)`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: titleH,
          background: color.inkRaised,
          borderBottom: `1px solid ${color.hairline}`,
          display: "flex",
          alignItems: "center",
          padding: `0 ${padX * 0.75}px`,
          position: "relative",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{ width: fontSize * 0.46, height: fontSize * 0.46, borderRadius: "50%", background: "#333333", marginRight: fontSize * 0.32 }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font.sans,
            fontWeight: 500,
            fontSize: fontSize * 0.62,
            color: color.dim,
          }}
        >
          shop-app — claude
        </div>
      </div>

      <div style={{ padding: `${lineH * 0.6}px ${padX}px`, ...mono, color: color.fg }}>
        <div>
          <span style={{ color: color.dim }}>~/code/shop-app $ </span>claude
        </div>
        <div>{" "}</div>

        {/* Band */}
        <div style={{ paddingLeft: charW, height: lineH, opacity: bandIn, color: color.dim }}>
          {live ? (
            <>
              {[...bandText].map((ch, i) => {
                // A white highlight sweeping left to right, once every ~0.9 s. It only
                // ever brightens the dim grey, so the text never drops below Lc 60.
                const phase = ((frame - T.refineStart) / 27 - i / bandText.length) % 1;
                const glow = Math.max(0, 1 - Math.abs(phase - 0.5) * 4);
                return (
                  <span key={i} style={{ color: interpolateColors(glow, [0, 1], [color.dim, color.paper]) }}>
                    {ch}
                  </span>
                );
              })}
              {` ${BAND.cancel}`}
            </>
          ) : (
            bandText
          )}
        </div>

        {/* Prompt box */}
        <div
          style={{
            height: boxH,
            border: `${border}px solid ${color.border}`,
            borderRadius: 10,
            padding: `${boxPadY}px ${charW}px`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <span style={{ position: "absolute", left: charW, top: boxPadY, color: color.dim }}>{">"}</span>

          {!isRefined || swapOut < 1 ? (
            <div
              style={{
                position: "absolute",
                left: charW * 3,
                top: boxPadY,
                opacity: (1 - 0.5 * refining) * (1 - swapOut),
                filter: swapOut > 0 ? `blur(${swapOut * 3}px)` : undefined,
              }}
            >
              {roughLines.map((line, li) => (
                <div key={li}>
                  {line.map((wi, k) => {
                    const age = frame - WORD_FRAMES[wi];
                    const landed = interpolate(age, [0, 5], [0.35, 1], clamp);
                    return (
                      <span key={wi} style={{ opacity: landed }}>
                        {k > 0 ? " " : ""}
                        {WORDS[wi]}
                      </span>
                    );
                  })}
                  {li === roughLines.length - 1 && !isRefined ? caret : null}
                </div>
              ))}
            </div>
          ) : null}

          {isRefined ? (
            <div style={{ position: "absolute", left: charW * 3, top: boxPadY, opacity: 1 - out }}>
              {refinedLines.map((text, li) => {
                const start = T.swap + 6 + li * 2;
                const p = interpolate(frame, [start, start + 9], [0, 1], { ...clamp, easing: ease });
                return (
                  <div key={li} style={{ opacity: p, transform: `translateY(${(1 - p) * lineH * 0.25}px)` }}>
                    {text === "" ? " " : text}
                    {li === refinedLines.length - 1 ? caret : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div style={{ paddingLeft: charW, color: color.dim }}>? for shortcuts</div>
      </div>

      {/* Toast */}
      <div
        style={{
          position: "absolute",
          left: padX,
          bottom: padX * 0.8,
          ...mono,
          fontSize: fontSize * 0.86,
          lineHeight: `${lineH * 0.86}px`,
          color: color.fg,
          background: color.inkRaised,
          border: `1px solid ${color.border}`,
          borderRadius: 10,
          padding: `${lineH * 0.3}px ${charW * 1.2}px`,
          opacity: toastIn,
          transform: `translateY(${(1 - toastIn) * 14}px)`,
        }}
      >
        {toastLines.map((line, i) => (
          <div key={i}>
            <span style={{ color: color.paper }}>{i === 0 ? "● " : "  "}</span>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};
