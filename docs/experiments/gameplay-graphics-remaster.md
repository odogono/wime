# Painted treatments of the three gameplay Levels

## Brief

Explore the preferred painted title-art direction on the Animation Level, Campaign Level and Full Map Level. These are full-screen visual concepts. The generated paintings are not integrated into the game and are not layer-separated backgrounds, tile sets or animation sheets.

Each edit uses its own gameplay frame as the layout/content target and `painted-v4.png` only as a painterly style reference. The prompts ask for the screen's own daylight, map viewpoint and information hierarchy, without importing the title's mounted rider or sunset.

## Source captures and generation

- Source: the running browser port at commit `f623aa4a60a8788b805a8a4944f11a139f0aa114`, using current exported Amiga assets. These are not emulator captures of the Reference Build.
- Browser: Vite at `http://127.0.0.1:5173/`, navigating the three Levels with the game's controls. The Animation capture shows travellers by a river, and the Campaign capture is a nearby local map section dated 5 p.m., September 23, 1418 S.R.
- Capture method: exported the browser's presentation canvas and normalised with image smoothing disabled. Animation and Campaign sources are 320×200. The Full Map source is 640×400 to retain its 640 horizontal pixels while preserving the displayed 8:5 aspect; the original renderer's 640×200 buffer uses half-width pixels.
- Tool: built-in `image_gen.imagegen`, one edit per Level, with `transparent_background: false` and two `referenced_image_paths`: the corresponding source PNG first, `painted-v4.png` second. No CLI/API fallback was used.
- All three generated images are opaque 1586×992 PNGs, saved as returned without resizing, cropping or post-processing.
- Local source PNGs, output PNGs and `gameplay-prompts.json` are under gitignored `build/graphics-remaster/`. The exact prompts also appear below and in the gist's combined `prompts.json`.
- Remote images: [same secret gist](https://gist.github.com/odogono/f6b575409714ee9a0036152250a11587), revision `7a4c3f6646983ccb7e447c1f80403db76b24cba5`. Anyone with the URL can view them. No image binaries are committed in this project.

## Animation Level

![Painted Animation Level concept](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/877ffa5263b87b2dfc9433b0fd974e0f5d3212eb/animation-painted.png)

[Full-resolution treatment](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/877ffa5263b87b2dfc9433b0fd974e0f5d3212eb/animation-painted.png) · [Source frame](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/1fc89460c1e1320530ddc7441f45673ad7212878/animation-source.png)

<details>
<summary>Source frame</summary>

![Animation Level source capture](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/1fc89460c1e1320530ddc7441f45673ad7212878/animation-source.png)

</details>

The result keeps the river, meadow, travellers and three utility icons, with richer water, grass and clouds. The temporary upper-left notice is deliberately omitted. It adds a distant mountain backdrop and reinterprets the figures; their identity, number and position are not validated as exact. This still does not test animation consistency or scene-layer compositing.

## Campaign Level

![Painted Campaign Level concept](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/f208ef902e211638c0f416daca18618dda7e6893/campaign-painted.png)

[Full-resolution treatment](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/f208ef902e211638c0f416daca18618dda7e6893/campaign-painted.png) · [Source frame](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/5f7560b0d2bcc081100cb82148137214d4576358/campaign-source.png)

<details>
<summary>Source frame</summary>

![Campaign Level source capture](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/5f7560b0d2bcc081100cb82148137214d4576358/campaign-source.png)

</details>

The result preserves the broad river, ridge and forest arrangement, icon column and date strip, with detailed painted terrain. Despite the top-down instruction, terrain gains an oblique relief treatment, and buildings and paths are embellished. Force markers are redrawn and their exact identities are not reliable. The date lettering changes capitalisation. Geometry and overlays would need separate preservation for production use.

## Full Map Level

![Painted Full Map Level concept](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/41b0efe83b793f9c1ae8e9794955e17613cdcbbc/full-map-painted.png)

[Full-resolution treatment](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/41b0efe83b793f9c1ae8e9794955e17613cdcbbc/full-map-painted.png) · [Source frame](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/db6855e1a0e26187dcde81490be263e2f8b137f4/full-map-source.png)

<details>
<summary>Source frame</summary>

![Full Map Level source capture](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/db6855e1a0e26187dcde81490be263e2f8b137f4/full-map-source.png)

</details>

The atlas treatment preserves the broad coastline, mountain ranges, woodland regions, compass, icon column and regional names, with a deeper ocean and warmer parchment. It adds a decorative ship and alters fine geography and coloured markers. Labels look readable, but neither their exact positioning nor marker counts and positions have been verified against game data. This tests the visual direction, not geographic or information fidelity.

## Evaluation and limits

The user preferred the painted title illustration; evaluation of these new Level treatments is pending. This experiment establishes no renderer, control or simulation changes. Its main next decision is whether the painted treatment is worth pursuing for each Level. A production pipeline would keep map geometry, text, Force overlays and hit targets controlled by the existing game rather than relying on these complete generated screens.

## Exact submitted prompts

### Animation Level

```text
Use case: style-transfer
Asset type: high-resolution painted concept treatment of a gameplay screen from War in Middle Earth.
Input image 1: EDIT TARGET — the supplied gameplay capture from the running browser port. Its content, layout and visual hierarchy are the source of truth for this screen.
Input image 2: STYLE REFERENCE ONLY — the approved painted title-art direction. Borrow the hand-painted materials, nuanced colours, atmospheric depth and polished fantasy illustration finish, but do not import its rider, horse, weapon, golden sunset, landscape composition or horror subject.
Deliver one complete opaque high-resolution landscape screen, approximately 8:5, as a clean full-frame image without device frames, browser chrome, new panels, logos or invented controls. Keep the screen recognisably the same Level. This is a visual concept, not a functioning UI or an asset sheet.
Primary request: paint the Animation Level as a detailed side-on fantasy landscape. Preserve the wide blue sky and clouds, low wooded riverbank, blue river across the middle, green meadow and foreground depth bands. Interpret the small walking figures as hobbits in simple travelling cloaks, retaining their number, scale hierarchy and placement as closely as possible. Make them recognisable small travellers rather than full-size portrait characters; preserve the side-on gameplay viewpoint and open space around them.
Treatment: luminous natural daylight, rich greens and blue water, carefully painted grasses, foliage, river reflections, earthy materials and readable small figures. Use soft atmospheric distance and crisp foreground brushwork. This is a peaceful scene, not a battle.
UI: retain the small eye, map and provisions-sack icon column at the top right in exactly the same order and approximate positions, polished as readable painted game icons. Omit only the temporary parchment notification at the upper left ("FRODO passes a traveler.") to show the underlying sky cleanly. Do not add replacement text or new subjects.
```

### Campaign Level

```text
Use case: style-transfer
Asset type: high-resolution painted concept treatment of a gameplay screen from War in Middle Earth.
Input image 1: EDIT TARGET — the supplied gameplay capture from the running browser port. Its content, layout and visual hierarchy are the source of truth for this screen.
Input image 2: STYLE REFERENCE ONLY — the approved painted title-art direction. Borrow the hand-painted materials, nuanced colours, atmospheric depth and polished fantasy illustration finish, but do not import its rider, horse, weapon, golden sunset, landscape composition or horror subject.
Deliver one complete opaque high-resolution landscape screen, approximately 8:5, as a clean full-frame image without device frames, browser chrome, new panels, logos or invented controls. Keep the screen recognisably the same Level. This is a visual concept, not a functioning UI or an asset sheet.
Primary request: remaster the Campaign Level as a readable illustrated strategy map, retaining the exact TOP-DOWN projection, terrain footprints and broad map geometry. The screenshot is a local section, not the whole of Middle-earth. Keep all rivers and crossings, hill and mountain ridges, rectangular forest extents and clearings, open green plains, routes, visible Force figures and their positions. Do not turn this into an oblique landscape, invent a coastline, or relocate features.
Treatment: layered hand-painted terrain, softly varied meadow greens, individual tree crowns within the same forest boundaries, finely shaded rock ridges, clear blue waterways and subtle paths. Enrich colour and detail while keeping terrain types and tiny Force markers distinguishable at a glance. Keep the markers as small map figures or badges; do not enlarge them into portraits.
UI: preserve the right-hand vertical icon column, in the same order and positions (eye, map, magnifier, hourglass, red directional arrow). Paint these as coherent legible game icons. Preserve the narrow bottom date strip; its text reads exactly "5 p.m. September 23, 1418 S.R." Do not add place-name labels absent from the source, new legend panels or decorative title text.
```

### Full Map Level

```text
Use case: style-transfer
Asset type: high-resolution painted concept treatment of a gameplay screen from War in Middle Earth.
Input image 1: EDIT TARGET — the supplied gameplay capture from the running browser port. Its content, layout and visual hierarchy are the source of truth for this screen.
Input image 2: STYLE REFERENCE ONLY — the approved painted title-art direction. Borrow the hand-painted materials, nuanced colours, atmospheric depth and polished fantasy illustration finish, but do not import its rider, horse, weapon, golden sunset, landscape composition or horror subject.
Deliver one complete opaque high-resolution landscape screen, approximately 8:5, as a clean full-frame image without device frames, browser chrome, new panels, logos or invented controls. Keep the screen recognisably the same Level. This is a visual concept, not a functioning UI or an asset sheet.
Primary request: remaster the Full Map Level as a richly coloured hand-painted fantasy atlas. Preserve this exact Middle-earth map's coastline, islands, rivers, mountain chains, woodland footprints, regional relationships, overall bounds and compass orientation. Keep the full region visible in the same 8:5 landscape frame. The source has already been captured at its intended display aspect; do not stretch it into a tall map. Preserve top-down cartography; do not turn it into a panoramic landscape or create a new invented world.
Treatment: warm pale parchment land, deeper nuanced blue ocean with delicate coast shading, fine illustrated mountains, layered green woodland, clear blue rivers and restrained cartographic ink details. Keep the existing regional labels where they appear, retaining spelling as faithfully as possible: FORODWAITH, ARNOR, SHIRE, IRON HILLS, ROHAN, GONDOR, DAGORLAD, RHUN, MORDOR, HARAD and KHAND. Do not add extra labels or enlarge typography to cover terrain.
UI: preserve the decorative compass rose at the lower left and the four small utility icons down the upper-right edge in the same order (eye, archive parchment, magnifier, hourglass). Retain the small coloured Force dots in their existing positions and colours; treat them as crisp game overlays rather than towns or decorative paint. The result should read as the original strategic overview with richer illustration, not a generic poster.
```

## Validation

- Source and output dimensions and opacity were inspected; generated images were visually checked for layout, unintended text and obvious artifacts.
- Verified secret-gist visibility, `image/png` responses and byte-for-byte download matches for all seven new source/output PNGs.
- `bun run check` passed with exported assets present before updating the PR.
- All seven PR image embeds loaded with the expected dimensions in a browser preview of GitHub-rendered HTML.
- Project changes are Markdown only; all source and generated images remain outside the project's tracked paths.
