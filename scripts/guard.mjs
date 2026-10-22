#!/usr/bin/env node
// node scripts/guard.mjs [root] — the supply-chain tripwire CI runs on every push and pull request.
//
// unramble runs inside people's Claude Code sessions and its installer runs through npx, so a
// change that widens what the code can reach must never land unnoticed. Each rule below pins
// what the shipped code is allowed to do today; anything new (a network host, a process, an
// engine capability, a dependency, an install script, invisible characters, an unpinned action)
// fails with the rule's id and needs the maintainer to widen the rule on purpose. This file is
// owned by the maintainer in CODEOWNERS, so widening it is itself a reviewed change.
//
// It is a tripwire, not a sandbox: determined obfuscation can slip past text rules. Review of
// every change to the runtime files is the real gate; this makes the dangerous ones loud.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SKIP_DIRS = new Set(['.git', 'node_modules', 'out'])
const SKIP_PATHS = ['.claude-plugin/types/', 'plugin/.claude-plugin/types/']

/** The code that ships: the plugin's hooks and the npx installer. */
const RUNTIME = /^(plugin\/hooks\/.+\.(ts|tsx|js|json)|cli\/unramble\.mjs)$/
const HOOK_FILES = ['plugin/hooks/hooks.json', 'plugin/hooks/keybindings.js', 'plugin/hooks/refine.ts', 'plugin/hooks/register.tsx']

/** Everything in plugin/, which the marketplace copies onto every user's machine. */
const PLUGIN_FILES = [
  ...HOOK_FILES,
  'plugin/.claude-plugin/plugin.json',
  'plugin/LICENSE',
  'plugin/README.md',
  'plugin/assets/logo-512.png',
  'plugin/prompt/system.md',
  'plugin/tsconfig.json',
  'plugin/types/index.d.ts',
]
const PLUGIN_TESTS = /^plugin\/tests\/[\w.-]+\.test\.tsx?$/

/** Engine capabilities (`$.noun`) each runtime file may use. */
const CAPABILITIES = {
  'plugin/hooks/register.tsx': ['clock', 'command', 'env', 'fs', 'model', 'plugin', 'prompt', 'ui'],
}

/** Every URL the shipped code may contain. The plugin talks to no host itself: the model call
 *  goes through Claude Code's own client. The installer names only Claude Code's setup page. */
const URLS = ['https://code.claude.com/docs/en/setup']

/** Binary files are allowed only as these, only here. */
const BINARIES = [/^assets\/[\w.-]+\.(png|gif|mp4)$/, /^plugin\/assets\/logo-512\.png$/, /^video\/public\/fonts\/[\w.-]+\.ttf$/]

// Bidi controls (Trojan Source), zero-width and word-joiner characters, BOMs past the start of a
// file, and the Unicode tag block, which can smuggle instructions to a model that a reviewer
// never sees. Built from code points so this file holds none of them itself.
const HIDDEN_RANGES = [
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x206f],
  [0xfeff, 0xfeff],
  [0xe0000, 0xe007f],
]
const isHidden = cp => HIDDEN_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)

