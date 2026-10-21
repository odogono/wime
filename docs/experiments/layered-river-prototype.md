# Layered painted river prototype

## Question and provisional answer

Can the preferred painted Animation Level style survive separate scenery layers, moving figures, different arrangements and lighting?

The prototype demonstrates that a small library of painted parts can compose a coherent river family. Three arrangements reuse the same six PNGs; a separately animated hobbit walks through the scene and can pass behind foreground plants. The generated images are never requested during play. The user reported that it works well, but deferred integration into the game. This is not approval of a production asset pipeline.

## Run or download

```sh
bun run prototype:river
```

Open `build/graphics-remaster/river-prototype.html` in a browser. The command downloads any missing artwork from pinned secret-gist URLs, verifies SHA-256 hashes, and embeds all six PNGs into one HTML file. Once built, it works offline and can be opened directly without Vite, a server, an account or API credentials. Valid cached files avoid downloads on later builds.

Alternatively, [save the standalone demo](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/57c4095d99175bfcf19cb43e8240ad686e93e396/river-prototype.html) as `river-prototype.html`, then open that downloaded file. GitHub may display the raw HTML as text until it is saved locally.

The runnable source is captured on branch `experiment/graphics-remaster` and reviewed in [PR #182](https://github.com/odogono/wime/pull/182). It is deliberately a throwaway standalone page, with no production Vite entry or game imports. Existing title and full-screen experiments remain documented separately.

## What is assembled

| Piece              | Source asset                                                                                                                                                                  | Use                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Sky                | Canvas gradient                                                                                                                                                               | Day, dusk and night, plus a simple moon                       |
| Clouds             | [Transparent cloud cluster](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/e88113255b3f42809a0f887621a993a625596642/river-clouds.png)        | Repeated at two scales                                        |
| Distant landscape  | [Transparent hill strip](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/4052c05724187fdf4aa9c2b65eb58c7cf1ea1684/river-hills.png)            | Shifted and mirrored behind the river                         |
| River and far bank | [Transparent river strip](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/49916c105dac92a37f19e5739fda53fa5df0b1ff/river-river.png)           | Independent depth and horizontal offset                       |
| Meadow             | [Opaque grass texture](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/68f9ddfc0d05058f91165cdb59825c9eb30995f3/river-ground.png)             | Clipped to a shallow bank edge                                |
| Moving figure      | [Eight-pose hobbit sheet](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/68e67e884bf3fb5ed89c04e4f7ebb047caeae36e/river-hobbit-walk.png)     | 4×2 cell crops, shared pixel scale and aligned foot baselines |
| Foreground         | [Transparent rocks and plants](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/f4fdaf9014645ef3f55fdaabe7f323b3983be814/river-foreground.png) | Repositioned, scaled and mirrored in front of the figure      |

All six images were generated separately with the built-in `image_gen.imagegen` tool, using the earlier [painted Animation Level concept](gameplay-graphics-remaster.md#animation-level) as a style reference. [Exact prompts](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/534b3bca9b01a84cbc5f592f0c105dec557772bc/river-asset-prompts.json) record each request. The transparent-background argument was true for all pieces except the opaque meadow. Alpha was inspected; the PNG bytes were not repainted, resized or otherwise rewritten. The builder measures alpha bounds for scenery crops and the figure's frame alignment.

The prototype has three explicit arrangements: Open riverbank, Sheltered bank and Rocky edge. Layer switches expose the drawing order; pan shifts distant and foreground pieces by different amounts. Lighting uses a sky gradient, brightness/saturation and a colour overlay, rather than separately generated day/night images. Pause, frame stepping, facing and a position slider expose the walk-cycle behaviour. Guided comparisons cover scene construction, artwork reuse and light/motion. State is held only in memory and shown in the page.

The state/reducer and rendering logic are inline in `web/src/view/river-prototype.html`; the pinned asset manifest is adjacent. `tools/build-river-prototype.ts` builds the ignored, self-contained artifact. The prototype does not load the game's actual scenery lists or simulate movement, combat or Orders. It tests the compositing approach behind [the existing Animation Level spec](../spec/animation-level.md), with its own simplified coordinates and recipes.

## Actual compositor captures

### Open riverbank, day

![Layered river prototype in daylight](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/cbb525f9a2cecc8ee0868d3515bb9ef30e7ff0f2/river-open-day.png)

### Sheltered bank, dusk

![Layered river prototype at dusk](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/ec6e9b12c51cf98f1f59caecf499c3c33a86c9ed/river-sheltered-dusk.png)

### Rocky edge, night

![Layered river prototype at night, with foreground occlusion](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/f19a9347914fb538b5b2b1fef7d1987fccb8c819/river-rocky-night.png)

These captures are rendered by the working compositor, not independent generated whole-scene paintings. [Desktop UI](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/e33c2f5bc563e08e30d99fd3e2f0925be04b4570/river-prototype-desktop.png) and [narrow-screen UI](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/1f2007e46da4476b56c0a1db08019560f00467c3/river-prototype-mobile.png) show the controls.

## What this establishes and what remains

- Transparent pieces combine successfully with an independently moving figure. The brown background visible in some image previews is absent when the sprite's actual alpha is composited.
- All three arrangements reuse exactly the same artwork. Returning to a paused arrangement with the same state reproduces the same canvas pixels.
- Foreground placement creates real occlusion. No character is baked into the scenery strips.
- The shoreline is still too straight and regular; production art needs a more natural near-bank transition and careful coverage between layers.
- Cloud and rock reuse is conspicuous, and mirrored repetition is a prototype shortcut rather than proof of seamless assets.
- The walk sheet has eight distinct poses, but character proportions and silhouette vary slightly between them. Baseline alignment helps ground contact; production animation still needs review and cleanup.
- Night is a colour-grade experiment, not new nocturnal artwork. Painted daylight highlights remain under the tint.
- This does not yet prove compatibility with all 18 original scenery recipes, special Places, battles or other figure sets. The game still uses its original renderer and assets.

## Verification

An isolated Chromium session opened the built file directly with `file://` and verified walking advances, all eight frame images differ, left/right mirroring changes the figure, all arrangements render, hiding/restoring the foreground changes/restores pixels, recipes repeat deterministically, guided steps update the visible state, and the layout fits a 390-pixel viewport. There were no page errors or HTTP requests. [Verification record](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/9303bf512bccc8ab0392b2ad746f136e0e785317/river-prototype-verification.json).

Type checking and linting pass for the builder. The repo-wide `bun run check` passed with exported game assets present. A cold build downloaded all six pinned PNGs and produced byte-identical HTML to the cached build. PNGs and the embedded-image HTML remain in ignored output and the secret gist; the project tracks only prototype source, the manifest, command and notes. The secret gist is unlisted, and anyone with its URL can view it.
