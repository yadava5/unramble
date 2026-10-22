#!/usr/bin/env node
// node eval/run.mjs <corpus.jsonl> [--model sonnet] [--judge opus] [--runs 2] [--out results.jsonl]
//
// Rewrites every case with the plugin's own rules and text handling, has a second model judge
// each rewrite against eval/rubric.md, and prints the major-free score. Runs on your Claude Code
// plan through `claude -p`: no key, and each case costs one rewrite and one judgement.
//
// A corpus line: {"id": "c1", "src": "what you said", "intent": "optional: what you meant"}.
// Needs Node 22.18 or newer (it imports the plugin's TypeScript directly).

import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { check, mask, systemPrompt, transcript } from '../hooks/refine.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: 'string', default: 'sonnet' },
    judge: { type: 'string', default: 'opus' },
    runs: { type: 'string', default: '2' },
    vocabulary: { type: 'string', default: '' },
    out: { type: 'string', default: 'eval-results.jsonl' },
  },
})
if (!positionals[0]) {
  console.error('usage: node eval/run.mjs <corpus.jsonl> [--model sonnet] [--judge opus] [--runs 2]')
  process.exit(2)
}

const here = new URL('.', import.meta.url)
const rules = systemPrompt(readFileSync(new URL('../prompt/system.md', here), 'utf8'), values.vocabulary)
const rubric = readFileSync(new URL('rubric.md', here), 'utf8')
const neutral = mkdtempSync(join(tmpdir(), 'unramble-eval-')) // no project CLAUDE.md or hooks load

function ask(model, system, prompt) {
  const r = spawnSync(
    'claude',
    ['-p', '--model', model, '--no-session-persistence', '--setting-sources', 'project,local',
      '--system-prompt', system, '--tools', '', '--output-format', 'json'],
    { input: prompt, cwd: neutral, encoding: 'utf8', maxBuffer: 1 << 24 },
  )
  if (r.status !== 0) throw new Error(r.stderr.slice(0, 200) || `claude exited ${r.status}`)
  return JSON.parse(r.stdout).result ?? ''
}

const cases = readFileSync(positionals[0], 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
let total = 0
let majorFree = 0
for (const c of cases) {
  for (let run = 0; run < Number(values.runs); run += 1) {
    const { masked, blocks } = mask(c.src.trim())
    const t0 = Date.now()
    const reply = ask(values.model, rules, transcript(masked))
    const secs = (Date.now() - t0) / 1000
    const checked = check(c.src.trim(), reply, blocks)
    const out = checked.ok ? checked.text : `REFUSED BY THE GUARD: ${checked.why}`
    let judged = `<SOURCE>\n${c.src}\n</SOURCE>\n`
    if (c.intent) judged += `<INTENT>\n${JSON.stringify(c.intent, null, 1)}\n</INTENT>\n`
    judged += `<REWRITE>\n${out}\n</REWRITE>`
    const verdict = ask(values.judge, rubric, judged)
    const defects = JSON.parse(verdict.slice(verdict.indexOf('{'), verdict.lastIndexOf('}') + 1)).defects ?? []
    const major = defects.some(d => d.severity === 'major')
    total += 1
    if (!major) majorFree += 1
    appendFileSync(values.out, `${JSON.stringify({ id: `${c.id}~${run}`, out, secs, defects })}\n`)
    console.log(`${major ? '✗' : '✓'} ${c.id}~${run} ${secs.toFixed(1)}s ${defects.map(d => `${d.severity}:${d.kind}`).join(' ')}`)
  }
}
console.log(`\nmajor-free ${majorFree}/${total} with ${values.model}, judged by ${values.judge}; rows in ${values.out}`)
