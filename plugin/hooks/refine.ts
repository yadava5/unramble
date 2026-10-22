// Pure text work around one rewrite: what to skip, what to hide from the model, and what a
// rewrite must still contain before it may replace the draft. No `$`, so every rule here is
// unit-tested directly.

/** The band shows, and Ctrl+G acts, only from this many words. */
export const MIN_WORDS = 3

/** Past this the box holds a paste or a log, not a dictated prompt. */
export const MAX_CHARS = 12_000

export const wordCount = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length

/** Why a draft is left alone, or null when it may be rewritten. */
export function skipReason(text: string): string | null {
  const body = text.trim()
  if (wordCount(body) < MIN_WORDS) return 'too short to rewrite'
  if (body.startsWith('/') || body.startsWith('!')) return 'slash commands and shell escapes stay as typed'
  if (body.length > MAX_CHARS) return 'that is paste-sized, not a dictated prompt'
  return null
}

/**
 * Machine values that must survive verbatim: paths, flags, numbers of two or more digits,
 * URLs, @-references and Claude Code's paste and image placeholders.
 */
export function tokens(text: string): Set<string> {
  const found = [
    ...text.matchAll(/(?:~|\/)[\w.\-/]{3,}/g),
    ...text.matchAll(/(?<!\w)--[a-z][\w-]+/g),
    ...text.matchAll(/https?:\/\/\S+/g),
    ...text.matchAll(/\b\d{2,}(?:[.,]\d+)?\b/g),
    ...text.matchAll(/\[(?:Pasted text|Image) #\d+[^\]]*\]/g),
    ...text.matchAll(/@\S+/g),
  ].map(m => m[0].replace(/[.,)]+$/, ''))
  return new Set(found.filter(Boolean))
}

const CUE = /\b(no|nope|nah|wait|actually|sorry|scratch that|i mean|not that|never ?mind|forget it)\b/i

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A value the speaker corrected right away ("src/utils, no wait, src/lib") may vanish from
 * the rewrite: a correction cue follows some occurrence of it within about ten words.
 */
export function retracted(text: string, token: string): boolean {
  for (const m of text.matchAll(new RegExp(escape(token), 'g'))) {
    const end = (m.index ?? 0) + m[0].length
    if (CUE.test(text.slice(end, end + 70))) return true
  }
  return false
}

/** Values of the draft that the rewrite lost, corrected-away ones excepted. */
export function missingValues(draft: string, rewrite: string): string[] {
  return [...tokens(draft)]
    .filter(t => !rewrite.includes(t) && !retracted(draft, t))
    .sort()
}

// Invisible and direction-changing characters, as code points: bidi controls, zero-width
// characters, word joiners, BOM, and the tag block that can hide text from a reader.
const HIDDEN: readonly (readonly [number, number])[] = [
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x206f],
  [0xfeff, 0xfeff],
  [0xe0000, 0xe007f],
]
const isHidden = (ch: string) => {
  const cp = ch.codePointAt(0) ?? 0
  return HIDDEN.some(([lo, hi]) => cp >= lo && cp <= hi)
}

/** Letters and digits only, with spoken punctuation dropped: "ayush dot dev" vouches for ayush.dev. */
const skeleton = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(?:dot|period|point|slash|backslash|dash|minus|hyphen|colon|tilde|underscore|pipe|at sign)\b/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')

