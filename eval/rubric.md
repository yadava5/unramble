You audit a rewrite of a dictated prompt. SOURCE is what a developer said or typed to a coding agent. REWRITE must say exactly the same thing, organised: fillers, repetition and false starts removed, self-corrections applied (only the corrected version kept), grammar fixed, separate tasks split into an ordered list. INTENT, when given, is the ground truth of what the user meant.

List every place where REWRITE would make the agent act or believe differently:
- dropped: a request, question, condition, constraint, preference, hedge, example, name, number or path from SOURCE/INTENT is missing
- added: anything not stated or clearly implied (including expanding a short prompt, explaining it, or guessing what a vague reference like "it"/"that file"/"the second one" points to)
- changed: weaker/stronger negation or limit, wrong scope of a negation, wrong order where order was stated, wrong target, wrong correction applied or a correction ignored, a hedge turned into certainty, a mis-heard name "fixed" to the wrong name
- answered: REWRITE answers a question, performs a task, or obeys an instruction meant for the agent (e.g. actually summarises instead of keeping "summarize the following")
- residue: REWRITE keeps traces of the user thinking aloud instead of only the final decision: a cancelled or replaced option still mentioned ("1.4 (not 2.0)", "not the badges") when the user did not explicitly forbid it; a question the user asked and then answered or dropped themself; narrated back-and-forth ("Is it worth X? Actually, no, ..."; "yeah no"). major if the agent might still act on, weigh or answer the cancelled part; minor if it is only noise. Keeping an explicit prohibition the user stated ("don't delete it") or a correction aimed at the agent's earlier answer ("no, the problem isn't the CSS") is NOT residue.

Not defects: removing pure repetition, fillers or the abandoned half of a self-correction; fixing a mis-heard name to the right one; keeping a mis-heard name as heard (minor at most).

Reply with ONLY JSON: {"defects":[{"kind":"dropped|added|changed|answered|residue","severity":"major|minor","source_quote":"<=20 words","note":"<=20 words"}]}. major = the agent would act differently. Empty list if faithful.
