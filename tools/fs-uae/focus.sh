#!/bin/bash
# focus.sh: bring FS-UAE to the front by pid, and fail unless it is the
# frontmost app, since CGEvents go to whichever app is. Run it before every
# key or click: another app can take focus between them.
pid=$(command cat "$(dirname "$0")/../../build/fs-uae/pid") || exit 1
osascript -e "tell application \"System Events\" to set frontmost of (first process whose unix id is $pid) to true" >/dev/null
sleep 0.3
front=$(osascript -e 'tell application "System Events" to get unix id of first process whose frontmost is true')
[ "$front" = "$pid" ] || { echo "focus.sh: the frontmost app is pid $front, not FS-UAE ($pid)" >&2; exit 1; }
