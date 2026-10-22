import type { EngineInterface, ModelCompleteResult } from 'claude-code'

// Two ways to reach a model. `plan` (the default) is Claude Code's own client: the session's
// login, billed to the person's plan exactly like their prompts, with no key anywhere. `api` is
// opt-in: a key the person saved in the plugin's settings, which Claude Code keeps in its
// secure storage, sent only to api.anthropic.com and only while `engine` says `api`. A failed
// API call never slides onto the plan; the draft is kept and the toast says why.

export const TIMEOUT_MS = 45_000
const MAX_TOKENS = 8_000
const API = 'https://api.anthropic.com/v1'
const DAY_MS = 86_400_000

export type Outcome = { ok: true; text: string; via: string } | { ok: false; why: string }

export function explain(r: Exclude<ModelCompleteResult, { isAnswered: true }>): string {
  if (r.reason === 'aborted') return 'cancelled or timed out'
  if (r.reason === 'empty-reply') return 'the model sent back nothing'
  if (r.error === 'billing_error') return 'the account has no credit left for this call'
  if (r.error === 'authentication_failed') return 'Claude Code is not signed in'
  if (r.status === 429) return 'usage limit reached (429)'
  if (r.status === null) return 'no connection to the model'
  return `the model call failed (${r.status})`
}

export async function viaPlan(
  $: EngineInterface,
  system: string,
  prompt: string,
  model: string,
  signal: AbortSignal,
): Promise<Outcome> {
  // The rules are the same on every call, so they are cached: a second rewrite within the
  // cache window reads them instead of paying for them again.
  const r = await $.model.complete(
    { model, system: [{ text: system, cache: true }], prompt, maxTokens: MAX_TOKENS, timeoutMs: TIMEOUT_MS },
    { signal },
  )
  return r.isAnswered ? { ok: true, text: r.text, via: `${model} on your plan` } : { ok: false, why: explain(r) }
}

type Fetched = { status: number; ok: boolean; text: string }

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

const headers = (key: string) => ({
  'x-api-key': key,
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json',
})

/** The newest model id of a family (`sonnet`, `opus`), re-checked daily, so a release needs no update. */
async function apiModel($: EngineInterface, key: string, family: string): Promise<string | null> {
  const cached = (await $.store.get(`apiModel.${family}`)) as { id: string; at: number } | undefined
  const now = await $.clock.now()
  if (cached && now - cached.at < DAY_MS) return cached.id
  const r = await withTimeout($, $.http.fetch(`${API}/models?limit=100`, { headers: headers(key) }))
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

export async function viaApi(
  $: EngineInterface,
  key: string,
  system: string,
  prompt: string,
  family: string,
): Promise<Outcome> {
  if (!key.trim()) return { ok: false, why: 'engine is "api" but no API key is saved (see /unramble status)' }
  const model = await apiModel($, key.trim(), family)
  if (!model) return { ok: false, why: 'the API key was refused or the model list is unreachable' }
  const body = JSON.stringify({
    model,
    max_tokens: MAX_TOKENS,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt }],
  })
  const r = await withTimeout($, $.http.fetch(`${API}/messages`, { method: 'POST', headers: headers(key.trim()), body }))
  if (r === null) return { ok: false, why: `timed out after ${TIMEOUT_MS / 1000}s` }
  if (!r.ok) return { ok: false, why: r.status ? `the API call failed (${r.status})` : 'no connection to the API' }
  const content = (JSON.parse(r.text).content ?? []) as { type: string; text?: string }[]
  const text = content.map(b => (b.type === 'text' ? (b.text ?? '') : '')).join('')
  return { ok: true, text, via: `${model} via your API key` }
}
