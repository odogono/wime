// The Animation Level (docs/spec/animation-level.md): a scene built once
// when the Level is entered, the watched Force's figures crossing it,
// and the icon column.
import {
  isWide,
  layoutScene,
  placeClouds,
  sceneStep,
  skyColour,
  type SceneStrip,
  type SceneTilemap,
  type SpecialScenery
} from './animation-scene';
import type { AnimationAssets, AnimationIcon } from './assets';
import {
  STOPPED,
  newFigure,
  startScript,
  stepFigure,
  type Figure,
  type ScriptWorld
} from './figure-script';

export const SCENE_WIDTH = 320;
export const SCENE_HEIGHT = 200;

const drawStrip = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number },
  x: number,
  y: number,
  mirrored: boolean
): void => {
  if (!mirrored) {
    ctx.drawImage(image, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x + image.width, y);
  ctx.scale(-1, 1);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
};

// Every strip a scene draws, in order, after the sky's clouds.
export const sceneStrips = (
  assets: AnimationAssets,
  tilemap: SceneTilemap,
  position: { x: number; y: number },
  facing: number,
  special?: SpecialScenery
): { dark: boolean; strips: SceneStrip[] } => {
  const step = sceneStep(tilemap, assets.tables.scene_words, position, facing);
  return {
    dark: step.dark,
    strips: layoutScene(assets.tables, step, position, special)
  };
};

// Build the scene for the watched Character into a 320 by 200 canvas:
// the sky for the hour, clouds by day, then the scenery strips
// (code+0x00006).
export const buildScene = (
  canvas: HTMLCanvasElement,
  assets: AnimationAssets,
  tilemap: SceneTilemap,
  watched: { facing: number; position: { x: number; y: number } },
  quarterHour: number,
  random: (n: number) => number,
  special?: SpecialScenery
): void => {
  canvas.width = SCENE_WIDTH;
  canvas.height = SCENE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D is not available');
  }
  const { dark, strips } = sceneStrips(
    assets,
    tilemap,
    watched.position,
    watched.facing,
    special
  );
  ctx.fillStyle =
    assets.palette[skyColour(assets.tables, quarterHour, dark)] ?? '#000';
  ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
  for (const cloud of placeClouds(quarterHour, dark, random)) {
    const image = assets.strips.get(cloud.id);
    if (image) {
      drawStrip(ctx, image, cloud.x, cloud.y, cloud.mirrored);
    }
  }
  for (const strip of strips) {
    const image = assets.strips.get(strip.id);
    if (!image) {
      continue;
    }
    drawStrip(ctx, image, strip.x, strip.y, strip.mirrored);
    if (isWide(strip.id)) {
      drawStrip(ctx, image, strip.x + SCENE_WIDTH, strip.y, strip.mirrored);
    }
  }
};

// Each icon's top left, centred on the original's point.
export const iconBox = (
  icon: AnimationIcon
): { height: number; width: number; x: number; y: number } => ({
  height: icon.image.height,
  width: icon.image.width,
  x: icon.x - Math.floor(icon.image.width / 2),
  y: icon.y - Math.floor(icon.image.height / 2)
});

export const drawAnimationIcons = (
  ctx: CanvasRenderingContext2D,
  icons: AnimationIcon[]
): void => {
  for (const icon of icons) {
    const box = iconBox(icon);
    ctx.drawImage(icon.image, box.x, box.y);
  }
};

export const animationIconAt = (
  icons: AnimationIcon[],
  point: { x: number; y: number }
): AnimationIcon | undefined =>
  icons.find(icon => {
    const box = iconBox(icon);
    return (
      point.x >= box.x &&
      point.x < box.x + box.width &&
      point.y >= box.y &&
      point.y < box.y + box.height
    );
  });

// The watched Force's figures crossing the scene.
export interface Stage {
  figures: Figure[];
  // The party's count, for the laggard line (data+0x555d).
  party: number;
}

export interface StageMember {
  figure: number;
  index: number;
  strength: number;
}

// The original's start column and figure rows (code+0x0a316, code+0x09ffa).
const START_X = -10;
const PARTY_Y = 165;
const PARTY_DEPTH = 150;
const WALK_ENTRY = 2;
export const MAX_FIGURES = 50;

