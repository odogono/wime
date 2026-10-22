#!/bin/bash
# aim.sh DX DY: park the Amiga pointer in the screen's top-left corner, then
# move it DX, DY host points, about 2 per lo-res pixel. The pointer is
# relative and writing its position from the debugger does not stick, so
# this is how to place it. Follow with press.jxa.js, which clicks without
# moving it.
dir=$(dirname "$0")
"$dir/focus.sh" || exit 1
osascript -l JavaScript "$dir/move.jxa.js" 900 700 300 100 30
osascript -l JavaScript "$dir/move.jxa.js" 900 700 300 100 30
osascript -l JavaScript "$dir/move.jxa.js" 300 100 $((300 + $1)) $((100 + $2)) 40
