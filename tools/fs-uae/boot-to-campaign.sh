#!/bin/bash
# boot-to-campaign.sh: launch FS-UAE and press Space until the game is on
# the Campaign Level, about 100 s: Space skips each boot screen (clicks do
# not), and Gandalf's letter closes by itself. Then turn the day-92
# question off and move the pointer off the map's edge, where it would
# scroll the map and stop the clock. Snaps build/fs-uae/campaign.png.
set -e
dir=$(dirname "$0")
build="$dir/../../build/fs-uae"
"$dir/run.sh"
sleep 20
for _ in $(seq 1 25); do
  "$dir/focus.sh"
  osascript -l JavaScript "$dir/key.jxa.js" 49 >/dev/null
  sleep 4
done
"$dir/focus.sh"
osascript -l JavaScript "$dir/chord.jxa.js" 111 2 >/dev/null
sleep 1
# data+0x422f, the day-92 question (docs/re/fs-uae.md).
printf 'W 3d317 1\ng\n' >> "$build/debugger.in"
sleep 1
"$dir/focus.sh"
osascript -l JavaScript "$dir/move.jxa.js" 900 700 300 100 30 >/dev/null
osascript -l JavaScript "$dir/move.jxa.js" 300 100 700 500 30 >/dev/null
"$dir/snap.sh" "$build/campaign.png"
echo "snapped build/fs-uae/campaign.s.png"
