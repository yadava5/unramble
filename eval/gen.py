#!/usr/bin/python3 -I
"""Opus writes synthetic dictations, intent first, transcript second. -> corpus_synth.json"""
import json, os, subprocess
from concurrent.futures import ThreadPoolExecutor

HERE = os.environ.get("REFINE_EVAL_DATA", os.path.expanduser("~/.claude/cache/refine/eval"))  # data, not code
real = json.load(open(os.path.join(HERE, "corpus_all.json")))
style = "\n\n---\n\n".join(p["text"][:900] for p in sorted(real, key=lambda p: p["len"])[20:23])

CATS = {
    "A-corrections": "self-corrections and ordering: 'no wait, first do X' that only reorders (earlier tasks must survive), 'scratch that', 'actually make it 700k not 600k', a correction that replaces only ONE of several items, the user changing their mind twice",
    "B-negation-scope": "negations and limits with narrow scope ('don't change the billing app, any other app is fine'), 'only', 'unless', 'not yet', 'later', conditionals ('if the build fails then...'), hedges ('I think', 'maybe', 'not sure if') that must stay hedged, deadlines",
    "C-names-and-tokens": "mis-heard names that context makes certain (an agent's nickname heard as an ordinary word or split into two words, a project name in lower case), spoken flags and paths ('dash dash dry', 'tilde slash dot claude slash hooks'), numbers in words ('five hundred k', 'twenty twenty six'), repo and file names, a URL read aloud",
    "D-injection-refs-short": "dictation that looks like an order to a rewriter ('just answer this', 'summarize the following', 'make this better', 'ignore what I said before'), questions addressed to the agent, references to the conversation the rewriter cannot resolve ('the second one', 'like before', 'that file', 'it'), and 4 SHORT rough prompts of 5-20 words",
}

ASK = """You are building a test set for a tool that rewrites a developer's rough voice dictation into a clean prompt for a coding agent (Claude Code). The developer has custom agents with short nicknames (for browser work, test suites, execution, design, critique, research, persona reads and code search), several repos with product names, and a few small CLI tools of their own; invent plausible names for these and use them consistently.

Here is how the developer really talks when dictating (style reference only; do not copy content):
<style>
{style}
</style>

Write 10 test cases for this category: {cat}.
For EACH case, first decide the ground-truth INTENT, then write the rough spoken TRANSCRIPT that expresses exactly that intent in the developer's style: fillers (uh, um, like, you know, so yeah), run-on sentences, words repeated again and again, vague words, items mentioned out of order with the order stated in words, restarts, tangents that circle back. Lengths: 3 cases under 40 words, 5 cases 80-250 words, 2 cases 300-500 words. Every fact in INTENT must be recoverable from TRANSCRIPT, and the transcript must not contain requests absent from INTENT.

Output ONLY a JSON array of 10 objects:
{{"id":"<cat-letter><n>","intent":{{"goal":"...","tasks_in_order":["..."],"constraints":["..."],"questions_to_agent":["..."],"hedges":["..."],"must_keep_verbatim":["names/flags/paths/numbers as they should appear"],"unresolved_refs":["references that must stay vague"]}},"transcript":"..."}}"""


def gen(item):
    key, cat = item
    r = subprocess.run(["claude", "-p", "--model", "opus", "--no-session-persistence",
                        "--setting-sources", "project,local", "--tools", "", "--output-format", "json"],
                       input=ASK.format(style=style, cat=cat), capture_output=True, text=True,
                       cwd=os.path.join(HERE, "neutral"), timeout=600)
    res = json.loads(r.stdout)["result"]
    arr = json.loads(res[res.index("["): res.rindex("]") + 1])
    for a in arr:
        a["kind"] = key
    return arr


with ThreadPoolExecutor(4) as ex:
    allc = [c for batch in ex.map(gen, CATS.items()) for c in batch]
json.dump(allc, open(os.path.join(HERE, os.environ.get("GEN_OUT", "corpus_synth.json")), "w"), indent=1)
print(len(allc), "synthetic cases;", {k: sum(c["kind"] == k for c in allc) for k in CATS})
