# Changelog

## Unreleased

- The band follows the box through `prompt.edit` alone; the `prompt.change` hook is gone, as
  Anthropic's plugin directory does not list that event yet. A prompt recalled from history,
  or a box you cleared, reaches the band at your next key.
- A privacy policy, [PRIVACY.md](PRIVACY.md), linked from the plugin's README.
- The plugin moves into [`plugin/`](plugin/), so Claude Code installs only the plugin, not the
  installer, docs, eval kit or video tooling. The marketplace entry points there; installing and
  updating work as before. `plugin/README.md` is the plugin's own README, with examples and
  troubleshooting.
- The guard fails on any file in `plugin/` that is not on its list.

## 1.0.1 — 2026-10-22

Security hardening after an independent review.

- A rewrite that adds a link, a download-or-run command (`curl`, `wget`, `sudo`, `rm -…`),
  shell chaining or invisible characters that you did not say is refused. Text pasted into
  the box can carry instructions, and the prompt goes to an agent with a shell. Spoken forms
  count as said. On 2,240 recorded rewrites it refused none.
- A `</transcript>` inside your draft can no longer end the model's transcript early.
- Installer: runs `claude` from your home folder, so a `claude.cmd` in the current folder is
  never picked up on Windows; refuses a marketplace override that could reach the shell; keeps
  your original `keybindings.json` backup instead of replacing it on a reinstall.
- `/unramble setup` refuses to write when it cannot find an absolute config folder; the model
  setting accepts only `sonnet` or `opus` (always the newest of that family).
- A session where Ctrl+G is not bound yet says so once: run `/unramble setup`.
- `npx unramble update` pulls the newest version.
- CI tests the oldest supported Claude Code (2.1.308) and the newest release, both required,
  on Linux, macOS and Windows, every day.
- Repository: a guard in CI fails any change that widens what the shipped code can reach;
  actions pinned to commits; zizmor, dependency review and CodeQL; releases publish only from
  a maintainer-approved tag on `main`.

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
