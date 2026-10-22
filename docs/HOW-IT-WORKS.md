# How it works

unramble is a Claude Code plugin of function hooks: one TypeScript module the engine loads,
no build step, no runtime dependencies, nothing running outside Claude Code.

```mermaid
sequenceDiagram
    autonumber
    actor You
    participant Box as Prompt box
    participant U as unramble (hooks/register.tsx)
    participant T as hooks/refine.ts
    participant M as Claude (your session's login)

    You->>Box: speak or type a rough prompt
    Box-->>U: prompt.edit (3+ words: band shows "⌃G refine")
    You->>U: Ctrl+G
    U->>Box: $.prompt.read()
    U->>T: mask pasted logs as [[paste N]]
    U->>M: $.model.complete(rules + vocabulary, cached; transcript)
    M-->>U: rewrite
    U->>T: unwrap, restore pastes, guard paths/flags/numbers/URLs
    alt passes and the box is unchanged
        U->>Box: $.prompt.fill(rewrite) — band shows "⌃G original"
    else fails, or you typed meanwhile
        U-->>You: toast says why; your text stays
    end
```

## The pieces

| File | Job |
|---|---|
| [`plugin/hooks/register.tsx`](../plugin/hooks/register.tsx) | The band above the prompt, Ctrl+G, restore and cancel, `/unramble setup` and `status`, and the two ways to reach a model: `plan` (`$.model.complete`) and opt-in `api` (`$.http.fetch`) |
| [`plugin/hooks/refine.ts`](../plugin/hooks/refine.ts) | Pure text work: skip rules, paste masking, the value guard, tag unwrapping. No `$`, fully unit-tested |
| [`plugin/hooks/keybindings.js`](../plugin/hooks/keybindings.js) | Binding Ctrl+G safely; shared by the plugin and the `npx` installer |
| [`plugin/prompt/system.md`](../plugin/prompt/system.md) | The rewrite rules, read once per session |
| [`cli/unramble.mjs`](../cli/unramble.mjs) | `npx` installer: plugin install plus key binding, and uninstall |

## Why Ctrl+G needs a keybinding

A plugin cannot claim a raw key. It can draw a Button that names an engine keybinding action,
and the person's chord for that action presses it while the prompt is focused, as long as no
engine handler of the action is mounted. unramble names `app:cycleDiffBase`, which only the
diff panel handles, so setup binds Global `ctrl+g` to it and unbinds Chat `ctrl+g` (which
otherwise opens the external editor; `ctrl+x ctrl+e` keeps doing that). While the diff panel is
open, Ctrl+G goes to the diff panel, as before.

Setup never overwrites a chord you bound to something else, keeps a backup of
`keybindings.json`, and is a no-op the second time.

## The guarantees, and where each is enforced

| Guarantee | Where |
|---|---|
| Nothing is sent until you press Ctrl+G | the only model call is in `refine()`, reached from the Button |
| Paths, `--flags`, numbers of two or more digits, URLs, `@refs` and `[Pasted text]` chips survive, unless you corrected them on the spot | `missingValues()` |
| Pasted logs and code never reach the model and come back byte for byte | `mask()` / `unmask()` |
| A rewrite never lands over text you typed while it ran | the second `$.prompt.read()` in `refine()` |
| Ctrl+G again restores the original exactly | `original` state |
| On `api`, a failure never moves onto your plan | `viaApi()` returns, it does not fall back |

## The plan path

`$.model.complete` runs one completion "through the session's own API client and
credentials": the same login Claude Code uses for your prompts, so a rewrite counts against
your plan like a short prompt would. No key exists anywhere in the plugin. The rules (~3k
tokens) are sent as a cached system block, so a second rewrite inside the cache window reads
them instead of paying for them again.

## The API path

Off by default, and deliberately a separate step: see [API-KEY.md](API-KEY.md).
