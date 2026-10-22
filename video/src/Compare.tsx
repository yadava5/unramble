import type { CSSProperties } from "react";
import { Easing, interpolate } from "remotion";
import { DROPPED, REFINED } from "./copy";
import { color, font, MONO_ADVANCE } from "./theme";
import { WORDS } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.22, 1, 0.36, 1);

/** Word index → which DROPPED phrase it belongs to (or -1 if it was kept). */
const DROP_GROUP: number[] = (() => {
  const group = WORDS.map(() => -1);
  let cursor = 0;
  DROPPED.forEach((phrase, g) => {
    const parts = phrase.split(" ");
    for (let i = cursor; i <= WORDS.length - parts.length; i++) {
      if (parts.every((p, k) => WORDS[i + k] === p)) {
        parts.forEach((_, k) => (group[i + k] = g));
        cursor = i + parts.length;
        return;
      }
    }
    throw new Error(`DROPPED phrase not found in ROUGH: ${phrase}`);
  });
  return group;
})();

const wrap = (words: string[], cols: number) => {
  const lines: number[][] = [[]];
  let used = 0;
  words.forEach((w, i) => {
    const need = used === 0 ? w.length : used + 1 + w.length;
    if (need > cols && used > 0) {
      lines.push([i]);
      used = w.length;
    } else {
      lines[lines.length - 1].push(i);
      used = need;
    }
  });
  return lines;
};

type Props = {
  /** Frame relative to the beat's start. */
  frame: number;
  width: number;
  fontSize: number;
  /** First strike starts here; each later phrase follows `strikeGap` frames after. */
  strikeFrom?: number;
  strikeGap?: number;
};

/** Before and after, stacked: what was said with the dropped phrases struck, then the rewrite. */
export const Compare = ({ frame, width, fontSize, strikeFrom = 22, strikeGap = 7 }: Props) => {
  const charW = fontSize * MONO_ADVANCE;
  const lineH = Math.round(fontSize * 1.5);
  const pad = Math.round(fontSize * 1.2);
  const cols = Math.floor((width - 2 * pad - 2) / charW);

  const panel = (p: number): CSSProperties => ({
    background: color.ink,
    border: `1px solid ${color.hairline}`,
    borderRadius: 14,
    padding: `${pad * 0.8}px ${pad}px ${pad}px`,
    opacity: p,
    transform: `translateY(${(1 - p) * 24}px)`,
  });
  const label: CSSProperties = {
    fontFamily: font.sans,
    fontWeight: 500,
    fontSize: fontSize * 0.95,
    color: color.dim,
    marginBottom: lineH * 0.35,
  };
  const mono: CSSProperties = { fontFamily: font.mono, fontSize, lineHeight: `${lineH}px`, whiteSpace: "pre", fontVariantLigatures: "none" };

  const before = interpolate(frame, [0, 14], [0, 1], { ...clamp, easing: ease });
  const after = interpolate(frame, [10, 24], [0, 1], { ...clamp, easing: ease });

  const refinedLines = REFINED.split("\n").flatMap((para) => {
    if (para === "") return [""];
    const words = para.split(" ");
    return wrap(words, cols).map((l) => l.map((i) => words[i]).join(" "));
  });

  return (
    <div style={{ width, display: "flex", flexDirection: "column", gap: fontSize }}>
      <div style={panel(before)}>
        <div style={label}>What you said</div>
        <div style={mono}>
          {wrap(WORDS, cols).map((line, li) => (
            <div key={li}>
              {line.map((wi, k) => {
                const g = DROP_GROUP[wi];
                const s = g < 0 ? 0 : interpolate(frame, [strikeFrom + g * strikeGap, strikeFrom + g * strikeGap + 8], [0, 1], { ...clamp, easing: ease });
                // Spaces between two struck words are struck too, so a phrase reads as one cut.
                const joinStruck = k > 0 && g >= 0 && DROP_GROUP[line[k - 1]] === g;
                return (
                  <span key={wi}>
                    {k > 0 ? (
                      <span style={{ position: "relative", color: color.fg }}>
                        {" "}
                        {joinStruck ? <Strike p={s} /> : null}
                      </span>
                    ) : null}
                    <span style={{ position: "relative", color: s > 0.5 ? color.dim : color.fg }}>
                      {WORDS[wi]}
                      {g >= 0 ? <Strike p={s} /> : null}
                    </span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={panel(after)}>
        <div style={label}>What Claude Code gets</div>
        <div style={{ ...mono, color: color.paper }}>
          {refinedLines.map((text, i) => (
            <div key={i}>{text === "" ? " " : text}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Strike = ({ p }: { p: number }) => (
  <span
    style={{
      position: "absolute",
      left: 0,
      top: "52%",
      height: 2,
      width: `${p * 100}%`,
      background: color.dim,
    }}
  />
);
