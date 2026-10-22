# Privacy

unramble collects nothing. It has no server, no analytics, no telemetry and no account. The
maintainer never sees your prompts, your settings or that you installed it.

## What leaves your machine, and only when you press Ctrl+G

Your draft and the rewrite rules go to Anthropic through Claude Code's own model client,
under the login Claude Code already uses. It is the same path as any prompt you send, and
[Anthropic's privacy policy](https://www.anthropic.com/legal/privacy) covers it. The plugin
itself has no network code and no API key.

Lines it recognises as a pasted log or code are swapped for a placeholder before the request
and put back after, so they do not reach the model.
Nothing is sent while you type; the band above the prompt is drawn on your machine.

## What stays on your machine

- `keybindings.json` in your Claude Code config folder, written only by `/unramble setup` or
  `npx unramble install`, with a backup of your original beside it.
- Your settings (model and vocabulary), which Claude Code stores.
- The current draft and rewrite, held in the session's memory and dropped when you send.

## The installer and the website

`npx unramble` downloads the package from npm, then runs your own `claude` command, which
fetches the plugin from GitHub. The install page at https://yadava5.github.io/unramble/ is a
static GitHub Pages site with no scripts from anyone else, no cookies and no analytics; GitHub
serves it and keeps its usual server logs.

## Questions

Open an issue, or report a concern privately through
[GitHub's private vulnerability reporting](https://github.com/yadava5/unramble/security/advisories/new).
