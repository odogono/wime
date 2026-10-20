#!/bin/bash
# snap.sh OUT.png: capture the FS-UAE window to OUT.png, and a copy at most
# 900 px wide to OUT.s.png. Read the small copy.
id=$(osascript -l JavaScript "$(dirname "$0")/winrect.jxa.js" | python3 -c 'import json,sys;print(json.load(sys.stdin)[0]["id"])')
screencapture -x -o -l $id "$1"; sips -Z 900 "$1" --out "${1%.png}.s.png" >/dev/null
