# Changelog

## 1.0.0 — 2026-10-22

First public release.

- Ctrl+G rewrites the prompt box in place; Ctrl+G again restores the original; Ctrl+G while it
  runs cancels.
- Runs on your Claude Code plan through the session's own login (`$.model.complete`); no key.
- Optional API-key engine, off by default, key kept in Claude Code's secure storage.
- `vocabulary` setting for names you say often.
- Guard: a rewrite that drops a path, flag, number, URL or paste chip is refused; pasted logs
  are masked and restored byte for byte.
- `/unramble setup` and `npx unramble` bind Ctrl+G without overwriting your
  own bindings; `uninstall` takes back only what setup added.
- Rules measured at 76/78 (Sonnet) and 78/78 (Opus) major-free on the hard set; see
  [docs/BENCHMARKS.md](docs/BENCHMARKS.md).

Before this, unramble was a personal tool (a `$VISUAL` script, then an in-place plugin on an
API key), built and measured 2026-10-17 and 10-18; the git history keeps that path.
