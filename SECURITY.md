# Security

## What unramble can touch

It is a Claude Code plugin, so it runs with Claude Code's permissions on your machine. What it
actually uses (from `claude plugin validate .`, which reads the module the way the engine does):

- **Prompt box**: reads the draft and fills the rewrite, only when you press Ctrl+G.
- **Model**: `$.model.complete` on your own session, or the Anthropic API if you opted in.
- **Network**: `https://api.anthropic.com` only, and only on the opt-in API engine.
- **Files**: reads its own `prompt/system.md`; reads and, on `/unramble setup`, writes
  `keybindings.json` in your Claude Code config folder (with a `.unramble-backup` beside it).
- **Environment**: reads `CLAUDE_CONFIG_DIR`, `HOME` and `USERPROFILE` to find that folder.

No telemetry, no logs of your prompts, nothing stored after a prompt is sent.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting on this
repository (Security → Report a vulnerability).
