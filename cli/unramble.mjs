#!/usr/bin/env node
// npx unramble [install | uninstall | status] — sets the plugin up in one paste.
//
// install:   claude plugin install unramble --marketplace yadava5/unramble, then binds Ctrl+G
//            in keybindings.json (a backup is kept beside it).
// uninstall: removes the plugin and takes back only the keybindings install added.
// status:    shows whether the plugin is installed and Ctrl+G is bound.
//
// No dependencies. It changes nothing but the plugin install and those two keybindings.

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { isBound, parse, plan, serialize, unplan } from '../hooks/keybindings.js'

const MARKETPLACE = process.env.UNRAMBLE_MARKETPLACE || 'yadava5/unramble'
const PLUGIN = 'unramble'
const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
const keybindings = join(configDir, 'keybindings.json')

const say = (line = '') => process.stdout.write(`${line}\n`)
const fail = line => {
  process.stderr.write(`unramble: ${line}\n`)
  process.exit(1)
}

/** Runs `claude` with the person's own environment and terminal; true on success. */
function claude(args, { quiet = false } = {}) {
  const r = spawnSync('claude', args, {
    stdio: quiet ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
    encoding: 'utf8',
  })
  if (r.error?.code === 'ENOENT') {
    fail('Claude Code is not on your PATH. Install it first: https://code.claude.com/docs/en/setup')
  }
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

function readKeys() {
  const text = existsSync(keybindings) ? readFileSync(keybindings, 'utf8') : null
  try {
    return { text, file: parse(text) }
  } catch (err) {
    fail(`${keybindings} is not valid keybindings JSON (${err.message}); left it alone.`)
  }
}

function bindKeys() {
  const { text, file } = readKeys()
  const next = plan(file)
  if (next.kind === 'ready') return say('✓ Ctrl+G was already bound')
  if (next.kind === 'conflict') {
    say(`! Left keybindings alone: ${next.why}.`)
    say(`  Free that chord in ${keybindings}, then run /unramble setup in Claude Code.`)
    return
  }
  if (text !== null) copyFileSync(keybindings, `${keybindings}.unramble-backup`)
  writeFileSync(keybindings, serialize(next.file))
  say(`✓ Bound Ctrl+G in ${keybindings}${text !== null ? ' (backup: keybindings.json.unramble-backup)' : ''}`)
  for (const c of next.changes) say(`    ${c}`)
}

function install() {
  say(`Installing unramble from ${MARKETPLACE}…`)
  if (!claude(['plugin', 'install', PLUGIN, '--marketplace', MARKETPLACE]).ok) {
    fail('the plugin install did not finish; nothing else was changed.')
  }
  bindKeys()
  say()
  say('Done. Start a new Claude Code session, speak or type a rough prompt, and press Ctrl+G.')
  say('It runs on your Claude Code plan. Settings: /config (unramble rows) or /unramble status.')
}

function uninstall() {
  const removed = claude(['plugin', 'uninstall', `${PLUGIN}@${PLUGIN}`]).ok
  if (removed) claude(['plugin', 'marketplace', 'remove', PLUGIN], { quiet: true })
  const { text, file } = readKeys()
  const back = unplan(file)
  if (back.changes.length) {
    if (text !== null) copyFileSync(keybindings, `${keybindings}.unramble-backup`)
    writeFileSync(keybindings, serialize(back.file))
    say(`✓ Took back the Ctrl+G bindings in ${keybindings}`)
  }
  say(removed ? '✓ unramble is uninstalled' : '! The plugin was not installed (or the uninstall failed); see above.')
}

function status() {
  const listed = claude(['plugin', 'list'], { quiet: true })
  const installed = new RegExp(`\\b${PLUGIN}@`).test(listed.out)
  say(`Plugin:  ${installed ? 'installed' : 'not installed'}`)
  say(`Ctrl+G:  ${isBound(readKeys().file) ? 'bound' : 'not bound'} (${keybindings})`)
}

const command = process.argv[2] ?? 'install'
const commands = { install, uninstall, status }
if (command === '--help' || command === '-h' || !(command in commands)) {
  say('Usage: npx unramble [install | uninstall | status]')
  process.exit(command in commands || command.startsWith('-') ? 0 : 1)
}
commands[command]()
