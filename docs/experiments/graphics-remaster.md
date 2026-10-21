# Title artwork remaster experiment

## Brief

Compare two high-resolution reinterpretations of the Reference Build's title picture: richer pixel art and a painted fantasy illustration. Keep the principal subjects and overall arrangement recognisable, with freedom to improve shapes, materials, lighting and details. The source is the sole visual reference for each independent edit.

This is an art-direction experiment. Judgement is at high resolution; compatibility with the current 320×200 renderer, map tiles, scenery layers and animation is outside this trial. The game and its asset loaders are unchanged.

## Source and generation

- Reference Build: Amiga v1.0, following [ADR-0003](../adr/0003-amiga-v1-canonical.md).
- Picture: `ATitle.res` IMAG 72, freshly regenerated with `bun run extract-graphics` in this checkout and visually checked for the correct warm palette. The separate logo, IMAG 73, is excluded. Existing provenance: [title picture dimensions](../findings/graphics-full-screen-art-is-320-by-200.md) and [title palette](../findings/graphics-title-screen-palette.md).
- Tool: built-in `image_gen.imagegen`, one edit call per variant, with `referenced_image_paths` pointing to `build/graphics-remaster/source.png` and `transparent_background: false`. No CLI/API fallback was used; the built-in tool does not expose a selected model identifier here.
- Each call used the source directly; neither variant was used as input for the other.
- Both outputs are opaque PNGs saved as returned, without resizing, cropping or other post-processing.
- Local artifacts: `build/graphics-remaster/source.png`, `pixel-art.png`, `painted.png` and `prompts.json`. This directory is gitignored.
- Remote artifacts: [secret gist](https://gist.github.com/odogono/f6b575409714ee9a0036152250a11587), revision `8fb13218ab79ed6e2a6650ad9c0957149d397d3b`. Anyone with its URL can view it. Image files are committed only in the separate gist, not in this project repository.

## Results

| Image                | Dimensions | Distinct RGB colours |
| -------------------- | ---------- | -------------------- |
| Source               | 320×200    | 30                   |
| Richer pixel art     | 1586×992   | 364,398              |
| Painted illustration | 1586×992   | 231,441              |

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
- User preference is pending. Two initial generations are complete; one targeted revision remains available after feedback. No revision was generated automatically.

## Exact submitted prompts

The same source PNG was supplied with each prompt. These are the full prompt strings sent to the built-in tool.

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

## Validation

- Regenerated assets with `bun run extract-all`, which ran `bun run export:web` before the checks.
- `bun run check` passed, including asset-dependent tests with exported assets present.
- The gist API reports `public: false`. Each revision-specific raw image URL returns `image/png`, and the downloaded bytes match the local PNG exactly.
- All three embeds loaded successfully in a browser preview of GitHub-rendered Markdown, with the expected natural image dimensions.
- Project changes contain Markdown only. No image files or runtime changes are included.
