# Privacy

unramble collects nothing. It has no server, no analytics, no telemetry and no account. The
maintainer never sees your prompts, your settings or that you installed it.

## What leaves your machine, and only when you press Ctrl+G

- **Engine `plan` (the default):** your draft and the rewrite rules go to Anthropic through
  Claude Code's own model client, under the login Claude Code already uses. It is the same
  path as any prompt you send, and [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy)
  covers it.
- **Engine `api` (opt-in):** the same request goes to `https://api.anthropic.com/v1/messages`
  with the API key you saved, plus a model-list request to
  `https://api.anthropic.com/v1/models?limit=100` at most once a day. Anthropic's policy for
  API use applies. [API-KEY.md](docs/API-KEY.md) has the details.

Lines it recognises as a pasted log or code are swapped for a placeholder before the request
and put back after, so they do not reach the model.
Nothing is sent while you type; the band above the prompt is drawn on your machine.

## What stays on your machine

- `keybindings.json` in your Claude Code config folder, written only by `/unramble setup` or
  `npx unramble install`, with a backup of your original beside it.
- Your settings (engine, model, vocabulary, API key), which Claude Code stores; the key goes to
  its secure storage.
- The current draft and rewrite, held in the session's memory and dropped when you send.

## The installer and the website

`npx unramble` downloads the package from npm, then runs your own `claude` command, which
fetches the plugin from GitHub. The install page at https://yadava5.github.io/unramble/ is a
static GitHub Pages site with no scripts from anyone else, no cookies and no analytics; GitHub
serves it and keeps its usual server logs.

## Questions

Open an issue, or report a concern privately through
[GitHub's private vulnerability reporting](https://github.com/yadava5/unramble/security/advisories/new).
