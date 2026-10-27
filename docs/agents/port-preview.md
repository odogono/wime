# Driving the port and taking screenshots

How an agent runs the port, puts it in a given state, captures its screen, and attaches the captures to a PR.

## Run it

Start the dev server on a fixed port in the background, and wait for it:

```sh
(bun run dev -- --port 5291 --strictPort > /tmp/wime-dev.log 2>&1 &); until grep -q Local /tmp/wime-dev.log; do sleep 0.5; done
```

Open your own preview tab with `preview_open {"url": "localhost:5291", "reuseExistingTab": false}` and pass the `tabId` it returns to every later preview call: another session's tab refuses commands. Close the tab and `pkill -f 'vite.*5291'` when done.

The canvas animates without end, so `preview_snapshot` times out on it. `preview_evaluate` returns at most 64 KB and gives up after 15 s; await longer waits across several calls.

## `window.wime`

Under `bun run dev`, the page installs `window.wime` (`web/src/view/dev-hook.ts`, and the end of `chooseOnTitle` in `main.ts`). Call it through `preview_evaluate`:

- `wime.newGame()`: skip the boot sequence and the title menu, and start a new game on the Animation Level, under Gandalf's letter.
- `wime.sim()`: the sim's state (`SimState`), to read.
- `wime.setSim(s => …)`: replace the state, to set up a case: `wime.setSim(s => ({...s, roster: s.roster.map(e => e.name === 'FRODO' ? {...e, objects: [0, 4, 7]} : e)}))`.
- `wime.at(x, y)`: the page point of native pixel (x, y), for `preview_click`.
- `wime.snap(name)`: save the game's 320 by 200 screen to `build/port/<name>.png` and resolve to its path. `wime.snap(name, 640)` keeps the Full Map Level's hi-res pixels. Read the file; no image passes through the tool result.

```js
(async () => {
  wime.newGame();
  await new Promise(r => setTimeout(r, 1500));
  return wime.snap('letter');
})();
```

## Attaching screenshots to a PR

The repo is private and `gh` cannot upload images, so screenshots go in a secret gist, embedded in the PR body by raw URLs pinned to the gist's commit. Attach captures of the port only.

```sh
d=$(mktemp -d); echo "Screenshots for odogono/wime#<n>" > $d/README.md
url=$(gh gist create $d/README.md -d "wime #<n> screenshots"); id=${url##*/}
git clone -q https://gist.github.com/$id.git $d/g && cp build/port/*.png $d/g/ && git -C $d/g add . && git -C $d/g commit -qm shots && git -C $d/g push -q
B=https://gist.githubusercontent.com/odogono/$id/raw/$(git -C $d/g rev-parse HEAD)
curl -s -o /dev/null -w '%{http_code}\n' $B/<name>.png
```

`gh gist create` makes a secret gist by default. Write the body with `![Caption]($B/<name>.png)`, a table for several, and pass it with `gh pr create --body-file`. To replace the images, push to the same gist and swap the old commit SHA in the body for the new one with `gh pr edit --body-file`.
