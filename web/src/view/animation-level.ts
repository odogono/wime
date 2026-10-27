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
  SPELL_FLASH,
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

// An object lying on the ground, drawn as its picture, BScene.res
// IMAG 50 plus the object (finding:objects-lying-on-the-ground-are-pictures).
export interface GroundPicture {
  depth: number;
  object: number;
  // Top left.
  x: number;
  y: number;
}

// A member fetching or putting down an object: its figure runs the
// object script, and these remember what to do at its events
// (finding:objects-take-is-a-walk-to-the-picture-and-back,
// finding:objects-put-down-is-a-stoop-in-place).
export interface Errand {
  // Facing and x as it set off (data+0x5563, data+0x556c).
  facing: boolean;
  kind: 'put-down' | 'take';
  object: number;
  owner: number;
  startX: number;
}

// The watched Force's figures crossing the scene.
export interface Stage {
  errand?: Errand | null;
  figures: Figure[];
  // A spell moves its caster's battle line (finding:graphics-spell-flash).
  lines?: Pick<ScriptWorld, 'line1' | 'line2'>;
  // The party's count, for the laggard line (data+0x555d).
  party: number;
  pictures?: GroundPicture[];
  // Put Down's picture is down and its message is due, until taken.
  putDownDue?: boolean;
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
  let figures = stage.figures.slice();
  let pictures = stage.pictures ?? [];
  let errand = stage.errand ?? null;
  let putDownDue = stage.putDownDue ?? false;
  const scripts: ScriptWorld = {
    ...world,
    ...stage.lines,
    ...(errand ? { facing: errand.facing } : {}),
    castSpell: (flash, line, x) => {
      // Remove only spent flashes; combatant indices stay stable for combat.
      // The original does this on each cast (finding:graphics-spell-flash).
      figures = figures.filter(
        figure => figure.frml !== SPELL_FLASH || figure.x <= 320
      );
      figures.push(flash);
      scripts[line] = x;
    },
    laggardLine,
    objectEvent: (event, figure) => {
      if (!errand || figure.owner !== errand.owner) {
        return;
      }
      if (event === 1) {
        // Taken up: the picture goes off screen and the walk back is to
        // where the figure set off from.
        const taken = errand.object;
        pictures = pictures.map(picture =>
          picture.object === taken ? { ...picture, y: 200 } : picture
        );
        scripts.line1 = errand.startX;
      } else if (event === 2) {
        // Put down: the picture lies at the figure's feet, behind every
        // figure, and the message is due.
        if (pictures.length < MAX_PICTURES) {
          pictures = [
            ...pictures,
            {
              depth: PUT_DOWN_DEPTH,
              object: errand.object,
              x: figure.x - 2,
              y: PUT_DOWN_Y
            }
          ];
        }
        putDownDue = true;
      } else {
        errand = null;
      }
    }
  };
  // New flashes run alongside the other figures, including on this update.
  for (let i = 0; i < figures.length; i++) {
    const figure = figures[i]!;
    if (figure.next !== STOPPED && vbl >= figure.next) {
      // A cast can drop spent flashes and shift indices, so find the
      // figure again after stepping it.
      const stepped = stepFigure(figure, scripts, vbl);
      figures[figures.indexOf(figure)] = stepped;
    }
  }
  return {
    ...stage,
    errand,
    figures,
    lines: { line1: scripts.line1, line2: scripts.line2 },
    pictures,
    putDownDue
  };
};

// Object pictures in a scene: at most six, the first placements lying
// exactly where the watched Character stands, each at x 200 plus up
// to 39, top at 165 and depth 0x99
// (finding:objects-on-the-ground-drawn-when-the-scene-is-built).
export const MAX_PICTURES = 6;
const GROUND_DEPTH = 0x99;
const GROUND_Y = 165;
const PUT_DOWN_DEPTH = 0x95;
const PUT_DOWN_Y = 161;
const TAKE_ENTRY = 0xd4;
const PUT_DOWN_ENTRY = 0xde;

export const groundPictures = (
  placements: readonly ({
    object: number;
    position: { x: number; y: number };
  } | null)[],
  at: { x: number; y: number },
  random: (n: number) => number
): GroundPicture[] =>
  placements
    .filter(
      placement =>
        placement !== null &&
        placement.position.x === at.x &&
        placement.position.y === at.y
    )
    .slice(0, MAX_PICTURES)
    .map(placement => ({
      depth: GROUND_DEPTH,
      object: placement!.object,
      x: 200 + random(40),
      y: GROUND_Y
    }));

// Send the member's figure for an object: Take walks to its picture
// and back, Put Down stoops where it stands. Without a figure, or for
// Take without the picture, the stage is left as it is (null).
export const startErrand = (
  stage: Stage,
  kind: Errand['kind'],
  owner: number,
  object: number
): Stage | null => {
  const index = stage.figures.findIndex(figure => figure.owner === owner);
  const figure = stage.figures[index];
  if (!figure) {
    return null;
  }
  const picture = (stage.pictures ?? []).find(
    candidate => candidate.object === object && candidate.y < 200
  );
  if (kind === 'take' && !picture) {
    return null;
  }
  const figures = stage.figures.slice();
  figures[index] = startScript(
    figure,
    kind === 'take' ? TAKE_ENTRY : PUT_DOWN_ENTRY
  );
  return {
    ...stage,
    errand: {
      facing: figure.flipped,
      kind,
      object,
      owner,
      startX: figure.x
    },
    figures,
    lines: {
      line1: picture?.x ?? stage.lines?.line1 ?? 1000,
      line2: stage.lines?.line2 ?? 1000
    }
  };
};

// Put Down's message is due once its picture is down, whether or not
// the errand has run to its end in the same step.
export const takeLanded = (stage: Stage): { due: boolean; stage: Stage } =>
  stage.putDownDue
    ? { due: true, stage: { ...stage, putDownDue: false } }
    : { due: false, stage };

// The level goes up by itself once the party has walked off the right
// edge (code+0x0b220, finding:ui-animation-level-figures-walk-off).
export const walkedOff = (stage: Stage): boolean =>
  stage.figures.length > 0 && leftmostX(stage) > 330;

// Draw the figures and the object pictures, nearer (higher depth) last;
// a mirrored frame is flipped within its own box.
export const drawFigures = (
  ctx: CanvasRenderingContext2D,
  assets: AnimationAssets,
  stage: Stage
): void => {
  const order = [
    ...stage.figures.map(figure => ({ depth: figure.depth, figure })),
    ...(stage.pictures ?? []).map(picture => ({
      depth: picture.depth,
      picture
    }))
  ].sort((a, b) => a.depth - b.depth);
  for (const item of order) {
    if ('picture' in item) {
      const image = assets.objectPictures.get(item.picture.object);
      if (image && item.picture.y < 200) {
        ctx.drawImage(image, item.picture.x, item.picture.y);
      }
      continue;
    }
    const { figure } = item;
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
