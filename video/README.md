# unramble video and brand

Remotion source for the README demo, the LinkedIn launch video and the two stills,
plus the script that builds the logo files in `../assets/`.

## Setup

```sh
cd video
npm install            # Remotion 4.0.537, pinned
```

Rendering needs `ffmpeg` (for the GIF). Rebuilding the logo needs Python 3 with
`pip install fonttools uharfbuzz` and `rsvg-convert` (`brew install librsvg`).

## Render

```sh
npm run brand            # assets/logo*.svg, wordmark*.svg, logo-512.png, src/brand-geometry.ts
npm run render:demo      # assets/demo.mp4
npm run render:gif       # assets/demo.gif (from demo.mp4)
npm run render:social    # assets/social-preview.png
npm run render:linkedin  # ../../unramble-launch/linkedin.mp4
npm run render:cover     # ../../unramble-launch/linkedin-cover.png
```

The LinkedIn pieces are launch material, not repo assets: they render outside the
repo, to `../../unramble-launch/` by default. Set `LAUNCH_DIR` to send them elsewhere
(`LAUNCH_DIR=/tmp/launch npm run render:linkedin`).

Concurrency is capped at 2 in `remotion.config.ts`. `npm run studio` opens the
editor on 127.0.0.1:3123; stop it when you are done.

## Compositions

| id              | size      | length           | output                           |
| --------------- | --------- | ---------------- | -------------------------------- |
| `Demo`          | 1600×900  | 16.2 s, loops    | `assets/demo.mp4`, `demo.gif`    |
| `LinkedIn`      | 1080×1350 | 28.3 s, no audio | `$LAUNCH_DIR/linkedin.mp4`       |
| `LinkedInCover` | 1080×1350 | still            | `$LAUNCH_DIR/linkedin-cover.png` |
| `SocialPreview` | 1280×640  | still            | `assets/social-preview.png`      |

The prompt text in `src/copy.ts` is a real rewrite the tool produced. Keep it verbatim.
`DROPPED` there lists the phrases the before/after beat strikes; each must occur in
ROUGH in order, or the render throws. The demo's timing (word rhythm, keypress, refine,
swap) lives in `src/timeline.ts`.

## Fonts

Both are bundled in `public/fonts/` with their licences:

- Instrument Sans (SIL OFL 1.1): headlines, captions, the wordmark (outlined, so the
  SVGs need no font).
- JetBrains Mono (SIL OFL 1.1): terminal content, commands and URLs only.
