# Benchmarks

How faithful is a rewrite? This page is the measurement behind the rules in
[`plugin/prompt/system.md`](../plugin/prompt/system.md) and the choice of default model. Every number
below was recomputed from the run files on 2026-10-22; where a figure comes only from a
commit message (no run file kept), it says so.

## The question being measured

A rewrite fails if Claude Code would **act or believe differently** after reading it:
a request dropped, a detail added, a "don't" weakened, a cancelled idea kept, a question
answered instead of passed on. That is a *major* defect. Noise that would not change what
the agent does (a hedge lost, a word swapped) is *minor*. The headline score is
**major-free rewrites out of all rewrites**.

## Method

- **Rewrite**: the rules plus a transcript in `<transcript>` tags, as the plugin sends them,
  one call per case. Pasted logs are masked as `[[paste N]]` first, exactly as the plugin does
  (`hooks/refine.ts`, ported from the original Python and checked identical on all 237 corpus
  texts).
- **Judge**: Claude Opus with a fixed rubric ([`eval/rubric.md`](../eval/rubric.md)) that lists
  every defect as `dropped | added | changed | answered | residue`, each `major` or `minor`.
  Cases written with a known intent give the judge that intent as ground truth.
- **Judge check**: before trusting it, the judge was handed rewrites with errors planted on
  purpose; it caught 7 of 7 (commit message of the first version; the planted set was not kept).
- Every case runs **twice** (sampling varies), so a set of 39 cases scores out of 78.

## The sets

| Set | Cases × runs | What is in it |
|---|---|---|
| Original | 190 | 40 long and 30 short real dictated prompts, 40 synthetic ×2, 40 holdout written after tuning |
| Hard | 39 × 2 | every case that ever failed in any round, plus long and short controls |
| Corrections | 40 × 2 | self-corrections: "no wait", "scratch that", "yeah no", rejected options |
| Correction holdout | 20 × 2 | the same kinds, written by a prompt that never saw the rules |

The real prompts are the author's own Claude Code dictation from 2026, so they are not
published; the harness and rubric are, so you can run the same check on your own speech.

## Results

Hard set, the one that separates versions (39 cases × 2):

| Rules | Model | Major-free | Rows with only minor defects |
|---|---|---|---|
| v5 | Sonnet | 69/78 | 22 |
| v6 | Sonnet | 70/78 | 22 |
| v5 | Opus | 74/78 | 21 |
| v7 | Opus, low effort | 74/78 | 17 |
| v7 | Opus | 77/78 | 17 |
| v8 | Opus | 77/78 | 18 |
| **public (this repo)** | **Sonnet** | **76/78** | 25 |
| **public (this repo)** | **Opus** | **78/78** | 18 |

The public rules are v8 with the author's personal name list moved out into the
`vocabulary` setting (for this run it was supplied there, as a user would). Sonnet at 76/78
against v6 Sonnet's 70/78 is a real gain; Opus at 78/78 against v8's 77/78 is one case and
should be read as "the same". Median rewrite time on this set: 3.0 s (Sonnet), 3.2 s (Opus),
measured on the API; 90% finished within about 13 s, and those are the longest dictations.
Cost of the two public rounds, rewrites and judging together: $2.84.

The two Sonnet failures, each on one of its two runs:

- a garbled phrase ("both one") that most likely meant one person was applied to both;
- "engineered/developed" offered as examples of strong verbs came out as verbs to avoid.

Both are long dictations where the speech itself is ambiguous; keeping it as heard is the
ceiling there, which is why the rules say to.

Other sets:

| Set | Rules / model | Major-free |
|---|---|---|
| Original 190 | v1, Sonnet, first prompt (150 cases then) | 143/150 |
| Original 190 | v1 tuned, Sonnet | 187/190, holdout 40/40 |
| Original 190 | v1 tuned, Sonnet, rerun on the API | 184/190, holdout 38/40 |
| Original 190 | v5, Sonnet | 181/190, holdout 38/40 (reruns of the failures show sampling variance) |
| Corrections 80 | v1 → v5, Sonnet | 77/80 and 76/80 (two runs) → 80/80 |
| Corrections 80 | v8, Opus | 80/80, 1 row with a minor defect |
| Correction holdout 40 | v8, Opus | 40/40 |
| Easy 30 (random real prompts) | v7, Opus | 30/30 |

**Haiku was tried first and rejected**: 9 major meaning errors in 17 real prompts (commit
message; the run was not kept). That is why the model setting offers Sonnet and Opus only.

A blind side-by-side judgement of v7 Opus against v5 Sonnet, on cases both got right,
preferred v7 Opus 30 to 14, with 9 ties.

## In daily use

The author ran the predecessor of this plugin for five days (2026-10-18 to 10-22). Of 20
rewrites captured: 10 were sent exactly as rewritten; 8 were edited before sending (6 of them
92–100% similar to the rewrite, usually one sentence added; one more only looks edited
because a paste was expanded on send); 1 has no record of what was sent; 1 was refused by the
guard for dropping a number the speaker had corrected; none was swapped back to the original.
That is one person, so it says the tool is usable, not that it is good for everyone.

## What these numbers do not say

- The judge is a model. It agreed with planted errors, but it can miss a subtle change or
  flag a harmless one.
- The hard set is one person's speech, in English, about software work.
- 78 rewrites per row is small: a difference of one or two is noise.
- Times are API times. On the plan (`$.model.complete`) a rewrite of the demo prompt took
  3.3 s; plan latency was not benchmarked separately.

## Reproduce it

See [`eval/README.md`](../eval/README.md).
