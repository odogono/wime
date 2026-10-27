#!/bin/bash
# run.sh: launch the Reference Build in FS-UAE with the debugger on a pipe,
# from build/fs-uae/ (`bun run fs-uae:setup` builds it). Append debugger
# commands to build/fs-uae/debugger.in; stdout goes to stdout.txt. Writes
# the emulator's pid to build/fs-uae/pid, which focus.sh reads. fs-uae is
# not on PATH: FS_UAE_BIN overrides the app bundle's binary.
set -e
bin=${FS_UAE_BIN:-/Applications/FS-UAE.app/Contents/MacOS/fs-uae}
cd "$(dirname "$0")/../../build/fs-uae"
: > debugger.in
(tail -f debugger.in | "$bin" wime.fs-uae > stdout.txt 2>&1 &)
for _ in $(seq 1 20); do
  pid=$(pgrep -f "$bin wime.fs-uae" || true)
  [ -n "$pid" ] && break
  sleep 0.5
done
[ -n "$pid" ] || { echo "run.sh: FS-UAE did not start; see build/fs-uae/stdout.txt" >&2; exit 1; }
echo "$pid" > pid
echo "FS-UAE pid $pid"