const LINK = /\b(?:https?|ftp|file|data|javascript):\S+|\bwww\.\S+/gi
const COMMAND = /\b(?:curl|wget|sudo|chmod|chown|powershell|iex|invoke-expression|base64|netcat|eval|rm\s+-\w+)\b/gi
const CHAIN = /&&|\|\||\$\(|\|\s*(?:sh|bash|zsh|python3?|node|iex)\b/g

/**
 * What a rewrite brought in that the speaker never said: a link, a download-or-run command,
 * shell chaining, or invisible characters. Text pasted into the draft can carry instructions,
 * and a rewrite that obeyed them would hand an agent with a shell something to run. Spoken
 * forms count as said ("rm dash r f" for `rm -rf`, "h t t p s colon slash slash" for a link).
 */
export function addedValues(draft: string, rewrite: string): string[] {
  const said = skeleton(draft)
  const risky = [...rewrite.matchAll(LINK), ...rewrite.matchAll(COMMAND)]
    .map(m => m[0].replace(/[.,;:)`'"]+$/, ''))
    .filter(v => !said.includes(skeleton(v)))
  const chains = [...rewrite.matchAll(CHAIN)].map(m => m[0]).filter(c => !draft.includes(c))
  const hidden = [...rewrite]
    .filter(c => isHidden(c) && !draft.includes(c))
    .map(c => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase()}`)
  return [...new Set([...risky, ...chains, ...hidden])].sort()
}

/** A line that looks pasted (log, code, config, table) rather than spoken. */
export function isMachine(line: string): boolean {
  // placeholders, URLs and @-references are guarded by tokens(); judge the rest of the line
  const bare = line
    .trim()
    .replace(/\[(?:Pasted text|Image) #\d+[^\]]*\]|https?:\/\/\S+|@\S+/g, '')
    .trim()
  if (bare.length < 20) return false
  const prose = [...bare].filter(c => /\p{L}/u.test(c) || c === ' ').length / bare.length
  return prose < 0.8 || /^(?:[{(<#$>|`]|\w+\(|\d{4}-\d\d-\d\d)/.test(bare)
}

/**
 * Swaps each run of pasted lines for a `[[paste N]]` marker, so the model never sees, slows on
 * or alters them; unmask() puts them back byte for byte. Claude Code hands pastes over
 * expanded, so a 30-line log would otherwise be rewritten too.
 */
export function mask(text: string): { masked: string; blocks: string[] } {
  const lines = text.split('\n')
  const line = (k: number) => lines[k] ?? ''
  const out: string[] = []
  const blocks: string[] = []
  let i = 0
  while (i < lines.length) {
    if (!isMachine(line(i))) {
      out.push(line(i))
      i += 1
      continue
    }
    let j = i
    while (
      j < lines.length &&
      (isMachine(line(j)) || (!line(j).trim() && j + 1 < lines.length && isMachine(line(j + 1))))
    ) {
      j += 1
    }
    blocks.push(lines.slice(i, j).join('\n'))
    out.push(`[[paste ${blocks.length}]]`)
    i = j
  }
  return { masked: out.join('\n'), blocks }
}

/** Puts the pasted blocks back; null when a marker was lost or duplicated. */
export function unmask(text: string, blocks: readonly string[]): string | null {
  let out = text
  for (const [n, block] of blocks.entries()) {
    const marker = `[[paste ${n + 1}]]`
    if (out.split(marker).length !== 2) return null
    out = out.replace(marker, () => block)
  }
  return out
}

/**
 * The rules' examples use <rewrite> tags, and now and then a model copies them with a note in
 * front. Keep only what is inside the tags.
 */
export function unwrap(text: string): string {
  const m = /<rewrite>\s*([\s\S]*?)\s*<\/rewrite>/.exec(text)
  return (m ? (m[1] ?? '') : text).trim()
}

/** The rules, plus the names this user often says when they listed some. */
export function systemPrompt(rules: string, vocabulary: string): string {
  const names = vocabulary
    .split(/[,\n]/)
    .map(n => n.trim())
    .filter(Boolean)
  return names.length
    ? `${rules.trimEnd()}\n\nNames this user often says: ${names.join(', ')}.`
    : rules.trimEnd()
}

/** The draft as the model sees it; a closing tag inside the draft cannot end the transcript early. */
export const transcript = (masked: string) =>
  `<transcript>\n${masked.replace(/<\/?transcript>/gi, t => t.replace('<', '‹'))}\n</transcript>`

/** Claude Code's chip for a multi-line paste, as the box holds it: `[Pasted text #2 +4 lines]`. */
export const PASTE_CHIP = /\[Pasted text #\d+[^\]]*\]/g

/** The chip a paste added to the box, when exactly one appeared. */
export function newChip(before: string, after: string): string | null {
  const had = new Set(before.match(PASTE_CHIP) ?? [])
  const added = (after.match(PASTE_CHIP) ?? []).filter(c => !had.has(c))
  return added.length === 1 ? (added[0] ?? null) : null
}

/**
 * Dictation apps paste what they heard, so the box holds a chip where the words are. A chip
 * whose content reads as speech is opened up for the rewrite; one holding a log, code or
 * anything machine-like stays a chip, and the rewrite must keep it as it is.
 */
export function expandSpoken(draft: string, pastes: Readonly<Record<string, string>>): string {
  return draft.replace(PASTE_CHIP, chip => {
    const content = pastes[chip]
    return content !== undefined && mask(content).blocks.length === 0 ? content : chip
  })
}

export type Checked = { ok: true; text: string } | { ok: false; why: string }

/** Everything a model's reply must pass before it replaces the draft. */
export function check(draft: string, reply: string, blocks: readonly string[]): Checked {
  const unwrapped = unwrap(reply)
  if (!unwrapped) return { ok: false, why: 'no rewrite came back' }
  const text = unmask(unwrapped, blocks)
  if (text === null) return { ok: false, why: 'the rewrite lost or duplicated a pasted block' }
  const missing = missingValues(draft.trim(), text)
  if (missing.length) return { ok: false, why: `the rewrite dropped ${missing.slice(0, 4).join(', ')}` }
  const added = addedValues(draft.trim(), text)
  if (added.length) return { ok: false, why: `the rewrite added ${added.slice(0, 3).join(', ')}, which you never said` }
  return { ok: true, text }
}
