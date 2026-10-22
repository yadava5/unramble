# unramble video and brand

Remotion source for the README demo and the GitHub social preview, plus the script that
builds the logo files in `../assets/`.

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
```

Concurrency is capped at 2 in `remotion.config.ts`. `npm run studio` opens the
editor on 127.0.0.1:3123; stop it when you are done.

## Compositions

| id              | size      | length           | output                           |
| --------------- | --------- | ---------------- | -------------------------------- |
| `Demo`          | 1600×900  | 16.2 s, loops    | `assets/demo.mp4`, `demo.gif`    |
| `SocialPreview` | 1280×640  | still            | `assets/social-preview.png`      |

The prompt text in `src/copy.ts` is a real rewrite the tool produced. Keep it verbatim.
The demo's timing (word rhythm, keypress, refine,
swap) lives in `src/timeline.ts`.

## Fonts

Both are bundled in `public/fonts/` with their licences:

- Instrument Sans (SIL OFL 1.1): headlines, captions, the wordmark (outlined, so the
  SVGs need no font).
- JetBrains Mono (SIL OFL 1.1): terminal content, commands and URLs only.
