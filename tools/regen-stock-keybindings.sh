#!/bin/bash
# Rebuild Gym's bundled keybinding snapshot from stock Omarchy bindings only.
#
# Runs Omarchy's own `omarchy-menu-keybindings --print` against a temporary
# HOME that holds Omarchy's stock ~/.config/hypr templates, so personal
# bindings never end up in the repo. A stand-in `hyprctl binds` reports the
# binds found by the script's own Lua config scan. Then tools/write-catalog.js
# refreshes catalog.json, the baked list in GymLogic.js, and DROPS.md.
#
# Usage: tools/regen-stock-keybindings.sh

set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OMARCHY_PATH=${OMARCHY_PATH:-/usr/share/omarchy}
SCRIPT="$OMARCHY_PATH/bin/omarchy-menu-keybindings"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/home/.config" "$WORK/bin" "$WORK/cache"
cp -r "$OMARCHY_PATH/config/hypr" "$WORK/home/.config/hypr"

# Reuse the Lua scan embedded in the Omarchy script.
sed -n "/^    lua <<'LUA'$/,/^LUA$/p" "$SCRIPT" | sed '1d;$d' >"$WORK/scan.lua"
HOME="$WORK/home" timeout 30 lua "$WORK/scan.lua" >"$WORK/scan.tsv"
[[ -s $WORK/scan.tsv ]] || { echo "stock Lua scan found no bindings" >&2; exit 1; }

cat >"$WORK/bin/hyprctl" <<HYPRCTL
#!/bin/bash
[[ \${1:-} == binds ]] || exit 0
awk -F '\t' '{ printf "bind\n\tmodmask: %s\n\tkey: %s\n\tkeycode: 0\n\tdescription: %s\n\tdispatcher: __lua\n\targ: 0\n", \$1, \$3, \$2 }' "$WORK/scan.tsv"
HYPRCTL
chmod +x "$WORK/bin/hyprctl"

HOME="$WORK/home" XDG_CACHE_HOME="$WORK/cache" PATH="$WORK/bin:$PATH" \
  timeout 60 "$SCRIPT" --print >"$WORK/print.txt"
[[ -s $WORK/print.txt ]] || { echo "keybindings print was empty" >&2; exit 1; }

cp "$WORK/print.txt" "$ROOT/plugin/sd.gym/keybindings-print.txt"
node "$ROOT/tools/write-catalog.js"
