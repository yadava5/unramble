# Security

## What unramble can touch

It is a Claude Code plugin, so it runs with Claude Code's permissions on your machine. What it
actually uses (from `claude plugin validate .`, which reads the module the way the engine does):

- **Prompt box**: sends the draft and fills the rewrite only when you press Ctrl+G. As you edit,
  it sees the text only to count words for the band and to remember what a paste chip stands
  for, and forgets both when you send.
- **Model**: `$.model.complete` on your own session, or the Anthropic API if you opted in.
- **Network**: `https://api.anthropic.com` only, and only on the opt-in API engine.
- **Files**: reads its own `prompt/system.md`; reads and, on `/unramble setup`, writes
  `keybindings.json` in your Claude Code config folder (with a `.unramble-backup` beside it).
- **Environment**: reads `CLAUDE_CONFIG_DIR`, `HOME` and `USERPROFILE` to find that folder.

The npm package is only the installer: `cli/unramble.mjs` and the keybinding merge it shares
with the plugin. It has no dependencies and no install scripts, and the only program it runs
is `claude`.

No telemetry, no logs of your prompts, nothing stored after a prompt is sent.

## What a rewrite may not do

A rewrite replaces your draft only if it passes two checks in [`plugin/hooks/refine.ts`](plugin/hooks/refine.ts):

- **Nothing lost**: every path, flag, number, URL, `@`-reference and paste chip you said is
  still there (unless you corrected it on the spot).
- **Nothing risky added**: no link, download-or-run command (`curl`, `wget`, `sudo`, `rm -…`
  and similar), shell chaining (`&&`, `| sh`, `$(…)`) or invisible character that you did not
  say yourself. This matters because text you paste into the box can carry instructions, and
  the prompt you send goes to an agent that can run commands. Spoken forms count as said: "rm
  dash r f" vouches for `rm -rf`. On 2,240 recorded rewrites this check refused none.

## How changes are kept honest

Anyone can propose a change; only the maintainer can merge one or publish a release.

- `main` accepts changes only through a pull request that passes CI and is approved by the
  code owner. Force pushes and deletion are blocked.
- Release tags (`v*`) can be created only by the maintainer. Publishing to npm runs only from
  a tag on `main`, after the tests pass, and only once the maintainer approves the `npm`
  environment. It uses npm trusted publishing: there is no npm token to steal, and every
  release carries a provenance statement (`npm audit signatures`).
- Every pull request runs [`scripts/guard.mjs`](scripts/guard.mjs), which fails on anything that
  widens what the shipped code can reach: a new network host, process, engine capability,
  dependency or install script, hidden or direction-changing Unicode (including the tag
  characters that can hide instructions from a reviewer), a binary outside `assets/`, any file
  in `plugin/` (what Claude Code installs) that is not on its list, or a GitHub Action not
  pinned to a commit. Each rule has a test that makes it fire.
- [zizmor](https://docs.zizmor.sh) audits the workflows, GitHub's dependency review blocks known
  vulnerable dependencies, and CodeQL scans the code.
- A first-time contributor's CI run waits for the maintainer's approval, and runs from forks
  get a read-only token and no secrets.

The guard is a tripwire, not a sandbox: review of every change to `plugin/`, `cli/`, `scripts/`
and `.github/` is the real gate, and CODEOWNERS makes that review mandatory.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting on this
repository (**Security → Report a vulnerability**). You will get a reply within a few days.
