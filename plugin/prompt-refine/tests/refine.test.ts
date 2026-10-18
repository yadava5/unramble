import { expect, test } from 'claude-code/testing'

import { lastLine, wordCount } from '../hooks/register.tsx'

test('the band shows only from three words', () => {
  expect(wordCount('')).toBe(0)
  expect(wordCount('  fix it  ')).toBe(2)
  expect(wordCount('uh run the tests')).toBe(4)
})

test('the toast is the script’s last stderr line, without its prefix', () => {
  const stderr = 'refine: rewriting with sonnet via API credit…\nrefine: done in 1.1s via API credit (original in x)\n'
  expect(lastLine(stderr)).toBe('done in 1.1s via API credit (original in x)')
  expect(lastLine('')).toBe('')
})
