import { describe, expect, test } from 'claude-code/testing'

import { ACTION, isBound, parse, plan, serialize, unplan } from '../hooks/keybindings.js'

describe('keybinding setup', () => {
  test('no file: Ctrl+G is bound from scratch, the editor keeps ctrl+x ctrl+e', () => {
    const p = plan(parse(null))
    if (p.kind !== 'change') throw new Error(p.kind)
    expect(isBound(p.file)).toBe(true)
    const chat = p.file.bindings.find(b => b.context === 'Chat')
    expect(chat?.bindings['ctrl+x ctrl+e']).toBe('chat:externalEditor')
    expect(p.changes.length).toBe(3)
  })

  test('existing bindings are kept and nothing is duplicated', () => {
    const before = parse(
      JSON.stringify({
        bindings: [
          { context: 'Global', bindings: { 'ctrl+t': 'app:toggleTodos' } },
          { context: 'Chat', bindings: { 'ctrl+e': 'chat:externalEditor' } },
        ],
      }),
    )
    const p = plan(before)
    if (p.kind !== 'change') throw new Error(p.kind)
    expect(p.file.bindings.length).toBe(2)
    expect(p.file.bindings[0]?.bindings['ctrl+t']).toBe('app:toggleTodos')
    expect(p.file.bindings[1]?.bindings['ctrl+x ctrl+e']).toBe(undefined) // editor already has a key
    expect(before.bindings[0]?.bindings['ctrl+g']).toBe(undefined) // the input is not mutated
  })

  test('a chord the person bound to something else is a conflict, not an overwrite', () => {
    const p = plan(parse(JSON.stringify({ bindings: [{ context: 'Global', bindings: { 'ctrl+g': 'app:redraw' } }] })))
    expect(p).toEqual({ kind: 'conflict', why: 'ctrl+g is bound to "app:redraw" in your Global keybindings' })
  })

  test('already bound: nothing to do, and running setup twice is a no-op', () => {
    const first = plan(parse(null))
    if (first.kind !== 'change') throw new Error(first.kind)
    expect(plan(parse(serialize(first.file)))).toEqual({ kind: 'ready' })
    expect(first.file.bindings.find(b => b.context === 'Global')?.bindings['ctrl+g']).toBe(ACTION)
  })

  test('uninstall takes back only what setup added', () => {
    const user = { context: 'Global', bindings: { 'ctrl+t': 'app:toggleTodos' } }
    const p = plan(parse(JSON.stringify({ bindings: [user] })))
    if (p.kind !== 'change') throw new Error(p.kind)
    const back = unplan(p.file)
    expect(isBound(back.file)).toBe(false)
    expect(back.file.bindings[0]?.bindings).toEqual({ 'ctrl+t': 'app:toggleTodos' })
    expect(back.changes.length).toBe(2)
    // a chord the person re-bound since setup is theirs and stays
    const rebound = parse(JSON.stringify({ bindings: [{ context: 'Global', bindings: { 'ctrl+g': 'app:redraw' } }] }))
    expect(unplan(rebound).changes).toEqual([])
  })

  test('a file that is not keybindings JSON is refused', () => {
    expect(() => parse('{ "bindings": 3 }')).toThrow()
    expect(() => parse('not json')).toThrow()
  })
})
