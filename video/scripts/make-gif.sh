#!/bin/sh
# README GIF from the rendered demo MP4: 1200 px wide, 15 fps, one palette for the
# whole clip (the frame is greyscale, so 128 colours is plenty).
# Usage: sh scripts/make-gif.sh out/demo.mp4 ../assets/demo.gif
set -eu
in="$1"
out="$2"
filters="fps=15,scale=1200:-1:flags=lanczos"
ffmpeg -v error -y -i "$in" \
  -filter_complex "[0:v]${filters},split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle" \
  -loop 0 "$out"
