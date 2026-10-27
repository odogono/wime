# The Atlas map draws Forces as its own vector emblems

ADR-0006 drew the Atlas map's nearest Force tier with the original's pixel sprites, crisp between one and three times their size. Beside ink-on-parchment geography they read as pasted on, and the size rule forces a tier drop rather than a smooth zoom. We decided that the Atlas map draws Forces as emblems of our own, authored as SVG in the repo and drawn by the WebGL renderer from a signed distance field atlas, so they scale freely. A Character stands on a banner bearing a silhouette of its own, drawn from its Figure in the original where it has one; the original's sharing of Figures and Badges between Characters came from its limits, so named Characters are told apart here. A Unit has an ink shield, round or for elite troops heraldic, composed from its Nation's device and a mark for its Unit Type; its Nation and Unit Type are read from its Badge in the original, with exceptions where that Badge does not fit it. The tiers become Emblem, Compact (the emblem's simplified outline in the Side colour), Dot and Aggregate. This supersedes ADR-0006's sprite clause only. The Classic map and the Animation Level keep the original's sprites, so fidelity (ADR-0003) is still available in Classic.

## Considered Options

- Keep the pixel sprites (ADR-0006): faithful, but at odds with the Atlas look.
- Repaint the sprites as higher-resolution bitmaps: still fixed-size, and a lot of art for each scale.
- Draw each Character with its Figure or Badge in the original, shared as there: faithful, but Gimli would be a hobbit and Shelob a troll.
- Give each Character a heraldic device, or its Faction's for lesser Characters: the Atlas look, but it loses the original's figures, which say at a glance who a Character is.
- Use generated art as it comes: inconsistent and hard to edit. Generated images may be traced into an emblem's device, but each emblem is fitted by hand to the style sheet (docs/spec/atlas-emblems.md) and committed as SVG.