const DANGEROUS = [
  [/\beval\s*\(/, 'eval()'],
  [/\bnew\s+Function\b|\bFunction\s*\(/, 'Function constructor'],
  [/\bimport\s*\(/, 'dynamic import()'],
  [/\brequire\s*\(/, 'require()'],
  [/\batob\s*\(|['"]base64['"]/, 'base64 decoding'],
  [/\bString\.fromCharCode\b|\bString\.fromCodePoint\b/, 'building strings from char codes'],
  [/\\x[0-9a-f]{2}(\\x[0-9a-f]{2}){3,}|\\u[0-9a-f]{4}(\\u[0-9a-f]{4}){3,}/i, 'escaped byte string'],
  [/\b(globalThis|global|window|self)\s*\[/, 'computed global access'],
]

const LIFECYCLE = /^(pre|post)?(install|uninstall|prepare|prepack|pack|publish|prepublishOnly|shrinkwrap|version|restart|start|stop)$/

function walk(root, dir = root, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const rel = relative(root, full).split(sep).join('/')
    if (SKIP_PATHS.some(p => `${rel}/`.startsWith(p))) continue
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(root, full, out)
    } else out.push(rel)
  }
  return out
}

/** 1-based line of the first hidden character, or 0. A BOM as a file's first character is fine. */
function hiddenLine(text) {
  let line = 1
  let index = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp === 0x0a) line++
    else if (isHidden(cp) && !(cp === 0xfeff && index === 0)) return line
    index++
  }
  return 0
}

export function guard(root) {
  const problems = []
  const fail = (rule, file, why) => problems.push({ rule, file, why })
  const files = walk(root)
  const read = f => readFileSync(join(root, f))

  for (const f of files) {
    const bytes = read(f)
    if (bytes.subarray(0, 8000).includes(0)) {
      if (!BINARIES.some(re => re.test(f))) fail('binary-file', f, 'binary files belong in assets/ (png, gif, mp4) or video/public/fonts/')
      continue
    }
    const at = hiddenLine(bytes.toString('utf8'))
    if (at) fail('hidden-unicode', `${f}:${at}`, 'invisible or direction-changing characters')
  }

  for (const f of files.filter(f => f.startsWith('plugin/'))) {
    if (!PLUGIN_FILES.includes(f) && !PLUGIN_TESTS.test(f)) fail('runtime-file', f, 'a new file in plugin/ ships to every user; add it to PLUGIN_FILES after review')
  }

  for (const f of files.filter(f => RUNTIME.test(f))) {
    const code = read(f).toString('utf8')
    for (const [re, what] of DANGEROUS) if (re.test(code)) fail('dangerous-code', f, what)
    for (const url of code.match(/https?:\/\/[^\s'"`)<>]+/g) ?? []) {
      if (!URLS.includes(url.replace(/[.,;]+$/, ''))) fail('network-host', f, `URL not on the list: ${url}`)
    }
    if (/\bnode:(http|https|net|tls|dgram|dns|http2|vm|worker_threads|cluster)\b|\bfetch\s*\(/.test(code)) {
      fail('network-host', f, 'network or vm module outside the engine')
    }
    const uses = new Set([...code.matchAll(/\$\.([A-Za-z_]\w*)/g)].map(m => m[1]))
    const allowed = CAPABILITIES[f] ?? []
    for (const noun of uses) if (!allowed.includes(noun)) fail('capability', f, `uses $.${noun}`)
    // Passing `$` to a helper is fine (the helper's own file is checked); renaming or indexing it
    // would hide which capabilities are used.
    if (/=\s*\$\s*[;\n]|\}\s*=\s*\$\b|\$\s*\[|\$\s*\?\.\s*\[/.test(code)) fail('capability', f, 'aliases or indexes $ (capabilities must be spelled $.noun)')
    if (code.includes('child_process') && f !== 'cli/unramble.mjs') fail('process', f, 'child_process outside the installer')
    if (f === 'cli/unramble.mjs') {
      const imported = /import\s*\{([^}]*)\}\s*from\s*'node:child_process'/.exec(code)?.[1].split(',').map(s => s.trim())
      if (imported && imported.join() !== 'spawnSync') fail('process', f, `imports ${imported.join(', ')} from child_process`)
      const calls = [...code.matchAll(/spawnSync\(([^,]*),/g)].map(m => m[1].trim())
      if (calls.some(c => c !== "'claude'")) fail('process', f, 'spawnSync may only run claude')
      if (/\b(exec|execSync|execFile|execFileSync|fork|spawn)\s*\(/.test(code)) fail('process', f, 'process call other than spawnSync')
    }
  }

  const pkg = JSON.parse(read('package.json').toString('utf8'))
  for (const k of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'bundleDependencies', 'bundledDependencies']) {
    if (pkg[k] && Object.keys(pkg[k]).length) fail('package', 'package.json', `${k}: the installer has no dependencies`)
  }
  for (const s of Object.keys(pkg.scripts ?? {})) if (LIFECYCLE.test(s)) fail('package', 'package.json', `lifecycle script "${s}" would run on install or publish`)
  if (JSON.stringify(pkg.files) !== JSON.stringify(['cli/unramble.mjs', 'plugin/hooks/keybindings.js'])) fail('package', 'package.json', 'files must stay the installer and the keybinding merge')
  if (JSON.stringify(pkg.bin) !== JSON.stringify({ unramble: 'cli/unramble.mjs' })) fail('package', 'package.json', 'bin must stay unramble → cli/unramble.mjs')

  const hooks = JSON.parse(read('plugin/hooks/hooks.json').toString('utf8'))
  if (JSON.stringify(hooks) !== JSON.stringify({ modules: ['./register.tsx'] })) fail('plugin', 'plugin/hooks/hooks.json', 'the hooks module list changed')
  const manifest = JSON.parse(read('plugin/.claude-plugin/plugin.json').toString('utf8'))
  for (const k of ['mcpServers', 'lspServers', 'commands', 'agents', 'skills', 'hooks', 'outputStyles']) {
    if (k in manifest) fail('plugin', 'plugin/.claude-plugin/plugin.json', `declares ${k}`)
  }
  const market = JSON.parse(read('.claude-plugin/marketplace.json').toString('utf8'))
  if (market.plugins?.some(p => p.source !== './plugin')) fail('plugin', '.claude-plugin/marketplace.json', 'a plugin source points outside plugin/')
  if (manifest.version !== pkg.version) fail('plugin', 'plugin/.claude-plugin/plugin.json', `version ${manifest.version} differs from package.json ${pkg.version}`)

  const rules = read('plugin/prompt/system.md').toString('utf8')
  if (/https?:\/\//.test(rules)) fail('rules', 'plugin/prompt/system.md', 'the rules contain a URL')
  if (/names (you may hear|this user often says):[ \t]*[^\s(]/i.test(rules)) fail('rules', 'plugin/prompt/system.md', 'hard-codes a name list; names belong in the vocabulary setting')

  for (const f of files.filter(f => /^\.github\/workflows\/.+\.ya?ml$/.test(f))) {
    const wf = read(f).toString('utf8')
    for (const m of wf.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) {
      if (!/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(m[1]) && !m[1].startsWith('./')) fail('workflow', f, `${m[1]} is not pinned to a commit`)
    }
    if (/\bpull_request_target\b|\bworkflow_run\b/.test(wf)) fail('workflow', f, 'pull_request_target / workflow_run run fork code with secrets')
  }

  return problems
}

if (process.argv[1]?.endsWith('guard.mjs')) {
  const problems = guard(process.argv[2] ?? process.cwd())
  for (const p of problems) process.stderr.write(`✗ [${p.rule}] ${p.file}: ${p.why}\n`)
  if (problems.length) process.exit(1)
  process.stdout.write('✓ guard: nothing new that the shipped code could reach\n')
}
