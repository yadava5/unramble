import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelCompleteResult, Register } from 'claude-code'

import { ACTION, isBound, parse, plan, serialize } from './keybindings.js'
import {
  check,
  expandSpoken,
  mask,
  MIN_WORDS,
  newChip,
  skipReason,
  systemPrompt,
  transcript,
  wordCount,
} from './refine.ts'

// Ctrl+G rewrites the prompt box in place: the draft goes to a model with the rules in
// prompt/system.md and comes back organised, with the same meaning. Ctrl+G on an untouched
// rewrite puts the original back; Ctrl+G while one runs cancels it. Nothing leaves the prompt
// box unless the person presses the key, and nothing replaces the draft unless it passes the
// checks in refine.ts.

const NAME = 'unramble'
const hasDraft = atom({ plugin: 'unramble', key: 'hasDraft' } as const, false)
const isBusy = atom({ plugin: 'unramble', key: 'isBusy' } as const, false)
const isRefined = atom({ plugin: 'unramble', key: 'isRefined' } as const, false)
const isKeyBound = atom({ plugin: 'unramble', key: 'isKeyBound' } as const, true)
const original = atom({ plugin: 'unramble', key: 'original' } as const, '')
const rewrite = atom({ plugin: 'unramble', key: 'rewrite' } as const, '')
// What each paste chip in the box stands for: the box holds only the chip, the edit carried the text.
const pastes = atom({ plugin: 'unramble', key: 'pastes' } as const, {} as Record<string, string>)

type Settings = { engine: string; model: string; vocabulary: string; apiKey: string }

const settingsOf = (options: Readonly<Record<string, unknown>>): Settings => ({
  engine: options.engine === 'api' ? 'api' : 'plan',
  model: options.model === 'opus' ? 'opus' : 'sonnet',
  vocabulary: typeof options.vocabulary === 'string' ? options.vocabulary : '',
  apiKey: typeof options.apiKey === 'string' ? options.apiKey : '',
})

const isAbsolute = (p: string) => p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('\\\\')

/** keybindings.json beside Claude Code's config; null unless that folder is an absolute path. */
async function keybindingsPath($: EngineInterface): Promise<string | null> {
  const dir = await $.env.get('CLAUDE_CONFIG_DIR')
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  const config = dir ? dir.replace(/[\\/]+$/, '') : home ? `${home}/.claude` : null
  return config && isAbsolute(config) ? `${config}/keybindings.json` : null
}

const NO_CONFIG = 'Could not find Claude Code’s config folder (no absolute CLAUDE_CONFIG_DIR or home folder), so nothing was changed.'

async function readKeybindings($: EngineInterface): Promise<{ path: string; text: string | null } | null> {
  const path = await keybindingsPath($)
  if (!path) return null
  return { path, text: (await $.fs.exists(path)) ? await $.fs.read(path) : null }
}

async function setup($: EngineInterface): Promise<string> {
  const found = await readKeybindings($)
  if (!found) return NO_CONFIG
  const { path, text } = found
  let current
  try {
    current = parse(text)
  } catch (err) {
    return `Left ${path} alone: it could not be read as JSON (${String(err).slice(0, 80)}).\nAdd this to it by hand: Global "ctrl+g": "${ACTION}", Chat "ctrl+g": null.`
  }
  const next = plan(current)
  if (next.kind === 'ready') {
    await update($, isKeyBound, () => true)
    return 'Ctrl+G is already bound to unramble. Nothing changed.'
  }
  if (next.kind === 'conflict') {
    return `Changed nothing: ${next.why}.\nTo use Ctrl+G for unramble, remove that binding from ${path} and run /unramble setup again.`
  }
  // the first backup is the person's own file; running setup again never replaces it
  const backup = `${path}.unramble-backup`
  if (text !== null && !(await $.fs.exists(backup))) await $.fs.write(backup, text)
  await $.fs.write(path, serialize(next.file))
  await update($, isKeyBound, () => true)
  return [
    `Updated ${path}${text !== null ? ` (backup: ${backup})` : ''}:`,
    ...next.changes.map(c => `  - ${c}`),
    'Start a new Claude Code session for Ctrl+G to take effect.',
  ].join('\n')
}

async function status($: EngineInterface, s: Settings): Promise<string> {
  const found = await readKeybindings($)
  const path = found?.path ?? 'keybindings.json'
  let bound = false
  try {
    bound = found ? isBound(parse(found.text)) : false
  } catch {}
  const names = s.vocabulary.split(/[,\n]/).filter(n => n.trim()).length
  return [
    `Engine: ${s.engine === 'api' ? `your Anthropic API key (${s.apiKey ? 'saved' : 'NOT saved'})` : "your Claude Code plan (the session's own login)"}`,
    `Model: ${s.model}`,
    `Vocabulary: ${names ? `${names} name${names === 1 ? '' : 's'}` : 'none'}`,
    `Ctrl+G: ${bound ? 'bound' : `not bound in ${path}; run /unramble setup`}`,
    'Change engine, model or vocabulary in /config (unramble rows), or with: claude plugin configure unramble',
  ].join('\n')
}

