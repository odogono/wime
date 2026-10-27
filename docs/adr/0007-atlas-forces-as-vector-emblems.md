# The Atlas map draws Forces as its own vector emblems

ADR-0006 drew the Atlas map's nearest Force tier with the original's pixel sprites, crisp between one and three times their size. Beside ink-on-parchment geography they read as pasted on, and the size rule forces a tier drop rather than a smooth zoom. We decided that the Atlas map draws Forces as emblems of our own, authored as SVG in the repo and drawn by the WebGL renderer from a signed distance field atlas, so they scale freely. A Character has its own heraldic device, or its Faction's for lesser Characters; a Unit has an ink shield composed from its Nation's device and a mark for its Unit Type. The tiers become Emblem, Compact (the emblem's simplified outline in the Side colour), Dot and Aggregate. This supersedes ADR-0006's sprite clause only. The Classic map and the Animation Level keep the original's sprites, so fidelity (ADR-0003) is still available in Classic.

## Considered Options

- Keep the pixel sprites (ADR-0006): faithful, but at odds with the Atlas look.
- Repaint the sprites as higher-resolution bitmaps: still fixed-size, and a lot of art for each scale.
- Use generated art as it comes: inconsistent and hard to edit. Generated images may be traced into an emblem's device, but each emblem is fitted by hand to the style sheet (docs/spec/atlas-emblems.md) and committed as SVG.
