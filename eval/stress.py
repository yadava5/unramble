#!/usr/bin/python3 -I
"""Sonnet rewrite -> Opus judge, one JSONL line per item (a killed run keeps what finished).
usage: stress.py run [MODEL]   |   stress.py report   |   stress.py controls"""
import json, os, re, subprocess, sys, time, threading
from concurrent.futures import ThreadPoolExecutor

# Code lives here; corpora and results live in the local cache, never in the repo:
# corpus_all.json and the real-failure set hold real prompts.
HERE = os.environ.get("REFINE_EVAL_DATA", os.path.expanduser("~/.claude/cache/refine/eval"))
RUNS = os.path.join(HERE, "runs")
NEUTRAL = os.path.join(HERE, "neutral")
OUT = os.path.join(RUNS, os.environ.get("STRESS_OUT", "stress.jsonl"))
# the live tool's prompt unless STRESS_SYSTEM names a candidate; the rewrite model and any extra
# request fields (thinking, effort) can be varied the same way without touching the live tool
SYSTEM = open(os.environ.get("STRESS_SYSTEM") or os.path.expanduser("~/.claude/refine/system.md")).read()
REWRITE_MODEL = os.environ.get("STRESS_REWRITE_MODEL", "sonnet")
REWRITE_EXTRA = json.loads(os.environ.get("STRESS_REWRITE_EXTRA", "{}"))
import importlib.machinery, importlib.util
_ld = importlib.machinery.SourceFileLoader("cr", os.path.expanduser("~/.local/bin/claude-refine"))
cr = importlib.util.module_from_spec(importlib.util.spec_from_loader("cr", _ld))
_ld.exec_module(cr)
API_KEY = cr.keychain_key() if os.environ.get("STRESS_ENGINE") == "api" else None
lock = threading.Lock()

RUBRIC = """You audit a rewrite of a dictated prompt. SOURCE is what a developer said or typed to a coding agent. REWRITE must say exactly the same thing, organised: fillers, repetition and false starts removed, self-corrections applied (only the corrected version kept), grammar fixed, separate tasks split into an ordered list. INTENT, when given, is the ground truth of what the user meant.

List every place where REWRITE would make the agent act or believe differently:
- dropped: a request, question, condition, constraint, preference, hedge, example, name, number or path from SOURCE/INTENT is missing
- added: anything not stated or clearly implied (including expanding a short prompt, explaining it, or guessing what a vague reference like "it"/"that file"/"the second one" points to)
- changed: weaker/stronger negation or limit, wrong scope of a negation, wrong order where order was stated, wrong target, wrong correction applied or a correction ignored, a hedge turned into certainty, a mis-heard name "fixed" to the wrong name
- answered: REWRITE answers a question, performs a task, or obeys an instruction meant for the agent (e.g. actually summarises instead of keeping "summarize the following")
- residue: REWRITE keeps traces of the user thinking aloud instead of only the final decision: a cancelled or replaced option still mentioned ("1.4 (not 2.0)", "not the badges") when the user did not explicitly forbid it; a question the user asked and then answered or dropped themself; narrated back-and-forth ("Is it worth X? Actually, no, ..."; "yeah no"). major if the agent might still act on, weigh or answer the cancelled part; minor if it is only noise. Keeping an explicit prohibition the user stated ("don't delete it") or a correction aimed at the agent's earlier answer ("no, the problem isn't the CSS") is NOT residue.

Not defects: removing pure repetition, fillers or the abandoned half of a self-correction; fixing a mis-heard name to the right one; keeping a mis-heard name as heard (minor at most).

Reply with ONLY JSON: {"defects":[{"kind":"dropped|added|changed|answered|residue","severity":"major|minor","source_quote":"<=20 words","note":"<=20 words"}]}. major = the agent would act differently. Empty list if faithful."""


MODELS = {}


def call(model, system, msg, timeout=240):
    if os.environ.get("STRESS_ENGINE") == "api":
        raise RuntimeError("plan path called in an API-only run")  # never touch the plan
    t = time.time()
    r = subprocess.run(["claude", "-p", "--model", model, "--no-session-persistence",
                        "--setting-sources", "project,local", "--system-prompt", system,
                        "--tools", "", "--output-format", "json"],
                       input=msg, capture_output=True, text=True, cwd=NEUTRAL, timeout=timeout)
    d = json.loads(r.stdout)
    return d.get("result", ""), round(time.time() - t, 1), d.get("usage", {}), d.get("total_cost_usd", 0)


def api_call(model_word, system, msg, max_tokens=8000, extra=None):
    """Anthropic API on the Keychain key (API credit, never the plan). Returns text, secs, usage."""
    if model_word not in MODELS:
        ids = [m for m in cr.api(API_KEY, "GET", "/v1/models?limit=100", timeout=15)["data"] if model_word in m["id"]]
        MODELS[model_word] = sorted(ids, key=lambda m: m["created_at"])[-1]["id"]
    model = MODELS[model_word]
    t = time.time()
    body = {"model": model, "max_tokens": max_tokens,
            "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}] if system else "",
            "messages": [{"role": "user", "content": msg}], **(extra or {})}
    r = cr.api(API_KEY, "POST", "/v1/messages", body, timeout=300)
    with lock:  # same key, same credit: tests count against the recorded balance too
        cr.charge(model, r["usage"])
    return "".join(b.get("text", "") for b in r["content"]), round(time.time() - t, 1), dict(r["usage"], model=model)