let inFlight: AbortController | null = null

let rulesText = ''

/** The rewrite rules, read once from the plugin's own prompt/system.md. */
async function rules($: EngineInterface): Promise<string> {
  rulesText ||= await $.fs.read(`${$.plugin.root}/prompt/system.md`)
  return rulesText
}

// Two ways to reach a model. `plan` (the default) is Claude Code's own client: the session's
// login, billed to the person's plan exactly like their prompts, with no key anywhere. `api` is
// opt-in: a key the person saved in the plugin's settings, which Claude Code keeps in its
// secure storage, sent only to api.anthropic.com and only while `engine` says `api`. A failed
// API call never slides onto the plan; the draft is kept and the toast says why. Models are
// asked for by family (`sonnet`, `opus`), so the newest of each is used without an update.

const TIMEOUT_MS = 45_000
const MAX_TOKENS = 8_000
const DAY_MS = 86_400_000

type Outcome = { ok: true; text: string; via: string } | { ok: false; why: string }
type Fetched = { status: number; ok: boolean; text: string }

function explain(r: Exclude<ModelCompleteResult, { isAnswered: true }>): string {
  if (r.reason === 'aborted') return 'cancelled or timed out'
  if (r.reason === 'empty-reply') return 'the model sent back nothing'
  if (r.error === 'billing_error') return 'the account has no credit left for this call'
  if (r.error === 'authentication_failed') return 'Claude Code is not signed in'
  if (r.status === 429) return 'usage limit reached (429)'
  if (r.status === null) return 'no connection to the model'
  return `the model call failed (${r.status})`
}

async function viaPlan($: EngineInterface, system: string, prompt: string, model: string, signal: AbortSignal): Promise<Outcome> {
  // The rules are the same on every call, so they are cached: a second rewrite within the
  // cache window reads them instead of paying for them again.
  const r = await $.model.complete(
    { model, system: [{ text: system, cache: true }], prompt, maxTokens: MAX_TOKENS, timeoutMs: TIMEOUT_MS },
    { signal },
  )
  return r.isAnswered ? { ok: true, text: r.text, via: `${model} on your plan` } : { ok: false, why: explain(r) }
}

function withTimeout($: EngineInterface, call: Promise<Fetched>): Promise<Fetched | null> {
  return new Promise(resolve => {
    const timer = $.clock.after(TIMEOUT_MS, () => resolve(null))
    call.then(
      r => {
        timer.cancel()
        resolve(r)
      },
      () => {
        timer.cancel()
        resolve({ status: 0, ok: false, text: '' })
      },
    )
  })
}

/** The newest model id of a family (`sonnet`, `opus`), re-checked daily, so a release needs no update. */
async function apiModel($: EngineInterface, key: string, family: string): Promise<string | null> {
  const cached = (await $.store.get(`apiModel.${family}`)) as { id: string; at: number } | undefined
  const now = await $.clock.now()
  if (cached && now - cached.at < DAY_MS) return cached.id
  const r = await withTimeout(
    $,
    $.http.fetch('https://api.anthropic.com/v1/models?limit=100', {
      method: 'GET',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    }),
  )
  if (!r?.ok) return null
  const models = (JSON.parse(r.text).data ?? []) as { id: string; created_at: string }[]
  const best = models
    .filter(m => m.id.includes(family))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .pop()
  if (!best) return null
  await $.store.set(`apiModel.${family}`, { id: best.id, at: now })
  return best.id
}

async function viaApi($: EngineInterface, apiKey: string, system: string, prompt: string, family: string): Promise<Outcome> {
  const key = apiKey.trim()
  if (!key) return { ok: false, why: 'engine is "api" but no API key is saved (see /unramble status)' }
  const model = await apiModel($, key, family)
  if (!model) return { ok: false, why: 'the API key was refused or the model list is unreachable' }
  const r = await withTimeout(
    $,
    $.http.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: prompt }],
      }),
    }),
  )
  if (r === null) return { ok: false, why: `timed out after ${TIMEOUT_MS / 1000}s` }
  if (!r.ok) return { ok: false, why: r.status ? `the API call failed (${r.status})` : 'no connection to the API' }
  const content = (JSON.parse(r.text).content ?? []) as { type: string; text?: string }[]
  const text = content.map(b => (b.type === 'text' ? (b.text ?? '') : '')).join('')
  return { ok: true, text, via: `${model} via your API key` }
}

