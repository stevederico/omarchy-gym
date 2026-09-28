#!/bin/bash
# Render Rockstar Hero's songs into plugin/sd.gym/songs/*.ogg and refresh the
# SONGS block in GymLogic.js.
#
# Needs a riff-hero checkout with node_modules installed (RIFF_HERO_DIR,
# default ../riff-hero), ffmpeg with libopus, and a Chromium based browser to
# open the printed URL. The page renders each song offline with Rockstar
# Hero's own WebAudio synth and posts the audio back to this script's server.
#
# Usage: tools/render-songs.sh

set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
RIFF_HERO_DIR=${RIFF_HERO_DIR:-$(cd "$ROOT/.." && pwd)/riff-hero}
OUT_DIR=$(mktemp -d)
SERVER_PID=""
cleanup() {
  [[ -n $SERVER_PID ]] && kill "$SERVER_PID" 2>/dev/null
  rm -rf "$OUT_DIR"
}
trap cleanup EXIT

[[ -x $RIFF_HERO_DIR/node_modules/vite/bin/vite.js ]] || {
  echo "riff-hero with node_modules not found at $RIFF_HERO_DIR (set RIFF_HERO_DIR)" >&2
  exit 1
}

RIFF_HERO_DIR="$RIFF_HERO_DIR" OUT_DIR="$OUT_DIR" \
  node "$RIFF_HERO_DIR/node_modules/vite/bin/vite.js" --config "$ROOT/tools/render-songs/vite.config.mjs" &
SERVER_PID=$!

echo "Open http://127.0.0.1:5241/ in a Chromium based browser and wait for \"done\"."
until [[ -f $OUT_DIR/songs.json ]]; do sleep 2; done

mkdir -p "$ROOT/plugin/sd.gym/songs"
for wav in "$OUT_DIR"/*.wav; do
  ffmpeg -hide_banner -loglevel error -y -i "$wav" -c:a libopus -b:a 96k -map_metadata -1 \
    "$ROOT/plugin/sd.gym/songs/$(basename "$wav" .wav).ogg"
done
node "$ROOT/tools/write-songs.js" "$OUT_DIR/songs.json"