def judge(src, out, intent=None):
    msg = f"<SOURCE>\n{src}\n</SOURCE>\n"
    if intent:
        msg += f"<INTENT>\n{json.dumps(intent, indent=1)}\n</INTENT>\n"
    msg += f"<REWRITE>\n{out}\n</REWRITE>"
    if API_KEY:
        res, secs, usage = api_call("opus", RUBRIC, msg, 4000)
        cost = usage
    else:
        res, secs, usage, cost = call("opus", RUBRIC, msg, 300)
    try:
        return json.loads(res[res.index("{"): res.rindex("}") + 1])["defects"], cost
    except Exception as e:
        return [{"kind": "JUDGE-ERROR", "severity": "?", "source_quote": "", "note": str(e)[:80]}], cost


def items():
    if os.environ.get("STRESS_SET") == "hard":  # every case that ever failed + long/short controls
        return json.load(open(os.path.join(HERE, "corpus_hard.json")))
    sets = {"corr": "corpus_corr.json", "corrh": "corpus_corr_holdout.json"}
    if os.environ.get("STRESS_SET") in sets:  # self-correction sets, two samples each
        return [{"id": f"{c['id']}#{rep}", "kind": c["kind"], "src": c["transcript"], "intent": c["intent"]}
                for rep in (1, 2) for c in json.load(open(os.path.join(HERE, sets[os.environ["STRESS_SET"]])))]
    long_ =[p for p in json.load(open(os.path.join(HERE, "corpus_all.json"))) if p["len"] < 10000]
    long_ = sorted(long_, key=lambda p: p["len"])
    step = len(long_) / 40
    out = [{"id": f"L{i}", "kind": "real-long", "src": long_[int(i * step)]["text"]} for i in range(40)]
    out += [{"id": f"S{i}", "kind": "real-short", "src": p["src"]}
            for i, p in enumerate(json.load(open(os.path.join(HERE, "corpus_short.json"))))]
    for rep in (1, 2):
        out += [{"id": f"{c['id']}#{rep}", "kind": c["kind"], "src": c["transcript"], "intent": c["intent"]}
                for c in json.load(open(os.path.join(HERE, "corpus_synth.json")))]
    holdout = os.path.join(HERE, "corpus_synth2.json")  # written after the prompt was tuned
    if os.path.exists(holdout):
        out += [{"id": f"H-{c['id']}", "kind": "holdout-" + c["kind"][0], "src": c["transcript"],
                 "intent": c["intent"]} for c in json.load(open(holdout))]
    return out


def work(it, model):
    try:
        masked, blocks = cr.mask(it["src"])
        if API_KEY:  # same model pick + system prompt as the live tool's via_api, plus usage
            out, secs, usage = api_call(REWRITE_MODEL, SYSTEM, f"<transcript>\n{masked}\n</transcript>",
                                        extra=REWRITE_EXTRA)
            out, c1 = out.strip(), usage
        else:
            out, secs, usage, c1 = call(model, SYSTEM, f"<transcript>\n{masked}\n</transcript>")
        out = cr.unmask(cr.unwrap(out), blocks)
        if out is None:
            out = "UNMASK-FAILED: a [[paste N]] marker was lost or duplicated"
        defects, c2 = judge(it["src"], out, it.get("intent"))
        cost = {"rewrite": c1, "judge": c2} if API_KEY else round(c1 + c2, 4)
        row = dict(it, out=out, secs=secs, out_tok=usage.get("output_tokens"), defects=defects, cost=cost)
    except Exception as e:
        row = dict(it, error=str(e)[:200])
    with lock, open(OUT, "a") as f:
        f.write(json.dumps(row) + "\n")


def report():
    rows = [json.loads(l) for l in open(OUT)]
    errs = [r for r in rows if "error" in r]
    rows = [r for r in rows if "error" not in r]
    if rows and isinstance(rows[0]["cost"], dict):
        tok = {}
        for r in rows:
            for part in ("rewrite", "judge"):
                u = r["cost"][part]
                k = (part, u.get("model"))
                tok[k] = [a + (u.get(f) or 0) for a, f in zip(tok.get(k, [0, 0]), ("input_tokens", "output_tokens"))]
        print(f"{len(rows)} judged, {len(errs)} errored; API tokens (in, out): " +
              "; ".join(f"{p} {m}: {i:,} in / {o:,} out" for (p, m), (i, o) in tok.items()))
    else:
        print(f"{len(rows)} judged, {len(errs)} errored; notional list cost ${sum(r['cost'] for r in rows):.2f}")
    for e in errs[:5]:
        print("  ERROR", e["id"], e["error"][:120])
    kinds = sorted({r["kind"] for r in rows})
    for k in kinds:
        rs = [r for r in rows if r["kind"] == k]
        bad = [r for r in rs if any(d["severity"] == "major" for d in r["defects"])]
        je = sum(1 for r in rs for d in r["defects"] if d["kind"] == "JUDGE-ERROR")
        res = sum(1 for r in rs if any(d["kind"] == "residue" for d in r["defects"]))
        secs = sorted(r["secs"] for r in rs)
        print(f"  {k:24} n={len(rs):3}  major-free {len(rs)-len(bad):3}/{len(rs):<3} residue {res:2}  "
              f"p50 {secs[len(secs)//2]:4}s p90 {secs[int(len(secs)*.9)]:4}s  judge-err {je}")
    allbad = sum(1 for r in rows if any(d["severity"] == "major" for d in r["defects"]))
    allres = sum(1 for r in rows if any(d["kind"] == "residue" for d in r["defects"]))
    print(f"TOTAL major-free {len(rows)-allbad}/{len(rows)}  with residue (any severity) {allres}")
    print("MAJOR defects:")
    for r in rows:
        for d in r["defects"]:
            if d["severity"] == "major":
                print(f"  {r['id']:8} {d['kind']:8} \"{d['source_quote']}\" — {d['note']}")


