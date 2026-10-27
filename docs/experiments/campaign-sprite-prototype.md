# Campaign Level sprite prototype

## Question and provisional answer

Can a small painted sprite library reconstruct an actual Campaign Level section, preserve its geographic relationships, and remain stable while scrolling?

Yes for this bounded experiment: four generated PNGs supply two textures and twelve reusable scenery symbols. A real 44×32 tile region produces 769 fixed scenery placements, viewed through the original 20×12 tile window. Panning away and back restores identical canvas pixels in Chromium. This establishes reusable composition, not production-ready artwork or complete terrain coverage. User evaluation of this prototype is pending.

The user accepted the earlier Animation Level river prototype and deferred game integration. This follow-up explores the Campaign Level separately; it makes no production renderer, simulation, save, asset-loader or public interface changes.

## Run or download

```sh
bun run export:web
bun run prototype:campaign
```

Open `build/graphics-remaster/campaign-prototype.html`. The first command exports the original game data; the second verifies cached art or downloads the four SHA-256-pinned PNGs, then embeds all artwork and map data in a single offline HTML file. No server, account or API credential is needed to open the built file.

Alternatively, [save the standalone HTML](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/38cc7932f17fd132b514642d5de71156e627fdfa/campaign-prototype.html) as `campaign-prototype.html`, then open it locally. GitHub serves the raw HTML as text, so save it before opening. All artwork, full-resolution captures, prompts and the demo are in the [same secret gist](https://gist.github.com/odogono/f6b575409714ee9a0036152250a11587), revision `10b425a31831cb8f64d875dcf69cf91e43fefa9f`. Anyone with its URL can view it.

The prototype source is captured on branch `experiment/graphics-remaster` in [PR #182](https://github.com/odogono/wime/pull/182). It is intentionally outside the production build.

## Source identity and assembly

- Source data: current exported Amiga reference assets, `campaign/tilemap.json`, `campaign/tiles.png` and `starting-state.json`. The map's row-major layout is established by `finding:data-formats-campaign-map-grid`; this experiment adds no new claims about original game behaviour.
- Region: zero-based columns 40–83 and rows 14–45, covering Bree, Weathertop, Rivendell and surrounding terrain. The [704×512 source crop](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/457c2af3dfa6125223427d6014619dcc285cf620/campaign-region-source.png) matches the independently rendered extracted map exactly: zero mismatched colour channels.
- Viewport: 320×192 logical pixels (20×12 tiles), painted into a 1280×768 canvas. Source and painted views use identical camera coordinates. These are terrain-compositor captures, not emulator screenshots or captures of the game's complete UI.
- Water: the original atlas's two blue colours define a region-wide mask. A repeating painted water texture is clipped to it, with interpolated edges and a soft bank. There is no generated full-map river painting.
- Paths: peach source pixels on grass/forest tiles receive a simple path colour. This heuristic is provisional; peach pixels on hills and buildings are excluded.
- Scenery: per-tile colour coverage selects experimental grass, forest, hill, mountain or Place recipes. Forest subregions choose up to four tree anchors; hills and mountains use overlapping ridge symbols. The source grid controls geography, while sprite crowns and ridges can extend beyond their cells.
- Settlements: generic Place-kind tiles select shared symbols. Six named landmarks lacking generic kinds receive explicit prototype symbols: Hobbiton, Woodhall, Bombadil's House, Deadman's Dike, Weathertop and Rivendell. These are artistic choices, not reconstructed original rules; Rivendell's generic elven hall is not a faithful architectural reconstruction.
- A coordinate hash selects variants and modest placement jitter. It never consumes simulation randomness and never changes when the camera moves. All scenery is sorted by its ground-contact position before drawing.

The pure in-memory recipe/state logic is inline in `web/src/view/campaign-prototype.html`, beside its pinned asset manifest. The builder is `tools/build-campaign-prototype.ts`. Image binaries, extracted masks and the self-contained HTML remain under ignored `build/graphics-remaster/`.

## Reusable artwork

| Image                                                                                                                                                                 | Dimensions        | Role                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------- |
| [Meadow](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/b28f52f616ce0fc8291ebdcdfb54240b740ea37a/campaign-grass.png)                 | 1254×1254, opaque | Repeating ground                                            |
| [Water](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/93225a9e8b4a0c38531a5203a31bf420b4f734f3/campaign-water.png)                  | 1254×1254, opaque | Repeating surface clipped to source waterways               |
| [Nature atlas](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/fc8bf38142b9b67940139c03269a69c332d36394/campaign-nature.png)          | 1536×1024, alpha  | Three trees and three ridge/foothill clusters               |
| [Settlement atlas](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/4b1695c3b61925038233bb845a2eb77c26555fa6/campaign-settlements.png) | 1536×1024, alpha  | Village, walled town, keep, ruins, elven hall and farmstead |

All four were generated separately with built-in `image_gen.imagegen`. The earlier painted Campaign Level concept was a style reference only. Transparency was requested for the two sprite sheets and verified in their actual alpha channels. No generated PNG was repainted, resized or rewritten; the runtime crops and scales it when drawing. The generated nature sheet does not respect exact equal-cell spacing, so reviewed crop rectangles follow its actual gutters. Alpha bounds trim unused space and retain a small edge gutter.

![The twelve reusable scenery sprites](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/680f8e5a9a7d7a2ad32a534c02825006bf4a63cc/campaign-sprite-gallery.png)

## Actual compositor evidence

### Bree, Old Forest and Weathertop

**Original terrain at the same camera**

![Original tiles around Bree](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/461ecce946cfea63e5ea040d9397959215397ebb/campaign-bree-original.png)

**Painted composition**

![Reusable painted terrain around Bree](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/9acf2bbf40c7d4cf7c138cd4adacdba117576024/campaign-bree-painted.png)

### Rivendell and the Misty Mountains

**Original terrain at the same camera**

![Original tiles around Rivendell](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/13b66920d75b6191fb658ed1ad4594950b8cf63c/campaign-rivendell-original.png)

**Painted composition**

![Reusable painted terrain around Rivendell](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/c883f9147548193a1d7eb13d494365fb15b84255/campaign-rivendell-painted.png)

[Weathertop original](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/5b343a2b9e0c5141ef417f58b6575501951359fc/campaign-weathertop-original.png) · [Weathertop painted](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/2e67e4d1a5a44821e888c478a8d7263d3d6f2d22/campaign-weathertop-painted.png) · [Terrain classifications](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/d2ca9da921d615b871f55d6bb6cf838673ba32ae/campaign-footprints.png) · [Grid overlay](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/9edbc99c45aa08c5ac864589957aa41d9f8fb2d7/campaign-grid.png) · [Desktop controls](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/b38b803eb783a5e9c6560f37399e4c328bc0b644/campaign-prototype-desktop.png) · [Narrow-screen controls](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/e18032e3593dbb324340fd5ddd6e64a7724f5bf1/campaign-prototype-mobile.png)

All canvas captures are 1280×768 and come from the working compositor, not separate generated whole-screen illustrations. Place labels are optional prototype overlays derived from the source names; they are not text embedded in the generated artwork.

## Tree readability revision — 2026-10-27

The user observed that trees blended into the grass and were too large. Tree crown widths are now 6.5–7.5 logical pixels, down from 10–12 (about one third narrower). The meadow texture is drawn at 30% opacity over a muted green base (#98a477), reducing competing detail while retaining the painted surface. This is a compositor adjustment: the four generated PNGs, prompts, all 769 placements, variants, water coverage and other scenery sizes are unchanged.

**Earlier tree scale and grass contrast**

![Earlier large tree symbols around Rivendell](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/f4f8e66fce863279d655004e38ddf88aa7285d22/campaign-rivendell-painted.png)

**Smaller tree symbols over quieter grass**

![Revised tree scale and ground contrast around Rivendell](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/c883f9147548193a1d7eb13d494365fb15b84255/campaign-rivendell-painted.png)

The smaller silhouettes separate more clearly from the ground. The same anchors now look more regularly spaced, so natural forest clustering remains a separate refinement; this revision does not establish final forest density. [Revision verification](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/7107dbd7c7f0ac45b26bcebc1de658325d80a069/campaign-tree-revision-verification.json) confirms smaller crowns, identical placement data, stable panning, layer restoration, offline loading and narrow-screen layout. The main captures and standalone download above include the revision.

## Controls and observations

Three presets jump between real areas, while sliders, arrows and dragging allow free panning. Original tiles, terrain recipes and painted sprites share the camera. Ground, water, paths, nature and settlements can be hidden independently. Grid and label switches expose placement, and clicking a tile reveals its source tile number and recipe. The variation switch contrasts a repeated single shape with the small asset family. Guided comparisons cover layer construction, reuse and geography.

- Forest clusters and settlements can be assembled from reusable alpha sprites over continuous ground, rather than being baked into a unique regional painting.
- Source waterways and named-Place anchors remain controlled by game data. The painted sprites overhang the grid; the resulting visible terrain boundary is approximate.
- Repeated foothills remain conspicuous, especially where the source uses broad horizontal bands. More low-relief shapes and region-aware placement would be needed for polished ranges.
- Grass uses mirrored repetition to hide hard seams, but symmetry is still visible. Water remains visibly constrained by the low-resolution source mask.
- A single grass base also covers wetlands; only their source water pixels receive water treatment. Paths are incomplete and low contrast. There are no dedicated bridge, ford, cliff or marsh sprites.
- Generic settlement symbols establish reuse, not final landmark designs. Building groups and tree silhouettes vary in apparent scale. Some symbols contain integrated vegetation despite the no-background request.
- The experiment covers one bounded region and does not establish recipes for the full map, coasts or every tile family. It contains no Forces or Orders.

## Validation

- Inspected source colours, source crop, transparent atlas crops, the twelve-sprite gallery, all three regions and desktop/mobile captures. No generated lettering or UI is present in the four art assets.
- Isolated Playwright Chromium 156 opened the HTML directly with `file://`. Panning away/back restored identical canvas bytes; layer restoration and variant restoration reproduced the same pixels. Three presets and views, grid, tile inspection, guided steps, dragging and camera limits worked. No page errors or HTTP requests occurred, and the page fit a 390-pixel viewport. [Verification record](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/efe84cd1fe3f08db7acb536151e23cab784d234d/campaign-prototype-verification.json).
- The initial Helium fallback produced differing first-render canvas readbacks despite identical recipe data; this result was not used as repeatability evidence. The checks passed in standalone Chromium.
- A cold-cache build downloaded all four pinned images and produced byte-identical HTML to the cached build. The builder checks hashes, PNG decoding, transparency and nonempty sprite bounds.
- Gist image responses and downloaded bytes were checked against the local files; the gist is secret (`public: false`). PR image embeds were checked in a browser using GitHub-rendered Markdown.
- `bun run check` passed with freshly exported original assets present: 74 tool tests, 498 web tests and 276 valid Findings. No raster files are tracked or staged in the project.

## Exact submitted prompts

[Prompt record in the gist](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/f2b6d6222c4901f19e5689293ca6c2fb0b0ca328/campaign-asset-prompts.json). Each call used `referenced_image_paths: ["build/graphics-remaster/campaign-painted.png"]` (the actual call used its absolute path), with `transparent_background: true` only for nature and settlements. The reference had been inspected before generation.

### grass

```text
Use case: stylized-concept. Asset type: reusable painted Campaign Level map artwork for a fantasy strategy game. Input image 1 is STYLE REFERENCE ONLY: borrow its painterly green/gold palette, delicate brushwork and materials; do not reproduce the map, rivers, subjects, UI or text. Viewpoint: elevated illustrated-atlas view over a flat map, no horizon, daylight from upper left. No lettering, labels, UI, frames or watermark. Primary request: one opaque seamless repeating meadow ground texture, square image. Fine restrained olive and fresh green grass, a few tiny muted dry patches, subtle painted variation at a uniform scale, no conspicuous clumps or focal point. Flat ground only: no trees, rocks, hills, buildings, paths, water, flowers or shadows from offscreen objects. All four edges should tile naturally. This fills the spaces beneath separate scenery sprites, so keep its contrast and detail quiet.
```

### water

```text
Use case: stylized-concept. Asset type: reusable painted Campaign Level map artwork for a fantasy strategy game. Input image 1 is STYLE REFERENCE ONLY: borrow its painterly green/gold palette, delicate brushwork and materials; do not reproduce the map, rivers, subjects, UI or text. Viewpoint: elevated illustrated-atlas view over a flat map, no horizon, daylight from upper left. No lettering, labels, UI, frames or watermark. Primary request: one opaque seamless repeating river WATER SURFACE texture, square image. Rich medium blue and teal freshwater with fine restrained painted ripples, subtle pale highlights and gentle colour variation, uniform scale and overhead projection. Water only all the way to all four edges; no shoreline, banks, vegetation, rocks, boats, sky reflections, waterfalls, ground or objects. No strong directional waves or large swirls. All four edges should tile naturally. The game clips this texture to the original river shapes.
```

### nature

```text
Use case: stylized-concept. Asset type: reusable painted Campaign Level map artwork for a fantasy strategy game. Input image 1 is STYLE REFERENCE ONLY: borrow its painterly green/gold palette, delicate brushwork and materials; do not reproduce the map, rivers, subjects, UI or text. Viewpoint: elevated illustrated-atlas view over a flat map, no horizon, daylight from upper left. No lettering, labels, UI, frames or watermark. Primary request: a high resolution TRANSPARENT sprite atlas with exactly SIX separate objects in a strict 3-column by 2-row equal-cell grid. TOP ROW: three different individual leafy woodland trees, each with a full rounded crown and short visible trunk (broad oak, slender birch, compact beech). BOTTOM ROW: three low compact rocky mountain/ridge clusters (connected twin peaks, broad three-peak ridge, rounded rocky foothill). Trees green, rocks warm grey and muted ochre. Every object fully isolated on true transparent alpha, centered horizontally in its own cell, planted at the same baseline at 85 percent of cell height. Keep each object inside central 75 percent of its cell width and height, large clear transparent gutters; nothing may cross a cell boundary. Consistent light from upper left, only a small soft contact shadow beneath each object. Each tree crown or mountain cluster is ONE reusable map symbol, no terrain square or grass platform. No shared landscape, ground patches, grid lines, numbers or labels. Landscape sheet approx 3:2. Painted miniature map detail, readable silhouettes, no snow.
```

### settlements

```text
Use case: stylized-concept. Asset type: reusable painted Campaign Level map artwork for a fantasy strategy game. Input image 1 is STYLE REFERENCE ONLY: borrow its painterly green/gold palette, delicate brushwork and materials; do not reproduce the map, rivers, subjects, UI or text. Viewpoint: elevated illustrated-atlas view over a flat map, no horizon, daylight from upper left. No lettering, labels, UI, frames or watermark. Primary request: a high resolution TRANSPARENT sprite atlas with exactly SIX separate small medieval fantasy settlement symbols in a strict 3-column by 2-row equal-cell grid. TOP ROW: small timber-and-plaster village with red/brown roofs; larger stone town with compact walls; small stone keep with a tower. BOTTOM ROW: ruined stone tower; elegant pale elven hall with a few slender roofs; low farmstead of thatched cottages. Each symbol is a compact group of two to five related buildings, viewed from the same elevated illustrated-atlas angle with top and south-facing walls visible. Consistent scale of building details and daylight from upper left; only small soft contact shadows. Every group fully isolated on true transparent alpha, centered in its own cell with baseline at 85 percent cell height. All groups entirely inside central 75 percent of their equal grid cell, wide clear transparent gutters, no object crossing cells. No landscape, terrain squares, grass platforms, paths outside the group, tree backgrounds, flags, people, labels, grid lines or text. Landscape sheet approx 3:2.
```
