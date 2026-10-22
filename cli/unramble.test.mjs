// The installer against a stand-in `claude` and a throwaway config dir: what it runs, what it
// writes, and that uninstall takes back only its own bindings.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const CLI = fileURLToPath(new URL('./unramble.mjs', import.meta.url))
const WINDOWS = process.platform === 'win32'
// Windows spells it Path; setting a second PATH beside it would leave which one wins to chance
const PATH = Object.keys(process.env).find(k => k.toUpperCase() === 'PATH') ?? 'PATH'

function sandbox(keybindings) {
  const dir = mkdtempSync(join(tmpdir(), 'unramble-'))
  after(() => rmSync(dir, { recursive: true, force: true }))
  const bin = join(dir, 'bin')
  const config = join(dir, 'config')
  const log = join(dir, 'calls')
  mkdirSync(bin)
  mkdirSync(config)
  // a fake claude: records its argv, lists the plugin as installed
  if (WINDOWS) {
    writeFileSync(
      join(bin, 'claude.cmd'),
      `@echo off\r\necho %*>> "${log}"\r\nif "%2"=="list" echo unramble@unramble\r\nexit /b 0\r\n`,
    )
  } else {
    writeFileSync(join(bin, 'claude'), `#!/bin/sh\necho "$@" >> "${log}"\n[ "$2" = list ] && echo "unramble@unramble"\nexit 0\n`)
    chmodSync(join(bin, 'claude'), 0o755)
  }
  if (keybindings) writeFileSync(join(config, 'keybindings.json'), JSON.stringify(keybindings))
  const runWith = (env, ...args) =>
    spawnSync(process.execPath, [CLI, ...args], {
      env: {
        ...process.env,
        [PATH]: `${bin}${delimiter}${process.env[PATH]}`,
        CLAUDE_CONFIG_DIR: config,
        UNRAMBLE_MARKETPLACE: '', // a value from the caller's shell would change the command under test
        ...env,
      },
      encoding: 'utf8',
    })
  const run = (...args) => runWith({}, ...args)
  const keys = () => JSON.parse(readFileSync(join(config, 'keybindings.json'), 'utf8'))
  const calls = () =>
    readFileSync(log, 'utf8')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
  return { run, runWith, keys, calls, config, log }
}

test('install adds the plugin and binds Ctrl+G, keeping a backup', () => {
  const mine = { bindings: [{ context: 'Global', bindings: { 'ctrl+t': 'app:toggleTodos' } }] }
  const s = sandbox(mine)
  const r = s.run()
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(s.calls(), ['plugin install unramble --marketplace yadava5/unramble'])
  const global = s.keys().bindings.find(b => b.context === 'Global').bindings
  assert.equal(global['ctrl+g'], 'app:cycleDiffBase')
  assert.equal(global['ctrl+t'], 'app:toggleTodos')
  assert.deepEqual(JSON.parse(readFileSync(join(s.config, 'keybindings.json.unramble-backup'), 'utf8')), mine)
  assert.match(s.run('status').stdout, /Plugin:\s+installed[\s\S]*Ctrl\+G:\s+bound/)
})

test('uninstall removes the plugin and only the bindings install added', () => {
  const s = sandbox(null)
  s.run('install')
  const r = s.run('uninstall')
  assert.equal(r.status, 0, r.stderr)
  assert.ok(s.calls().includes('plugin uninstall unramble@unramble'))
  const chat = s.keys().bindings.find(b => b.context === 'Chat').bindings
  assert.equal(chat['ctrl+g'], undefined)
  assert.equal(s.keys().bindings.find(b => b.context === 'Global').bindings['ctrl+g'], undefined)
})

test('a chord bound to something else is left alone', () => {
  const s = sandbox({ bindings: [{ context: 'Global', bindings: { 'ctrl+g': 'app:redraw' } }] })
  const r = s.run('install')
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /Left keybindings alone/)
  assert.equal(s.keys().bindings[0].bindings['ctrl+g'], 'app:redraw')
  assert.equal(existsSync(join(s.config, 'keybindings.json.unramble-backup')), false)
})

test('the first backup is the person’s own file and survives a reinstall', () => {
  const mine = { bindings: [{ context: 'Global', bindings: { 'ctrl+t': 'app:toggleTodos' } }] }
  const s = sandbox(mine)
  s.run('install')
  s.run('uninstall')
  s.run('install')
  assert.deepEqual(JSON.parse(readFileSync(join(s.config, 'keybindings.json.unramble-backup'), 'utf8')), mine)
})

test('a marketplace override that could reach a shell is refused before anything runs', () => {
  const s = sandbox(null)
  for (const bad of ['x & calc', 'a|b', '--marketplace=evil', 'x"y']) {
    const r = s.runWith({ UNRAMBLE_MARKETPLACE: bad }, 'install')
    assert.equal(r.status, 1, bad)
    assert.match(r.stderr, /must be owner\/repo or a folder path/)
  }
  assert.equal(existsSync(s.log), false)
  assert.equal(s.runWith({ UNRAMBLE_MARKETPLACE: 'someone/fork' }, 'install').status, 0)
  assert.deepEqual(s.calls(), ['plugin install unramble --marketplace someone/fork'])
})

test('broken keybindings JSON is refused, not rewritten', () => {
  const s = sandbox(null)
  writeFileSync(join(s.config, 'keybindings.json'), '{ not json')
  const r = s.run('install')
  assert.equal(r.status, 1)
  assert.equal(readFileSync(join(s.config, 'keybindings.json'), 'utf8'), '{ not json')
})
