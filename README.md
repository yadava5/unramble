<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/wordmark-dark.svg">
    <img src="assets/wordmark.svg" alt="unramble" width="360">
  </picture>
</p>

<p align="center"><b>Press Ctrl+G and the rambling prompt you just dictated becomes the one you meant to type — in place, inside Claude Code, on the plan you already have.</b></p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#what-it-does">What it does</a> ·
  <a href="#plan-or-api-key">Plan or API key</a> ·
  <a href="docs/BENCHMARKS.md">Benchmarks</a> ·
  <a href="docs/HOW-IT-WORKS.md">How it works</a>
</p>

<p align="center">
  <a href="https://github.com/yadava5/unramble/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/yadava5/unramble/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <img alt="Claude Code plugin" src="https://img.shields.io/badge/Claude%20Code-plugin-d97757">
  <img alt="No API key needed" src="https://img.shields.io/badge/API%20key-not%20needed-2ea44f">
</p>

<p align="center">
  <img src="assets/demo.gif" alt="A rough dictated prompt is typed into Claude Code, Ctrl+G is pressed, the band reads refining…, and three seconds later the box holds a clean numbered prompt" width="820">
</p>

You talk faster than you type, so you dictate. Then Claude Code gets *"uh no wait, not the
handler, the session middleware"* and takes every word literally. unramble rewrites the draft
before you send it: fillers and false starts gone, the correction applied, separate asks
numbered, standing rules under *Constraints*. Same meaning — nothing added, nothing you said
lost. Ctrl+G again puts your original back.

## Install

Pick one. Both install the same plugin and bind Ctrl+G.

**A. In your terminal** (zsh, bash, PowerShell — not inside Claude Code; needs Node 18+):

```sh
npx github:yadava5/unramble
```

**B. Inside Claude Code** — start `claude`, then type these at its `❯` prompt, one at a time:

```text
/plugin install unramble --marketplace yadava5/unramble
/unramble setup
```

Answer `y` to add the marketplace and pick a scope (user is the default). `setup` binds Ctrl+G;
it keeps a backup of your `keybindings.json` and never overwrites a key you bound yourself.

