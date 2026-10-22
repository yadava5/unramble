# Using your own API key (optional)

The default engine is **your Claude Code plan**: no key, nothing to trust beyond Claude Code
itself. Use an API key only if you would rather pay per rewrite than spend plan usage, for
example on a plan close to its weekly limit. With Sonnet, a typical rewrite is about half a
cent once the rules are cached (≈3k cached tokens of rules, a few hundred of your words, a few
hundred out, at Sonnet's list price).

## Turn it on

Both settings live in Claude Code's own plugin configuration. The key field is marked
`sensitive`, so Claude Code keeps it in its secure storage rather than in `settings.json`.

```sh
claude plugin configure unramble
```

Set **Engine** to `api` and paste the key into **Anthropic API key**. Or in a session:
`/config`, then the unramble rows. `/unramble status` confirms which engine is live.

## What the plugin does with it

- Reads it only when Engine is `api`. With Engine on `plan`, a saved key is never used.
- Sends it only as the `x-api-key` header to `https://api.anthropic.com`, through Claude Code's
  own network layer (`$.http.fetch`), once to list models (cached a day) and once per rewrite.
- Never writes it anywhere, never puts it in the environment, never logs it.
- If the API call fails (bad key, no credit, network), your draft stays as it was and a toast
  says why. It does **not** fall back to your plan.

That is all of it: [`hooks/engine.ts`](../hooks/engine.ts) is about 100 lines. Read it before
you paste a key into anything, this included.

## Turn it off

Set Engine back to `plan`, and clear the key field if you want it gone from secure storage.
