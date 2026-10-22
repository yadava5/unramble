import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

// The test host raises `prompt.edit` the way the box does for a burst of keys, though this
// build's declarations list no `$.prompt.edit` for tests.
const typed = ($: Engine, inputText: string) =>
  ($.prompt as unknown as { edit: (e: object) => Promise<{ text: string }> }).edit({
    origin: { kind: 'composer' },
    text: '',
    cursor: 0,
    start: 0,
    end: 0,
    inputText,
  })

// The whole Ctrl+G path through the engine's own test host: the band draws, a press sends the
// draft to $.model.complete with the rules cached, and the reply replaces the box only when it
// passes the checks. The hooks below stand for the engine: the prompt box, the model, the files.

const BAND = {
  plugin: 'unramble',
  component: 'AbovePrompt',
  requestId: 'band',
  surface: 'terminal',
  props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 80, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const

const ROUGH = 'okay so um can you look at the auth handler, uh no wait, the session middleware in src/session.ts'
const CLEAN = 'Look at the session middleware in `src/session.ts`.'

function engine(on: On, reply: (prompt: string) => string, home: { dir?: string; keybindings?: string } = {}) {
  const world = {
    box: ROUGH,
    toasts: [] as string[],
    asked: [] as { system?: string; prompt: string }[],
    fold: (inputText: string) => inputText,
  }
  mock.clock(on)
  // the box takes the edit; `fold` stands for the engine turning a paste into a chip
  on('prompt.edit', (_, e) => {
    const input = world.fold(e.inputText)
    return { text: e.text.slice(0, e.start) + input + e.text.slice(e.end), cursor: e.start + input.length }
  })
  on('prompt.read', () => ({ value: { text: world.box, cursor: world.box.length } }))
  on('prompt.fill', (_, e) => {
    world.box = e.text
    return { isFilled: true }
  })
  on('model.complete', (_, e) => {
    world.asked.push({ system: e.system, prompt: e.prompt })
    const usage = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
    return { value: { isAnswered: true, text: reply(e.prompt), usage } }
  })
  // the engine hands Windows paths over with backslashes
  const isKeys = (path: string) => /[\\/]keybindings\.json$/.test(path)
  on('fs.read', (_, e) => ({ value: isKeys(e.path) ? (home.keybindings ?? '') : 'RULES' }))
  on('fs.exists', (_, e) => ({ value: isKeys(e.path) && home.keybindings !== undefined }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? home.dir : undefined }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', (_, e) => {
    world.toasts.push(e.text)
    return { value: undefined }
  })
  return world
}

test('Ctrl+G rewrites the draft in place, and again restores the original', async ($, on) => {
  const world = engine(on, () => CLEAN)
  await typed($, ROUGH)
  const ui = await $.ui.mount(BAND)

  expect((await ui.find({ type: 'Text', text: /refine/ }))?.text).toContain('refine')
  await ui.press({ key: 'unramble' })

  expect(world.box).toBe(CLEAN)
  expect(world.asked[0]?.system).toBe('RULES')
  expect(world.asked[0]?.prompt).toBe(`<transcript>\n${ROUGH}\n</transcript>`)
  expect(world.toasts.at(-1)).toContain('⌃G again restores your original')

  await typed($, CLEAN)
  await ui.press({ key: 'unramble' })
  expect(world.box).toBe(ROUGH)
  await ui.unmount()
})

test('a rewrite that drops a path is refused and the draft is kept', async ($, on) => {
  const world = engine(on, () => 'Look at the session middleware.')
  await typed($, ROUGH)
  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'unramble' })

  expect(world.box).toBe(ROUGH)
  expect(world.toasts.at(-1)).toBe('kept your text — the rewrite dropped /session.ts')
  await ui.unmount()
})

test('a pasted log never reaches the model and comes back byte for byte', async ($, on) => {
  const log = '    at Object.openSync (node:fs:573:3)\n    at readFileSync (node:fs:452:35)'
  const draft = `so the build crashes with this\n${log}\ncan you fix it`
  const world = engine(on, prompt => {
    expect(prompt).not.toContain('openSync')
    return 'The build crashes with this:\n[[paste 1]]\nCan you fix it?'
  })
  world.box = draft
  await typed($, draft)
  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'unramble' })

  expect(world.box).toBe(`The build crashes with this:\n${log}\nCan you fix it?`)
  await ui.unmount()
})

test('a dictation app that pastes: the chip is opened up for the rewrite', async ($, on) => {
  const CHIP = '[Pasted text #1 +2 lines]'
  const heard = 'okay so um rename the config loader\nuh to settings loader, everywhere'
  const world = engine(on, prompt => {
    expect(prompt).toContain('rename the config loader') // the words, not the chip, reach the model
    return 'Rename the config loader to settings loader, everywhere.'
  })
  // the engine collapses a multi-line paste into a chip in the box
  world.fold = () => CHIP
  const box = await typed($, heard)
  world.box = box.text
  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'unramble' })

  expect(world.box).toBe('Rename the config loader to settings loader, everywhere.')
  await ui.press({ key: 'unramble' })
  expect(world.box).toBe(CHIP) // restoring puts the chip back, which still stands for the paste
  await ui.unmount()
})

test('two words draw no band', async ($, on) => {
  engine(on, () => CLEAN)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await typed($, 'fix it')
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Button' })).toBe(undefined)
  await ui.unmount()
})

test('a session with Ctrl+G not bound yet says the one step left', async ($, on) => {
  const world = engine(on, () => CLEAN, { dir: '/home/t' })
  await $.session.start({ cwd: '/home/t', surface: 'terminal', isInteractive: true })
  expect(world.toasts).toEqual(['installed — run /unramble setup once to bind Ctrl+G'])
})

test('a session with Ctrl+G bound starts quietly', async ($, on) => {
  const keybindings = JSON.stringify({
    bindings: [
      { context: 'Global', bindings: { 'ctrl+g': 'app:cycleDiffBase' } },
      { context: 'Chat', bindings: { 'ctrl+g': null } },
    ],
  })
  const world = engine(on, () => CLEAN, { dir: '/home/t', keybindings })
  await $.session.start({ cwd: '/home/t', surface: 'terminal', isInteractive: true })
  expect(world.toasts).toEqual([])
})