// The figures shown for a member: at most 10, and at most 3 riders
// (figure 13) or 5 Ents (figure 7) once there are more than five.
export const figureCount = (strength: number, figure: number): number => {
  const count = Math.min(strength & 0xff, 10);
  if (count <= 5) {
    return count;
  }
  return figure === 13 ? 3 : figure === 7 ? 5 : count;
};

// Place the party's figures in a column reaching left from x -10, each
// a random 0 to 29 pixels further (75 for riders and Ents), in rows
// two pixels apart, and set them walking (code+0x0b0de). Members whose
// figure is a still picture are left out of the walking party; talks
// draw them as pictures.
export const spawnParty = (
  members: StageMember[],
  world: Omit<ScriptWorld, 'laggardLine'>,
  random: (n: number) => number
): Stage => {
  const figures: Figure[] = [];
  let x = START_X;
  members.forEach((member, k) => {
    let range = 30;
    let slot = (k % 7) * 2;
    if (member.figure === 13) {
      range = 75;
    }
    if (member.figure === 7) {
      slot = (k % 5) * 2 + 4;
      range = 75;
    }
    const count = Math.min(
      figureCount(member.strength, member.figure),
      MAX_FIGURES - figures.length
    );
    let last = 0;
    for (let j = 0; j < count; j++) {
      if (count > 1) {
        while (slot === last) {
          slot = random(5) * 2;
        }
        if (member.figure === 7) {
          slot = random(3) * 2 + 4;
        }
        last = slot;
      }
      if (member.figure >= 20) {
        continue;
      }
      x -= random(range);
      const figure = newFigure(
        { ...world, laggardLine: 0 },
        member.figure,
        0,
        x,
        PARTY_Y + slot,
        PARTY_DEPTH + slot,
        member.index
      );
      figures.push(startScript(figure, WALK_ENTRY));
    }
  });
  return { figures, party: members.length };
};

// The leftmost figure's x, or 1000 with none (code+0x0b1c0).
export const leftmostX = (stage: Stage): number =>
  stage.figures.reduce(
    (min, figure) => (figure.depth & 1 ? min : Math.min(min, figure.x)),
    1000
  );

// Every figure due by `vbl` runs its script.
export const stepStage = (
  stage: Stage,
  world: Omit<ScriptWorld, 'laggardLine'>,
  vbl: number
): Stage => {
  const laggardLine = stage.party * 16 + leftmostX(stage);
  return {
    ...stage,
    figures: stage.figures.map(figure =>
      figure.next !== STOPPED && vbl >= figure.next
        ? stepFigure(figure, { ...world, laggardLine }, vbl)
        : figure
    )
  };
};

// The level goes up by itself once the party has walked off the right
// edge (code+0x0b220, finding:ui-animation-level-figures-walk-off).
export const walkedOff = (stage: Stage): boolean =>
  stage.figures.length > 0 && leftmostX(stage) > 330;

// Draw the figures, nearer (higher depth) last; a mirrored frame is
// flipped within its own box.
export const drawFigures = (
  ctx: CanvasRenderingContext2D,
  assets: AnimationAssets,
  stage: Stage
): void => {
  const order = [...stage.figures].sort((a, b) => a.depth - b.depth);
  for (const figure of order) {
    const set = assets.figures.get(figure.frml);
    const frame = set?.frames[figure.frame];
    if (!set || !frame) {
      continue;
    }
    ctx.save();
    if (figure.flipped) {
      ctx.translate(figure.x + frame.width, figure.y);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(figure.x, figure.y);
    }
    ctx.drawImage(
      set.sheet,
      frame.x,
      // Colour selection is shared with the ending picture
      // (finding:graphics-figure-colour-selectors).
      set.colour_rows[assets.tables.figure_colours[figure.owner] ?? 0] ?? 0,
      frame.width,
      frame.height,
      0,
      0,
      frame.width,
      frame.height
    );
    ctx.restore();
  }
};

// The script world of the Animation Level's assets.
export const scriptWorld = (
  assets: AnimationAssets,
  random: (n: number) => number
): Omit<ScriptWorld, 'laggardLine'> => ({
  frames: frml => assets.figures.get(frml)?.frames ?? [],
  // provisional: the battle lines are not set on a walk; they are put
  // out of reach.
  line1: 1000,
  line2: 1000,
  random,
  script: frml => assets.tables.figure_scripts[frml] ?? []
});
