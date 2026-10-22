import { ROUGH } from "./copy";

export const FPS = 30;

export const WORDS = ROUGH.split(" ");

// Deterministic jitter in [0, 1) so every render types identically.
const jitter = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Dictation lands word by word in bursts: quick inside a phrase, a breath at
// commas, a longer one at full stops, a hitch after fillers.
const pauseAfter = (word: string, i: number) => {
  if (word.endsWith(".")) return 0.42;
  if (word.endsWith(",")) return 0.24;
  if (["um", "uh", "okay", "so", "oh"].includes(word)) return 0.16;
  return 0.045 + jitter(i) * 0.05;
};

const TYPE_START = 15;

/** Frame on which each word of ROUGH appears. */
export const WORD_FRAMES: number[] = (() => {
  let t = TYPE_START / FPS;
  return WORDS.map((word, i) => {
    const at = Math.round(t * FPS);
    t += pauseAfter(word, i);
    return at;
  });
})();

const TYPE_END = WORD_FRAMES[WORD_FRAMES.length - 1];

/** Key moments of the demo, in frames from the demo's own start. */
export const T = {
  typeStart: TYPE_START,
  typeEnd: TYPE_END,
  keysIn: TYPE_END + 12,
  ctrlDown: TYPE_END + 20,
  gDown: TYPE_END + 26,
  keysUp: TYPE_END + 40,
  keysOut: TYPE_END + 58,
  refineStart: TYPE_END + 26,
  swap: TYPE_END + 26 + 75, // ~2.5 s of "refining…"
  toast: TYPE_END + 26 + 75 + 12,
} as const;

/** Words of ROUGH visible at a frame. */
export const wordsAt = (frame: number) =>
  WORD_FRAMES.filter((f) => f <= frame).length;
