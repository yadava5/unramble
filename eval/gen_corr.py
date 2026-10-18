#!/usr/bin/python3 -I
"""Holdout for the self-correction rules, written by Opus on the API credit (never the plan),
by a prompt that never saw system.md or corpus_corr.json. -> corpus_corr_holdout.json"""
import json, os, sys
from concurrent.futures import ThreadPoolExecutor
sys.argv = ["stress.py", "x"]
os.environ["STRESS_ENGINE"] = "api"
import importlib.machinery, importlib.util
CODE = os.path.dirname(os.path.abspath(__file__))
HERE = os.environ.get("REFINE_EVAL_DATA", os.path.expanduser("~/.claude/cache/refine/eval"))  # data
_ld = importlib.machinery.SourceFileLoader("st", os.path.join(CODE, "stress.py"))
st = importlib.util.module_from_spec(importlib.util.spec_from_loader("st", _ld)); _ld.exec_module(st)
gen = importlib.machinery.SourceFileLoader("g", os.path.join(CODE, "gen.py")).get_source("g")
ASK = gen[gen.index('ASK = """') + 9: gen.index('"""\n\n\ndef gen')]
style = "\n\n---\n\n".join(p["text"][:900] for p in sorted(json.load(open(os.path.join(HERE, "corpus_all.json"))), key=lambda p: p["len"])[20:23])
CATS = {
    "X-thinking-aloud": "the user thinks aloud and changes their mind: rejects an option and picks another ('use X, no, Y'), asks a question then answers or drops it themself ('should I add tests? nah'), 'yeah no' / 'no yeah' / 'no no no' idioms, 'scratch that' after delegating to an agent, 'never mind' on one of several items, a correction late in the transcript that fixes an earlier item, a restart ('let me say that again'). INTENT must contain ONLY the final decisions",
    "Y-not-corrections": "transcripts full of the word 'no' and change-of-mind words that are NOT self-corrections and must be kept: standing prohibitions with reasons ('don't delete it, I might need it'), the user correcting the agent's earlier answer ('no, that's not the bug'), 'no' as content ('no emojis', 'if the API says no'), unresolved indecision ('maybe A or B, not sure, what do you think'), hedges, plus 2 cases that mix one real self-correction with these",
}
def one(item):
    key, cat = item
    txt, _, _ = st.api_call("opus", "", ASK.format(style=style, cat=cat), 16000)
    arr = json.loads(txt[txt.index("["): txt.rindex("]") + 1])
    for a in arr:
        a["kind"] = key
    return arr
with ThreadPoolExecutor(2) as ex:
    allc = [c for b in ex.map(one, CATS.items()) for c in b]
json.dump(allc, open(os.path.join(HERE, "corpus_corr_holdout.json"), "w"), indent=1)
print(len(allc), "holdout cases")
