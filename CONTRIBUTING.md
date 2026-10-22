# Contributing

Bug reports and rewrites that went wrong are the most useful contributions; there is an issue
template for each.

## Develop

```sh
git clone https://github.com/yadava5/unramble && cd unramble
claude --plugin-dir .        # loads the plugin from this folder, reloading on save
```

Your installed copy, if any, also loads; disable it for the session with
`--settings '{"enabledPlugins":{"unramble@unramble":false}}'`.

Loading it once also writes the engine's type declarations into `.claude-plugin/types/`
(git-ignored), which `tsconfig.json` reads.

## Check

```sh
npm test                    # guard + validate + plugin tests + installer and guard tests
npx -p typescript tsc -p .  # type-check (after one --plugin-dir load)
```

CI runs the same on the pinned Claude Code version and, as a non-blocking canary, on the
latest release: the plugin API is early access and can move.

## How a change lands

1. Fork the repository, make a branch, and open a pull request against `main`.
2. CI runs the tests on Linux, macOS and Windows, plus the security checks: the guard, a
   workflow audit and dependency review. A first-time contributor's run starts once the
   maintainer approves it.
3. The maintainer reviews and merges. `main` takes changes only this way.

`scripts/guard.mjs` fails on anything that widens what the shipped code can reach: a network
host, a process, an engine capability (`$.noun`), a dependency or install script, invisible
Unicode, a binary outside `assets/`, an action not pinned to a commit. If your change really
needs one, widen the rule in the same pull request and say why; that line gets the closest
review. `npm run guard` runs it locally.

## Releasing (maintainer)

The plugin ships from `main`; npm carries only the installer (`cli/unramble.mjs` and the
keybinding merge it shares with the plugin).

1. Bump `version` in `package.json` and `.claude-plugin/plugin.json`, and add a CHANGELOG entry.
2. Tag the merged commit on `main` and push the tag: `git tag v1.2.3 && git push origin v1.2.3`.
3. `.github/workflows/release.yml` checks the tag is on `main` and matches both versions, runs
   every test, then waits for approval of the `npm` environment. Approving it publishes through
   trusted publishing, with provenance. No npm token exists anywhere.

## Changing the rules

`prompt/system.md` decides every rewrite. A change there needs numbers: run
[`eval/`](eval/README.md) on a corpus before and after, twice per case, and put both scores
in the pull request. Personal names never go in the rules; they belong in the `vocabulary`
setting (CI fails if the rules hard-code a name list).

## Style

Prettier defaults (2 spaces, single quotes, no semicolons). Conventional commit subjects:
`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`.
