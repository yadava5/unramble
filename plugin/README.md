# unramble

Press Ctrl+G and the rambling prompt you just dictated becomes the one you meant to type, in
place, inside Claude Code, on the plan you already have. Ctrl+G again puts your original back.

- Privacy policy: https://github.com/yadava5/unramble/blob/main/PRIVACY.md
- Documentation: https://github.com/yadava5/unramble#readme
- Support and bug reports: https://github.com/yadava5/unramble/issues/new/choose
- Security reports (private): https://github.com/yadava5/unramble/security/advisories/new
- Source and license (MIT): https://github.com/yadava5/unramble

## What it is for

You talk faster than you type, so you dictate. Then Claude Code gets "uh no wait, not the
handler, the session middleware" and takes every word literally. unramble rewrites the draft
before you send it: fillers and false starts gone, the correction applied, separate asks
numbered, standing rules under *Constraints*. Same meaning: nothing added, nothing you said
lost. It never answers your question or does the task; it only tidies the prompt you are about
to send.

## Install

In a terminal (Node 18+), `npx unramble` installs the plugin and binds Ctrl+G in one step. Or,
inside Claude Code:

1. `/plugin install unramble --marketplace yadava5/unramble`
2. Then: `/unramble setup`. This binds Ctrl+G in your `keybindings.json`, keeps a backup of
   that file, and never overwrites a key you bound yourself.
3. Start a new session, say or type a prompt of three words or more, and press **Ctrl+G**.

| Key | Does |
|---|---|
| **Ctrl+G** | rewrite the draft (the band above the box says `refining…`) |
| **Ctrl+G** on the rewrite | put your original back, exactly |
| **Ctrl+G** while it runs | cancel; your draft stays |

## Examples

**1. A dictated request with a correction and a constraint.** A real rewrite (Sonnet on a
Claude Code plan, 3.3 s). Said:

> okay so um the login page is broken again I think, like when you hit submit it just spins
> forever. can you look at the auth handler, uh no wait, not the handler, the session
> middleware, that's what changed yesterday. and then once it works add a test for it so this
> doesn't happen again. oh and don't touch the database migrations, we're kind of mid deploy

Sent to Claude Code after Ctrl+G:

```text
The login page is broken again, I think: when you hit submit, it spins forever.

1. Look at the session middleware, which is what changed yesterday.
2. Once it works, add a test for it so this doesn't happen again.

Constraints:
- Don't touch the database migrations; we're mid deploy.
```

**2. A request with a pasted error log.** Say "so the build crashes with this", paste the
stack trace, then say "can you fix it". The log lines are swapped for a placeholder before the
model sees the draft, and the rewrite gets them back byte for byte: the model only reorganises
your words around the log.

**3. A path you corrected on the spot.** Say "move the helpers into src/utils, no wait,
src/lib". The rewrite may drop `src/utils`, because you corrected it, and must keep `src/lib`.
If a rewrite ever drops a path, `--flag`, number, URL or
`@ref` you meant to keep, it is refused and your draft stays as it was, with a toast saying
which value went missing.

**4. Changing your mind.** Press Ctrl+G on the rewrite and your exact original comes back,
fillers and all.

## What it does on your machine

- **Sends**: on Ctrl+G only, your draft, with pasted logs and code masked out, plus the rules
  in `prompt/system.md`, to the model through Claude Code's own session (`$.model.complete`),
  on your Claude Code plan. The plugin has no network code, no API key and no server of its
  own; nothing else leaves your machine.
- **Writes**
  - `keybindings.json` in your Claude Code config folder (`$CLAUDE_CONFIG_DIR`, else
    `~/.claude`), only when you run `/unramble setup`: it adds the two Ctrl+G bindings and
    keeps your original file beside it as `keybindings.json.unramble-backup`. It is a settings
    file, and that is the only file the plugin writes.
  - Your prompt box, only when you press Ctrl+G: the rewrite, or your original back.
- **Reads**: its own `prompt/system.md`; `keybindings.json` (to know whether Ctrl+G is bound);
  the environment variables `CLAUDE_CONFIG_DIR`, `HOME` and `USERPROFILE` to find that folder.
  As you edit, it sees the prompt box's text only to count words for the band and to remember
  what a paste chip stands for, and forgets both when you send. It never reads your
  conversation, history or project files.
- **Hooks**
  - `session.start`: registers `/unramble` and checks whether Ctrl+G is bound; if not, shows
    one toast saying to run `/unramble setup`.
  - `command.run` (`/unramble` only): runs `setup` or `status`. It sees no other command.
  - `prompt.edit`: notes whether the box holds a draft and what a paste chip stands for, so the
    band and the rewrite see your words. It changes nothing. A prompt recalled from history, or
    a box you cleared, reaches the band at your next key.
  - `prompt.submit`: forgets the draft once you send it. It never changes or blocks a prompt.
  - `ui.render` (above the prompt): draws the `⌃G refine` band.
- **Runs**: no commands and no processes. Adds one slash command, `/unramble`.
- **Refuses**: a rewrite that adds a link, a shell command or shell chaining you never said.
  Text pasted into the box can carry instructions, and the prompt goes to an agent that can
  run commands. On 2,240 recorded rewrites this refused none.

## Settings

`/config` (the unramble rows), or `claude plugin configure unramble`:

| Setting | Default | |
|---|---|---|
| Model | `sonnet` | `sonnet` (fast, light on your plan) or `opus` (the most faithful) |
| Names you often say | empty | comma-separated names of your tools and projects, so a dictation slip is spelled right |

## Troubleshooting

`/unramble status` shows the model and whether Ctrl+G is bound.

- **Ctrl+G opens an editor instead.** Ctrl+G is not bound yet: run `/unramble setup`, then
  start a new session.
- **No `⌃G refine` band above the box.** The band appears once the draft has three words. In
  a short window with a tall status line Claude Code may not draw it; Ctrl+G still works.
- **A toast says it kept your text.** The rewrite dropped or added a value (it names which),
  so your draft stayed. Press Ctrl+G again to retry, or send the draft as it is.
- **A long paste stays as `[Pasted text #N]`.** Claude Code folds long pastes into a chip that
  plugins cannot read, so that text is kept as is.
- **A toast says the model call failed.** It gives the reason: not signed in, usage limit
  reached, no connection, or a timeout. Your draft stays as it was.

It works in Claude Code's terminal interface (a terminal, or the one inside VS Code or
Cursor), on Claude Code 2.1.308 and later. The VS Code extension's chat panel and the desktop
app are not supported.
