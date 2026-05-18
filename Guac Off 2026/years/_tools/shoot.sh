#!/usr/bin/env bash
# Usage: shoot.sh <abs-path-to-index.html> <abs-path-out.png>
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME" >&2; exit 3; }
"$CHROME" --headless --disable-gpu --hide-scrollbars --no-sandbox \
  --virtual-time-budget=6000 --window-size=1280,900 \
  --default-background-color=FFFFFFFF \
  --screenshot="$2" "file://$1"
test -s "$2"
echo "shot: $2 ($(wc -c <"$2") bytes)"