Then quit Claude Code and start a new session (`claude`), say or type a prompt, and press
**Ctrl+G**. Built and tested on Claude Code **2.1.308**; see
[Where it is tested](#where-it-is-tested).

## What it does

The demo above is a real rewrite (Sonnet on a Claude Code plan, 3.3 s). What was said:

> okay so um the login page is broken again I think, like when you hit submit it just spins
> forever. can you look at the auth handler, uh no wait, not the handler, the session
> middleware, that's what changed yesterday. and then once it works add a test for it so this
> doesn't happen again. oh and don't touch the database migrations, we're kind of mid deploy

What Claude Code gets:

```text
The login page is broken again, I think: when you hit submit, it spins forever.

1. Look at the session middleware, which is what changed yesterday.
2. Once it works, add a test for it so this doesn't happen again.

Constraints:
- Don't touch the database migrations; we're mid deploy.
```

(It is not perfect: "kind of" mid deploy lost its hedge. The [benchmarks](docs/BENCHMARKS.md)
count that as a minor defect.)

| Key | Does |
|---|---|
| **Ctrl+G** | rewrite the draft (the band above the box says `refining…`) |
| **Ctrl+G** on the rewrite | put your original back, exactly |
| **Ctrl+G** while it runs | cancel; your draft stays |

### What it will not do

- **Send anything you did not ask it to.** Nothing leaves the box until you press Ctrl+G.
- **Lose a machine value.** A rewrite that drops a path, `--flag`, number, URL, `@ref` or
  `[Pasted text]` chip is refused and your draft stays — unless you corrected that value on
  the spot ("src/utils, no wait, src/lib").
- **Touch pasted logs or code.** They are masked before the model sees the draft and put back
  byte for byte.
- **Answer your question or do the task.** "Can you check X?" stays a question for Claude Code.
- **Overwrite you.** If you typed while it ran, your text wins.

## Plan or API key

| Engine | Pays with | Setup | Default |
|---|---|---|---|
| `plan` | your Claude Code subscription, like any prompt | none | ✓ |
| `api` | your own Anthropic API key, per rewrite | [a separate opt-in step](docs/API-KEY.md) | |

The plan engine calls the model through your Claude Code session's own login
(`$.model.complete`), so there is no key anywhere in the plugin. Each rewrite is one short
call: ~3k tokens of rules (cached after the first rewrite) plus your words.

The API engine exists for people who would rather pay a fraction of a cent per rewrite than
spend plan usage. It stays off until you switch it on, the key lives in Claude Code's secure
storage, and a failed API call never falls back to your plan. Read
[docs/API-KEY.md](docs/API-KEY.md) — and the ~100 lines of
[`hooks/engine.ts`](hooks/engine.ts) — before you paste a key in.

## Settings

`/config` (the unramble rows), or `claude plugin configure unramble`:

| Setting | Default | |
|---|---|---|
| Engine | `plan` | `plan` or `api` |
| Model | `sonnet` | `sonnet` (fast, light on your plan) or `opus` (the most faithful) |
| Names you often say | empty | comma-separated names of your tools, agents and projects, so a dictation slip is spelled right |
| Anthropic API key | empty | read only when Engine is `api` |

`/unramble status` shows what is live.

## How good is it

Measured on 39 of the hardest real dictated prompts, two runs each, with Claude Opus judging
every rewrite against a fixed rubric ([method and full tables](docs/BENCHMARKS.md)):

| Model | Rewrites with no meaning change | Median time |
|---|---|---|
| Sonnet (default) | 76/78 | 3.0 s |
| Opus | 78/78 | 3.2 s |

That set is every case that ever failed during tuning, so it is harder than everyday speech.
It is also one person's speech, in English, about software; the [eval kit](eval/README.md)
runs the same check on yours. Haiku was tried and dropped (9 major errors in 17 prompts).

## Where it is tested

Ctrl+G reaches the plugin as whatever bytes the terminal sends for it, and terminals send it
two ways, so both were tried with a real keypress:

| Where | Ctrl+G arrives as | Result |
|---|---|---|
| kitty, macOS | kitty keyboard protocol | rewrite, restore, cancel, `/unramble status` ✓ |
| Terminal.app, macOS | legacy `0x07` | rewrite and restore ✓ |
| Ghostty 1.3, macOS | not measured | rewrite and restore ✓ |
| VS Code terminal, macOS | not measured | rewrite and restore ✓ (Ctrl+G reaches Claude Code, not VS Code's *Go to Line*) |
| Cursor terminal, macOS | not measured | rewrite and restore ✓ |
| Linux (Debian, tmux) | legacy `0x07` | key reaches the plugin and the model call goes out ✓ |
| Windows, Linux, macOS (CI) | — | install, Ctrl+G binding, uninstall and all tests, every push |

Not yet tried by hand: iTerm2, Windows Terminal, and Kiro's terminal (Kiro is built on the same
editor as VS Code and Cursor). If one does not work, please
[open an issue](https://github.com/yadava5/unramble/issues/new/choose).

## Limits

- **Terminal UI only.** The Ctrl+G chord reaches plugins in Claude Code's terminal interface
  (`claude` run in a terminal, including the one inside VS Code or Cursor). The VS Code
  extension's own chat panel and the desktop app are not supported.
- **A short window can hide the band.** In an 80×24 window with a tall status line, Claude Code
  may not draw the `⌃G refine` row; Ctrl+G still works.
- **Long pastes stay as chips.** When a dictation app pastes a long block, Claude Code folds it
  into a `[Pasted text #N]` chip that plugins cannot read in 2.1.308, so that text is kept as
  is. Claude Code's built-in voice input, macOS Dictation and typing all work fully.
- **Garbled speech stays garbled.** If the transcription is wrong in a way context cannot fix
  ("Apple ID" for a project name), the rewrite keeps it as heard rather than guess. Add the
  name to *Names you often say*.
- **The plugin API is early access.** CI runs the latest Claude Code weekly to catch a release
  that moves it.

## Uninstall

```sh
npx github:yadava5/unramble uninstall
```

That removes the plugin and takes back only the two `ctrl+g` bindings setup added. Without
Node: `claude plugin uninstall unramble@unramble`, then delete those two lines from
`keybindings.json` yourself.

## Where it came from

I dictate long prompts into Claude Code and wanted them organised before the model reads
them. It started as a personal `$VISUAL` script on 2026-10-17 and went through eight rule
versions in two days, each measured before it shipped; the history is in the git log and
[docs/BENCHMARKS.md](docs/BENCHMARKS.md). This public version is a rebuild that runs on your
plan instead of an API key. I used Claude Code to build it.

## Contributing

Reports of a rewrite that changed your meaning are the most useful thing you can send; there
is an [issue template](https://github.com/yadava5/unramble/issues/new/choose) for it. See
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2026 Ayush Yadav