async function refine($: EngineInterface, s: Settings) {
  if (await read($, isBusy)) {
    inFlight?.abort() // Ctrl+G while it runs: cancel, keep the draft
    return
  }
  if (await read($, isRefined)) {
    await $.prompt.fill({ text: await read($, original), mode: 'replace' })
    await update($, rewrite, () => '')
    await update($, isRefined, () => false)
    $.ui.toast('unramble: your original is back')
    return
  }
  const draft = (await $.prompt.read()).text
  const spoken = expandSpoken(draft, await read($, pastes)).trim()
  const skip = skipReason(spoken)
  if (skip) {
    if (wordCount(spoken) >= MIN_WORDS) $.ui.toast(`unramble: ${skip}`)
    return
  }

  const controller = new AbortController()
  inFlight = controller
  await update($, isBusy, () => true) // the band reads "refining…" meanwhile
  try {
    const startedAt = await $.clock.now()
    const { masked, blocks } = mask(spoken)
    const system = systemPrompt(await rules($), s.vocabulary)
    const out: Outcome =
      s.engine === 'api'
        ? await viaApi($, s.apiKey, system, transcript(masked), s.model)
        : await viaPlan($, system, transcript(masked), s.model, controller.signal)
    if (controller.signal.aborted) {
      $.ui.toast('unramble: cancelled — your text is unchanged')
      return
    }
    if (!out.ok) {
      $.ui.toast(`unramble: ${out.why} — your text is unchanged`)
      return
    }
    const checked = check(spoken, out.text, blocks)
    if (!checked.ok) {
      $.ui.toast(`unramble: kept your text — ${checked.why}`)
      return
    }
    // Typed or spoke more while the rewrite ran: the person's text wins.
    if ((await $.prompt.read()).text !== draft) {
      $.ui.toast('unramble: you edited while it ran — kept your text')
      return
    }
    await update($, original, () => draft)
    await update($, rewrite, () => checked.text)
    await $.prompt.fill({ text: checked.text, mode: 'replace' })
    await update($, isRefined, () => true)
    const secs = ((await $.clock.now()) - startedAt) / 1000
    $.ui.toast(`unramble: done in ${secs.toFixed(1)}s with ${out.via} · ⌃G again restores your original`)
  } catch (err) {
    $.ui.toast(`unramble: failed (${String(err).slice(0, 80)}) — your text is unchanged`)
  } finally {
    if (inFlight === controller) inFlight = null
    await update($, isBusy, () => false)
  }
}

async function track($: EngineInterface, text: string) {
  await update($, hasDraft, () => wordCount(text) >= MIN_WORDS)
  const last = await read($, rewrite)
  await update($, isRefined, () => last !== '' && text.trim() === last.trim())
}

export const register: Register = (on, options) => {
  const s = settingsOf(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: NAME,
      description: 'Ctrl+G prompt cleanup: `setup` binds the key, `status` shows engine, model and key binding',
      argumentHint: 'setup | status',
    })
    let bound = false
    try {
      const found = await readKeybindings($)
      bound = found ? isBound(parse(found.text)) : false
    } catch {}
    await update($, isKeyBound, () => bound)
    // installed from /plugin or a link, nothing has bound the key yet: say the one step left
    if (!bound) $.ui.toast('unramble is installed — run /unramble setup once to bind Ctrl+G')
    return next(e)
  })

  on('command.run', { command: NAME }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'setup') return { text: await setup($) }
    if (arg === '' || arg === 'status') return { text: await status($, s) }
    return { text: `Unknown argument "${e.args.trim()}". Use /unramble setup or /unramble status.` }
  }).catch(() => ({ text: 'unramble: that command failed; nothing was changed. Try /unramble status.' }))

  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    // Claude Code 2.1.308 raises no edit for a paste it folds into a chip, so this only sees
    // pastes it keeps inline; a chip it never saw is left as a chip (expandSpoken).
    const chip = e.key ? null : newChip(e.text, box.text)
    if (chip) await update($, pastes, m => ({ ...m, [chip]: e.inputText }))
    await track($, box.text)
    return box
  })

  on('prompt.change', async ($, e, next) => {
    await track($, e.text)
    return next(e)
  })

  // A sent prompt clears the band and the stored rewrite, so the next draft is never compared
  // with a stale one. If this ever throws, the prompt still goes.
  on('prompt.submit', async ($, e, next) => {
    await update($, hasDraft, () => false)
    await update($, rewrite, () => '')
    await update($, original, () => '')
    await update($, isRefined, () => false)
    await update($, pastes, () => ({}))
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const busy = await read($, isBusy)
    const refined = await read($, isRefined)
    if (e.props.hasSurvey || !(busy || refined || (await read($, hasDraft)))) return next(e)
    const bound = await read($, isKeyBound)
    const { Box, Button, Text } = $.ui.resolve(e)
    const key = bound ? '⌃G ' : ''
    const label = busy ? `refining… ${key ? '⌃G cancels' : ''}`.trim() : refined ? `${key}original` : `${key}refine`
    return (
      <Box>
        <Button key="unramble" plain action={ACTION} label="unramble" onPress={() => refine($, s)}>
          <Text dimColor>{label}</Text>
        </Button>
        {bound ? null : <Text dimColor> · /unramble setup binds ⌃G</Text>}
      </Box>
    )
  })
}
