// A real rewrite unramble produced (Sonnet, 3.3 s). Shown verbatim; do not edit.
export const ROUGH =
  "okay so um the login page is broken again I think, like when you hit submit it just spins forever. can you look at the auth handler, uh no wait, not the handler, the session middleware, that's what changed yesterday. and then once it works add a test for it so this doesn't happen again. oh and don't touch the database migrations, we're kind of mid deploy";

export const REFINED = `The login page is broken again, I think: when you hit submit, it spins forever.

1. Look at the session middleware, which is what changed yesterday.
2. Once it works, add a test for it so this doesn't happen again.

Constraints:
- Don't touch the database migrations; we're mid deploy.`;

// Phrases of ROUGH that have no counterpart in REFINED, in reading order. The
// before/after beat strikes exactly these; rewording ("that's" → "which is") is not struck.
export const DROPPED = [
  "okay so um",
  "like",
  "just",
  "can you",
  "the auth handler, uh no wait, not the handler,",
  "and then",
  "oh and",
  "kind of",
];

export const BAND = {
  ready: "⌃G refine",
  refining: "refining…",
  cancel: "⌃G cancels", // shown after "refining…" while the rewrite runs
  refined: "⌃G original",
} as const;

// The plugin's toast, word for word. Wraps after the "·" when the frame is narrow.
export const TOAST = "unramble: done in 3.3s with sonnet on your plan · ⌃G again restores your original";

// The two install paths from the README, word for word. `where` names the place each is
// typed; plugin installs bind nothing until `/unramble setup` runs, so it travels with it.
export const INSTALL = {
  terminal: { where: "In your terminal", commands: ["npx unramble"] },
  claudeCode: {
    where: "Or inside Claude Code",
    commands: ["/plugin install unramble --marketplace yadava5/unramble", "/unramble setup"],
  },
} as const;
export type InstallPath = (typeof INSTALL)[keyof typeof INSTALL];

export const REPO = "github.com/yadava5/unramble";
export const NPM = "npmjs.com/package/unramble";
