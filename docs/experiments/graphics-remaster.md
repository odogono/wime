# Title artwork remaster experiment

## Brief

Compare two high-resolution reinterpretations of the Reference Build's title picture: richer pixel art and a painted fantasy illustration. Keep the principal subjects and overall arrangement recognisable, with freedom to improve shapes, materials, lighting and details. The source is the sole visual reference for each initial independent edit. Subsequent edits use user-supplied box art to refine the rider in the preferred painted version. The user clarified that the rider is a Nazgûl whose face must remain unseen. V4 adds the subsequently requested glowing red eyes while keeping the rest of the face hidden; the exposed-face v2 was rejected. [Painted treatments of the three gameplay Levels](gameplay-graphics-remaster.md) extend this experiment.

This is an art-direction experiment. Judgement is at high resolution; compatibility with the current 320×200 renderer, map tiles, scenery layers and animation is outside this trial. The game and its asset loaders are unchanged.

## Source and generation

- Reference Build: Amiga v1.0, following [ADR-0003](../adr/0003-amiga-v1-canonical.md).
- Picture: `ATitle.res` IMAG 72, freshly regenerated with `bun run extract-graphics` in this checkout and visually checked for the correct warm palette. The separate logo, IMAG 73, is excluded. Existing provenance: [title picture dimensions](../findings/graphics-full-screen-art-is-320-by-200.md) and [title palette](../findings/graphics-title-screen-palette.md).
- Tool: built-in `image_gen.imagegen`, one edit call per variant; the initial calls used `referenced_image_paths` pointing to `build/graphics-remaster/source.png` and `transparent_background: false`. No CLI/API fallback was used; the built-in tool does not expose a selected model identifier here.
- Each initial call used the source directly; neither initial variant was used as input for the other. Both follow-up edits use the original `painted.png` as their edit target and `box-art-reference.png` as a supporting design reference, with `transparent_background: false`. V3 does not use the rejected v2 as an input. V4 uses `painted-v3.png` alone, adding the user-requested red eyes.
- All generated outputs are opaque PNGs saved as returned, without resizing, cropping or other post-processing.
- Local artifacts: `build/graphics-remaster/source.png`, `pixel-art.png`, `painted.png`, `painted-v2.png`, `painted-v3.png`, `painted-v4.png`, `box-art-reference.png`, `painted-v2-prompt.txt`, `painted-v3-prompt.txt`, `painted-v4-prompt.txt` and `prompts.json`. This directory is gitignored.
- Remote artifacts: [secret gist](https://gist.github.com/odogono/f6b575409714ee9a0036152250a11587), latest revision `7a4c3f6646983ccb7e447c1f80403db76b24cba5`. Anyone with its URL can view it. Image files are committed only in the separate gist, not in this project repository.

## Results

| Image                 | Dimensions | Distinct RGB colours |
| --------------------- | ---------- | -------------------- |
| Source                | 320×200    | 30                   |
| Richer pixel art      | 1586×992   | 364,398              |
| Painted illustration  | 1586×992   | 231,441              |
| Painted v2 (rejected) | 1586×992   | 234,313              |
| Painted v3 (previous) | 1586×992   | 240,329              |
| Painted v4 (red eyes) | 1586×992   | 241,783              |

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
- The user preferred the painted direction, but identified the rider design as inaccurate and supplied original box art for comparison. V2 was rejected because it showed an orc-like face. The user identified the rider as a Nazgûl with an unseen face; the user described v3 as "not bad" and requested glowing red eyes, producing v4 below.

## Rider corrections

The user preferred the painted illustration and supplied the [box-art reference](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/c1e3d2978d39dc447b3beccec5e61e04cfa2cc2d/box-art-reference.png) (1000×1500) to improve the rider detail. Its packaging, typography and borders are excluded from the artwork.

### Current treatment: Nazgûl with glowing red eyes (v4)

After the unseen-face correction, the user requested glowing red eyes. V4 uses v3 as its sole edit target and asks only for two small red lights inside the dark helmet opening. Skin, nose, mouth and teeth remain hidden; this deliberately supersedes v3's instruction to omit glowing eyes.

![Current painted Nazgûl with glowing red eyes](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/12d01c5f169d118f2980e2239cf2778c89ff3283/painted-v4.png)

[View current title treatment at full resolution](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/12d01c5f169d118f2980e2239cf2778c89ff3283/painted-v4.png). Visual inspection confirms two small red eyes in the dark opening and no exposed face. The painting is preserved closely, with minor generative texture variation. User evaluation of v4 is pending.

### Previous correction: faceless Nazgûl (v3)

The user clarified that the rider is a Nazgûl and that its face is unseen. This supersedes the assistant's mistaken exposed-face interpretation in v2.

The edit starts again from the original painted illustration, using the box art for the helmet's metal construction and silhouette. The prompt concentrates on the head, helmet and immediate collar: rounded horned helm, shaped metal brow, nasal and cheek guards, and a featureless black interior with no visible skin, eyes, mouth, teeth or tusks.

![Previous painted Nazgûl correction with unseen face](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/07effa0dd0bf2e201528893381f8b41fad9a693c/painted-v3.png)

[View previous painting at full resolution](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/07effa0dd0bf2e201528893381f8b41fad9a693c/painted-v3.png). Visual inspection confirms an empty dark face opening, with no exposed anatomy or glowing eyes. The horse, landscape framing and warm light are closely retained, although the generated image does not preserve surrounding pixels exactly. The helmet remains an interpretation of the reference. The user subsequently requested the red-eye addition shown in v4.

### Rejected correction: exposed face (v2)

The assistant misread the box-art helmet as a snarling face and explicitly requested exposed facial anatomy. The user rejected the result as orc-like. That prompt and output are retained only as a record of the failed attempt; they are not the intended rider design.

[Rejected v2 image](https://gist.githubusercontent.com/odogono/f6b575409714ee9a0036152250a11587/raw/1ca45af8cbd06d666c9003c84a034213723f2163/painted-v2.png). The earlier claim that the reference showed an exposed, tusked face was incorrect and has been removed from the experiment's descriptive text.

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

### Rejected painted revision (v2)

This historical prompt contains the mistaken exposed-face instruction that caused the rejected result.

```text
Use case: precise-object-edit
Asset type: targeted revision of a painted title-art remaster.
Input image 1: EDIT TARGET — the landscape painted illustration. Preserve its canvas, crop, rider position and pose, left-facing horse, diagonal lance, warm golden lighting, trees, landscape, and hand-painted rendering style.
Input image 2: RIDER DESIGN REFERENCE ONLY — the user-supplied original War in Middle Earth box art. Study the mounted rider in the lower third of the box, especially the face, helmet and torso armour. The box rider and horse face the opposite direction from the edit target: adapt/mirror that design to the target's existing orientation, without flipping the landscape.
Primary request: correct ONLY the mounted rider's character design in image 1 to closely resemble the rider depicted on the box art. The central correction is an exposed grotesque snarling face, with a broad snout/nose and large protruding pale tusks/fangs around the open mouth. Make this a visible living face beneath an OPEN-FACED helmet, not a closed metal faceplate, skull-shaped visor, faceless shadow, or generic ornate knight mask. Match the reference's dark grey-brown facial skin and expressive mouth and eyes.
Helmet and armour: use the reference's rounded domed steel helmet with its two swept curved horns and the simpler broad plate armour: rounded shoulder plates, curved breastplate with rolled/spiral ornament, rivets, articulated arm protection, leather straps and belts. Reduce the elaborate pointed gold filigree and dense invented gothic spikes on the target rider. Keep the reference's distinctive rider silhouette, adapting the details to the painting's existing body pose and golden light.
Preserve everything outside the rider as closely as possible, especially the horse design, background, landscape composition, colours, lighting, lance position and framing. Keep the same hand-painted finish and high-resolution landscape proportions as image 1. Do not reproduce the box's typography, borders, logos, packaging layout, eagle or off-white paper background. Output one complete opaque painting with no text or comparison panels.
```

### Previous Nazgûl correction (v3)

```text
Use case: precise-object-edit
Asset type: correction to a painted War in Middle Earth title-art experiment.
Input image 1: EDIT TARGET — the original landscape painted illustration. Keep its composition, canvas, horse, lance, rider body and pose, trees, golden lighting and painterly style.
Input image 2: HELMET DESIGN REFERENCE — the original box art, specifically the horned rider's head in the lower part. Use the helmet's silhouette and metal construction; adapt its orientation to image 1. Do not copy packaging or typography.
Primary request: correct the rider's head and helmet. The rider is a NAZGUL / RINGWRAITH, an unseen wraith occupying armour. Its face must be COMPLETELY INVISIBLE. Inside the helmet is deep featureless black shadow: no visible skin, eyes, nose, mouth, teeth, tusks or any biological facial anatomy.
Helmet design: match the box art's rounded domed metal helm, two swept curved horns, and angular metal brow, nasal and cheek guards. Clearly render every visible contour around the face opening as shaped STEEL ARMOUR. The openings between the metal guards reveal only black emptiness. Use an entirely dark cowl or shadowed interior beneath the helmet so that there is no readable face. The helmet is worn by a faceless Nazgul, not an orc, goblin, human face, skull or creature. Do not add glowing eyes. Keep metal highlights consistent with the existing warm lighting.
Edit only the rider's head, helmet and immediate collar as necessary. Preserve the rest of image 1 as closely as possible, including its body armour, horse design, lance position, background and crop. Deliver one opaque high-resolution landscape painting, with no text, logos, borders or comparison panels.
```

### Red-eye addition (v4)

```text
Use case: precise-object-edit
Edit target: supplied painted landscape of the mounted Nazgul, painted-v3.
Change only one detail: add TWO small, menacing, glowing deep-red eyes within the existing black face opening beneath the rider's horned helmet. Their glow should be clearly readable but restrained, with a faint red reflection on the immediately adjacent inner metal edges. Keep all other facial features completely invisible: the interior remains black shadow, without a visible face, skin, mouth or teeth. Preserve the helmet shape, rider, horse, lance, landscape, golden lighting, crop, dimensions and painterly finish as closely as possible. Do not add text, borders, extra subjects or alter the horse's eyes. Output one complete opaque landscape painting.
```

## Validation

- Regenerated assets with `bun run extract-all`, which ran `bun run export:web` before the checks.
- `bun run check` passed, including asset-dependent tests with exported assets present.
- The gist API reports `public: false`. Each revision-specific raw image URL returns `image/png`, and the downloaded bytes match the local PNG exactly.
- All current result embeds loaded successfully in a browser preview of GitHub-rendered Markdown, with the expected natural image dimensions.
- The correction and box-art reference URLs also return `image/png`, and their downloaded bytes match the local files exactly.
- Title image binaries stay outside tracked project paths and are not integrated into the game. The later [layered river prototype](layered-river-prototype.md) adds standalone experiment source, separate from the production renderer.
