// @ts-check
// Ctrl+G reaches a plugin only through a band Button naming an engine keybinding action that
// no engine handler holds while the prompt is focused, and only when that chord is bound in the
// Global context. So setup binds Global ctrl+g to app:cycleDiffBase (handled only while the diff
// panel is open, where it keeps working) and unbinds Chat ctrl+g (by default the external
// editor, which stays on ctrl+x ctrl+e). A chord the person bound to something else is theirs:
// setup reports the conflict and changes nothing.
//
// Plain JavaScript on purpose: the plugin imports it, and so does the npx installer, which runs
// from a package cache where Node will not strip TypeScript.

export const ACTION = 'app:cycleDiffBase'
export const CHORD = 'ctrl+g'
const EDITOR = 'chat:externalEditor'
const EDITOR_CHORD = 'ctrl+x ctrl+e'

/** @typedef {Record<string, string | null>} Bindings */
/** @typedef {{ context: string, bindings: Bindings }} Block */
/** @typedef {{ bindings: Block[], [key: string]: unknown }} KeybindingsFile */
/**
 * @typedef {{ kind: 'ready' }
 *   | { kind: 'change', file: KeybindingsFile, changes: string[] }
 *   | { kind: 'conflict', why: string }} SetupPlan
 */

/** @type {KeybindingsFile} */
const SKELETON = {
  $schema: 'https://www.schemastore.org/claude-code-keybindings.json',
  $docs: 'https://code.claude.com/docs/en/keybindings',
  bindings: [],
}

/** @param {KeybindingsFile} file @returns {KeybindingsFile} */
const clone = file => JSON.parse(JSON.stringify(file))

/**
 * Parses keybindings.json text; an absent file is an empty one. Throws on anything else.
 * @param {string | null} text
 * @returns {KeybindingsFile}
 */
export function parse(text) {
  if (text === null || !text.trim()) return clone(SKELETON)
  const data = JSON.parse(text)
  if (!data || typeof data !== 'object' || !Array.isArray(data.bindings)) {
    throw new Error('keybindings.json has no "bindings" list')
  }
  return data
}

/** @param {KeybindingsFile} file @param {string} context @returns {Block | undefined} */
const blockOf = (file, context) =>
  file.bindings.find(b => b && b.context === context && b.bindings && typeof b.bindings === 'object')

/**
 * Whether Ctrl+G already reaches unramble.
 * @param {KeybindingsFile} file
 */
export function isBound(file) {
  return blockOf(file, 'Global')?.bindings[CHORD] === ACTION && blockOf(file, 'Chat')?.bindings[CHORD] === null
}

/**
 * What setup would do to this file, without doing it.
 * @param {KeybindingsFile} current
 * @returns {SetupPlan}
 */
export function plan(current) {
  if (isBound(current)) return { kind: 'ready' }
  const globalNow = blockOf(current, 'Global')?.bindings[CHORD]
  if (globalNow !== undefined && globalNow !== ACTION) {
    return { kind: 'conflict', why: `ctrl+g is bound to "${globalNow}" in your Global keybindings` }
  }
  const chatNow = blockOf(current, 'Chat')?.bindings[CHORD]
  if (chatNow !== undefined && chatNow !== null && chatNow !== EDITOR) {
    return { kind: 'conflict', why: `ctrl+g is bound to "${chatNow}" in your Chat keybindings` }
  }

  const file = clone(current)
  /** @type {string[]} */
  const changes = []
  /** @param {string} context @returns {Block} */
  const ensure = context => {
    let block = blockOf(file, context)
    if (!block) {
      block = { context, bindings: {} }
      file.bindings.push(block)
    }
    return block
  }
  const global = ensure('Global')
  if (global.bindings[CHORD] !== ACTION) {
    global.bindings[CHORD] = ACTION
    changes.push(`Global: ctrl+g → ${ACTION} (lets the unramble band take Ctrl+G)`)
  }
  const chat = ensure('Chat')
  if (chat.bindings[CHORD] !== null) {
    chat.bindings[CHORD] = null
    changes.push('Chat: ctrl+g → unbound (it opened the external editor)')
  }
  if (!Object.values(chat.bindings).includes(EDITOR) && chat.bindings[EDITOR_CHORD] === undefined) {
    chat.bindings[EDITOR_CHORD] = EDITOR
    changes.push(`Chat: ${EDITOR_CHORD} → ${EDITOR} (the external editor keeps a key)`)
  }
  return { kind: 'change', file, changes }
}

/**
 * Takes back exactly what setup added, and nothing the person set themselves: Global ctrl+g
 * only while it still names unramble's action, Chat ctrl+g only while it is still unbound.
 * The ctrl+x ctrl+e editor key stays; it is Claude Code's own action.
 * @param {KeybindingsFile} current
 * @returns {{ file: KeybindingsFile, changes: string[] }}
 */
export function unplan(current) {
  const file = clone(current)
  /** @type {string[]} */
  const changes = []
  const global = blockOf(file, 'Global')
  if (global?.bindings[CHORD] === ACTION) {
    delete global.bindings[CHORD]
    changes.push('Global: ctrl+g removed')
  }
  const chat = blockOf(file, 'Chat')
  if (chat && chat.bindings[CHORD] === null) {
    delete chat.bindings[CHORD]
    changes.push('Chat: ctrl+g back to its default (the external editor)')
  }
  return { file, changes }
}

/** @param {KeybindingsFile} file */
export const serialize = file => `${JSON.stringify(file, null, 2)}\n`
