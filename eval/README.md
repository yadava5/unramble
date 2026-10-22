# Measuring a rewrite

The numbers in [`docs/BENCHMARKS.md`](../docs/BENCHMARKS.md) come from this protocol. Run it on
your own dictation before you trust the rules with it, or to check a change to
[`prompt/system.md`](../prompt/system.md).

1. Write a corpus, one JSON object per line. Real prompts you have said are the useful part;
   add `intent` when the speech is ambiguous and you know what you meant.

   ```json
   {"id": "flaky-test", "src": "uh can you rerun the flaky test, no wait, just tell me which one it is"}
   {"id": "pinned", "src": "bump everything except react, we're pinned on that", "intent": "upgrade all deps but react"}
   ```

2. Run it (Node 22.18+, Claude Code logged in; each case costs a rewrite and a judgement on
   your plan):

   ```sh
   node eval/run.mjs my-corpus.jsonl --model sonnet --runs 2
   ```

3. Read the ✗ rows in `eval-results.jsonl`. The score is **major-free rewrites / all
   rewrites**; [`rubric.md`](rubric.md) is the judge's whole instruction.

Two habits that kept the original numbers honest: run every case at least twice (one
failure in two runs is a real failure), and keep a holdout written *after* you change the
rules, so you are not grading the rules on the cases they were tuned on.
