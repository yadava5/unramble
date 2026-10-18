import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

// Ctrl+G rewrites the prompt box in place with ~/.local/bin/claude-refine --filter (Sonnet on
// the API credit, or the plan with a warning), never leaving Claude Code's screen.
//
// A key reaches a mod only as a band Button naming an engine action that no engine handler
// holds while the prompt is focused: keybindings.json binds ctrl+g in Chat to
// app:cycleDiffBase (handled only by the diff panel), and this Button takes it from there.
// The Button is drawn only while the box holds a few words, so the band is empty otherwise.

const hasDraft = atom({ plugin: 'prompt-refine', key: 'hasDraft' } as const, false)
const isBusy = atom({ plugin: 'prompt-refine', key: 'isBusy' } as const, false)
// The last rewrite and what it replaced: ⌃G on an untouched rewrite swaps the original back
// (ctrl+_ does not: after a plugin's fill it empties the box, seen 10-17).
const isRefined = atom({ plugin: 'prompt-refine', key: 'isRefined' } as const, false)
const original = atom({ plugin: 'prompt-refine', key: 'original' } as const, '')
const rewrite = atom({ plugin: 'prompt-refine', key: 'rewrite' } as const, '')

const ACTION = 'app:cycleDiffBase'
const MIN_WORDS = 3

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

// The script's last stderr line says what happened ("done … via API credit", "⚠ used YOUR
// PLAN", "kept your text — …"); it is the toast.
export const lastLine = (text: string) =>
  text.trim().split('\n').filter(Boolean).pop()?.replace(/^refine: /, '') ?? ''

async function track($: EngineInterface, text: string) {
  await update($, hasDraft, () => wordCount(text) >= MIN_WORDS)
  const last = await read($, rewrite)
  await update($, isRefined, () => last !== '' && text.trim() === last.trim())
}

async function refine($: EngineInterface) {
  if (await read($, isBusy)) return
  const before = await $.prompt.read()
  if (await read($, isRefined)) {
    await $.prompt.fill({ text: await read($, original), mode: 'replace' })
    await update($, rewrite, () => '')
    await update($, isRefined, () => false)
    $.ui.toast('refine: your original is back')
    return
  }
  if (wordCount(before.text) < MIN_WORDS) return
  await update($, isBusy, () => true) // the band reads "refining…" meanwhile
  try {
    const out = await $.process.run(
      ['/bin/sh', '-c', 'exec "$HOME/.local/bin/claude-refine" --filter'],
      { stdin: before.text, timeoutMs: 50_000 },
    )
    const note = lastLine(out.stderr)
    if (out.exitCode !== 0 || !out.stdout.trim()) {
      $.ui.toast(`refine: ${note || 'no rewrite'} — your text is unchanged`)
      return
    }
    // Typed or spoke more while the rewrite ran: the person's text wins.
    if ((await $.prompt.read()).text !== before.text) {
      $.ui.toast('refine: you edited while it ran — kept your text')
      return
    }
    await update($, original, () => before.text)
    await update($, rewrite, () => out.stdout)
    await $.prompt.fill({ text: out.stdout, mode: 'replace' })
    await update($, isRefined, () => true)
    $.ui.toast(`refine: ${note} · ⌃G again restores your original`)
  } catch (err) {
    $.ui.toast(`refine: failed (${String(err).slice(0, 60)}) — your text is unchanged`)
  } finally {
    await update($, isBusy, () => false)
  }
}

export const register: Register = on => {
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    await track($, box.text)
    return box
  })

  on('prompt.change', async ($, e, next) => {
    await track($, e.text)
    return next(e)
  })

  // Only clears the band; if this ever throws, the prompt still goes through.
  on('prompt.submit', async ($, e, next) => {
    await update($, hasDraft, () => false)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const busy = await read($, isBusy)
    const refined = await read($, isRefined)
    if (e.props.hasSurvey || !(busy || refined || (await read($, hasDraft)))) {
      return next(e)
    }
    const { Box, Button, Text } = $.ui.resolve(e)
    const label = busy ? 'refining…' : refined ? '⌃G original' : '⌃G refine'
    return (
      <Box>
        <Button key="refine" plain action={ACTION} label="refine" onPress={() => refine($)}>
          <Text dimColor>{label}</Text>
        </Button>
      </Box>
    )
  })
}
