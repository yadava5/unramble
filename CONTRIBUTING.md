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
npm test                    # validate + plugin tests + installer tests
npx -p typescript tsc -p .  # type-check (after one --plugin-dir load)
```

CI runs the same on the pinned Claude Code version and, as a non-blocking canary, on the
latest release: the plugin API is early access and can move.

## Changing the rules

`prompt/system.md` decides every rewrite. A change there needs numbers: run
[`eval/`](eval/README.md) on a corpus before and after, twice per case, and put both scores
in the pull request. Personal names never go in the rules; they belong in the `vocabulary`
setting (CI fails if the rules hard-code a name list).

## Style

Prettier defaults (2 spaces, single quotes, no semicolons). Conventional commit subjects:
`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`.