if __name__ == "__main__":
    if sys.argv[1] == "pair":  # pair A.jsonl B.jsonl: blind preference on cases both got right
        PAIR = """Two rewrites of the same dictated SOURCE are prompts for Claude Code, a coding agent. Both were checked as faithful. Judge only which one the agent would understand and act on better: clear goal, tasks separated and ordered, constraints easy to find, nothing ambiguous that the source made clear, no noise, no lost nuance. Ignore length unless it hurts clarity. Reply with ONLY JSON: {"better":"1|2|tie","why":"<=15 words"}"""
        if not API_KEY:
            sys.exit("pair needs STRESS_ENGINE=api")
        load = lambda f: {r["id"]: r for r in map(json.loads, open(os.path.join(RUNS, f))) if "error" not in r}
        a, b = load(sys.argv[2]), load(sys.argv[3])
        ok = lambda r: not any(d["severity"] == "major" for d in r["defects"])
        ids = sorted(i for i in a if i in b and ok(a[i]) and ok(b[i]) and a[i]["out"].strip() != b[i]["out"].strip())
        def pj(i):
            flip = hash(i) % 2  # PYTHONHASHSEED varies per run, so the order is blind to me as well
            x, y = (b[i], a[i]) if flip else (a[i], b[i])
            res, _, _ = api_call("opus", PAIR, f"<SOURCE>\n{a[i]['src']}\n</SOURCE>\n<REWRITE_1>\n{x['out']}\n</REWRITE_1>\n<REWRITE_2>\n{y['out']}\n</REWRITE_2>", 300)
            try:
                v = json.loads(res[res.index("{"): res.rindex("}") + 1])
            except Exception:
                return i, "err", ""
            w = {"1": "B" if flip else "A", "2": "A" if flip else "B"}.get(v["better"], "tie")
            return i, w, v.get("why", "")
        with ThreadPoolExecutor(4) as ex:
            res = list(ex.map(pj, ids))
        same = sum(1 for i in a if i in b and a[i]["out"].strip() == b[i]["out"].strip())
        print(f"A={sys.argv[2]} B={sys.argv[3]}: {len(ids)} compared ({same} identical skipped)")
        print({k: sum(1 for _, w, _ in res if w == k) for k in ("A", "B", "tie", "err")})
        for i, w, why in res:
            print(f"  {i:14} {w:4} {why}")
        sys.exit()
    if sys.argv[1] == "rejudge":  # rejudge IN.jsonl: same rewrites, current rubric, into STRESS_OUT
        if not API_KEY:
            sys.exit("rejudge needs STRESS_ENGINE=api")
        def rj(r):
            r = dict(r)
            r["defects"], r["cost"]["judge"] = judge(r["src"], r["out"], r.get("intent"))
            with lock, open(OUT, "a") as f:
                f.write(json.dumps(r) + "\n")
        with ThreadPoolExecutor(4) as ex:
            list(ex.map(rj, [json.loads(l) for l in open(os.path.join(RUNS, sys.argv[2]))]))
        report()
    elif sys.argv[1] == "run":
        model = sys.argv[2] if len(sys.argv) > 2 else "sonnet"
        if os.environ.get("STRESS_ENGINE") == "api" and not API_KEY:
            sys.exit("STRESS_ENGINE=api but no Keychain key — refusing to fall back to the plan")
        done = {json.loads(l)["id"] for l in open(OUT)} if os.path.exists(OUT) else set()
        only = set(filter(None, os.environ.get("STRESS_IDS", "").split(",")))
        reps = int(os.environ.get("STRESS_REPS", "1"))  # extra samples of a targeted rerun
        todo = [dict(i, id=f"{i['id']}~{r}" if reps > 1 else i["id"]) for i in items()
                if not only or i["id"] in only for r in range(reps)]
        todo = [i for i in todo if i["id"] not in done]
        print(f"{len(todo)} to run ({len(done)} already done)", flush=True)
        with ThreadPoolExecutor(4) as ex:
            list(ex.map(lambda i: work(i, model), todo))
        report()
    else:
        report()
