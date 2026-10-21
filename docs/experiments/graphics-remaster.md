# Title artwork remaster experiment

## Brief

Compare two high-resolution reinterpretations of the Reference Build's title picture: richer pixel art and a painted fantasy illustration. Keep the principal subjects and overall arrangement recognisable, with freedom to improve shapes, materials, lighting and details. The source is the sole visual reference for each initial independent edit. A subsequent targeted revision uses user-supplied box art to refine the rider in the preferred painted version.

This is an art-direction experiment. Judgement is at high resolution; compatibility with the current 320×200 renderer, map tiles, scenery layers and animation is outside this trial. The game and its asset loaders are unchanged.

## Source and generation

- Reference Build: Amiga v1.0, following [ADR-0003](../adr/0003-amiga-v1-canonical.md).
- Picture: `ATitle.res` IMAG 72, freshly regenerated with `bun run extract-graphics` in this checkout and visually checked for the correct warm palette. The separate logo, IMAG 73, is excluded. Existing provenance: [title picture dimensions](../findings/graphics-full-screen-art-is-320-by-200.md) and [title palette](../findings/graphics-title-screen-palette.md).
- Tool: built-in `image_gen.imagegen`, one edit call per variant; the initial calls used `referenced_image_paths` pointing to `build/graphics-remaster/source.png` and `transparent_background: false`. No CLI/API fallback was used; the built-in tool does not expose a selected model identifier here.
- Each initial call used the source directly; neither initial variant was used as input for the other. The revision uses `painted.png` as its edit target and `box-art-reference.png` as a rider-design reference, with `transparent_background: false`.
- All generated outputs are opaque PNGs saved as returned, without resizing, cropping or other post-processing.
- Local artifacts: `build/graphics-remaster/source.png`, `pixel-art.png`, `painted.png`, `painted-v2.png`, `box-art-reference.png`, `painted-v2-prompt.txt` and `prompts.json`. This directory is gitignored.
- Remote artifacts: [secret gist](https://gist.github.com/odogono/f6b575409714ee9a0036152250a11587), latest revision `c23640332affddb95cbec68d44ef328bcc0e8842`. Anyone with its URL can view it. Image files are committed only in the separate gist, not in this project repository.

## Results

| Image                | Dimensions | Distinct RGB colours |
| -------------------- | ---------- | -------------------- |
| Source               | 320×200    | 30                   |
| Richer pixel art     | 1586×992   | 364,398              |
| Painted illustration | 1586×992   | 231,441              |
| Painted revision     | 1586×992   | 234,313              |

The counts describe the saved PNGs. The pixel-art variant is a visual style experiment, not a constrained palette or a verified uniform pixel grid.

### Source

![Source title artwork](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/45b9930735b312a91f8963ac113aed29db985464/source.png)

[View source at full resolution](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/45b9930735b312a91f8963ac113aed29db985464/source.png).

### Richer pixel art

![Richer pixel-art title interpretation](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/97fa6d985f03f11f05f8682e58d52743c53cd6be/pixel-art.png)

[View pixel-art result at full resolution](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/97fa6d985f03f11f05f8682e58d52743c53cd6be/pixel-art.png).

### Painted illustration

![Painted title interpretation](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/b08f9cfa02cad5cb3732539ae4b1e93d32e385ba/painted.png)

[View painted result at full resolution](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/b08f9cfa02cad5cb3732539ae4b1e93d32e385ba/painted.png).

## Initial observations

- Both retain the mounted warrior, left-facing horse, diagonal lance, tree framing and warm backlight. They use visibly richer shading and material detail.
- The pixel-art version has stepped edges and clustered colour texture; the painted version has smoother contours, softer lighting transitions and brush-like texture. Their overall colours and silhouettes remain similar, making the difference in surface treatment the clearest comparison.
- Both reinterpret the armour extensively and add distant architectural forms and cloud detail. These are generated artistic additions, not evidence about the Reference Build. Neither result should be described as an exact recolouring.
- Visual inspection found no unintended lettering, logo or obvious extra characters. Dense reins, armour ornaments and the lance grip remain areas for closer scrutiny when judging a favourite.
- The user preferred the painted direction, but identified the rider design as inaccurate and supplied original box art for comparison. The planned targeted revision is recorded below; acceptance of that revision remains pending.

## Targeted painted revision

The user selected the painted illustration and requested a rider closer to the [user-supplied box-art reference](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/c1e3d2978d39dc447b3beccec5e61e04cfa2cc2d/box-art-reference.png) (1000×1500). The first painting had replaced the exposed, snarling face with a closed metal mask. This revision concentrates on the visible tusked face, open-faced domed horned helmet and broader, simpler plate armour.

The painted landscape is the edit target, and the box art is a second, supporting image. The box's rider faces the opposite direction from the landscape, so the prompt asks for its design to be adapted to the existing pose. The box typography, borders and packaging are excluded. This supporting reference is an intentional change from the initial source-only experiment.

![Painted revision with box-art rider detail](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/1ca45af8cbd06d666c9003c84a034213723f2163/painted-v2.png)

[View revised painting at full resolution](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/1ca45af8cbd06d666c9003c84a034213723f2163/painted-v2.png). The initial painting above remains available for comparison.

The result exposes a snarling face with prominent teeth, replaces the closed mask with an open-faced helmet, and uses broader rounded plates on the torso and shoulders. It retains the horse, landscape framing and warm painted light closely, although this generative edit does not preserve surrounding pixels exactly. The rider's expression, head angle and armour remain interpretations rather than an exact reproduction of the box art. No further generation has been performed after this single targeted revision.

## Exact submitted prompts

The same source PNG was supplied with each initial prompt. The revision inputs are identified in its prompt below. These are the full prompt strings sent to the built-in tool.

### Richer pixel art

```text
Use case: style-transfer
Asset type: high-resolution title artwork remaster experiment for War in Middle Earth.
Input image: the supplied 320x200 title picture is the sole visual reference and edit target; it contains no logo.
Primary request: reinterpret this picture with richer colours, shading and detail while keeping its scene recognisable.
Scene and composition: a dark armoured mounted warrior on an armoured horse facing left, a tall diagonal lance, pale warm golden light behind them, trees framing the upper and side edges, a dark earthy foreground. Retain these principal subjects and their overall arrangement. Use the source's landscape 8:5 framing, showing the complete picture.
Creative freedom: improve shapes, armour, materials, lighting and small details where useful; this is an artistic remaster rather than pixel-exact restoration.
Constraints: one complete high-resolution artwork, opaque background, no text, no logo, no watermark, no added characters, no panels or comparison layout. Keep the source as the sole visual reference.
Style/medium: refined fantasy PIXEL ART. Intentional visible square pixel clusters, crisp stepped contours, carefully designed pixel shading and rich coherent colour ramps. Add depth and material definition with more colours than the source. Keep the pixel-art character clearly visible even in this high-resolution output; avoid smooth painted brushwork and photographic rendering.
```

### Painted illustration

```text
Use case: style-transfer
Asset type: high-resolution title artwork remaster experiment for War in Middle Earth.
Input image: the supplied 320x200 title picture is the sole visual reference and edit target; it contains no logo.
Primary request: reinterpret this picture with richer colours, shading and detail while keeping its scene recognisable.
Scene and composition: a dark armoured mounted warrior on an armoured horse facing left, a tall diagonal lance, pale warm golden light behind them, trees framing the upper and side edges, a dark earthy foreground. Retain these principal subjects and their overall arrangement. Use the source's landscape 8:5 framing, showing the complete picture.
Creative freedom: improve shapes, armour, materials, lighting and small details where useful; this is an artistic remaster rather than pixel-exact restoration.
Constraints: one complete high-resolution artwork, opaque background, no text, no logo, no watermark, no added characters, no panels or comparison layout. Keep the source as the sole visual reference.
Style/medium: detailed hand-painted fantasy illustration. Natural painted contours, nuanced colour transitions, expressive brushwork, convincing metal and leather, atmospheric golden light and deep coloured shadows. Keep the composition recognisable while reinterpreting its small low-resolution shapes into a coherent painted image. This variant should clearly read as a painting rather than pixel art or a photograph.
```

### Painted revision

```text
Use case: precise-object-edit
Asset type: targeted revision of a painted title-art remaster.
Input image 1: EDIT TARGET — the landscape painted illustration. Preserve its canvas, crop, rider position and pose, left-facing horse, diagonal lance, warm golden lighting, trees, landscape, and hand-painted rendering style.
Input image 2: RIDER DESIGN REFERENCE ONLY — the user-supplied original War in Middle Earth box art. Study the mounted rider in the lower third of the box, especially the face, helmet and torso armour. The box rider and horse face the opposite direction from the edit target: adapt/mirror that design to the target's existing orientation, without flipping the landscape.
Primary request: correct ONLY the mounted rider's character design in image 1 to closely resemble the rider depicted on the box art. The central correction is an exposed grotesque snarling face, with a broad snout/nose and large protruding pale tusks/fangs around the open mouth. Make this a visible living face beneath an OPEN-FACED helmet, not a closed metal faceplate, skull-shaped visor, faceless shadow, or generic ornate knight mask. Match the reference's dark grey-brown facial skin and expressive mouth and eyes.
Helmet and armour: use the reference's rounded domed steel helmet with its two swept curved horns and the simpler broad plate armour: rounded shoulder plates, curved breastplate with rolled/spiral ornament, rivets, articulated arm protection, leather straps and belts. Reduce the elaborate pointed gold filigree and dense invented gothic spikes on the target rider. Keep the reference's distinctive rider silhouette, adapting the details to the painting's existing body pose and golden light.
Preserve everything outside the rider as closely as possible, especially the horse design, background, landscape composition, colours, lighting, lance position and framing. Keep the same hand-painted finish and high-resolution landscape proportions as image 1. Do not reproduce the box's typography, borders, logos, packaging layout, eagle or off-white paper background. Output one complete opaque painting with no text or comparison panels.
```

## Validation

- Regenerated assets with `bun run extract-all`, which ran `bun run export:web` before the checks.
- `bun run check` passed, including asset-dependent tests with exported assets present.
- The gist API reports `public: false`. Each revision-specific raw image URL returns `image/png`, and the downloaded bytes match the local PNG exactly.
- All four result embeds loaded successfully in a browser preview of GitHub-rendered Markdown, with the expected natural image dimensions.
- The revision and box-art reference URLs also return `image/png`, and their downloaded bytes match the local files exactly.
- Project changes contain Markdown only. No image files or runtime changes are included.
