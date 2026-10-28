// The Atlas map's prototype page: the map on its own with a live sim, a
// readout of the band and tiers, and `?at=x,y,zoom` to open anywhere.
// The game uses the same map behind its Map setting
// (docs/spec/atlas-map.md).
import {
  createSim,
  forcesOnMap,
  tickSim,
  type Force,
  type SimState
} from '../../sim/index';
import { loadCampaignAssets } from '../assets';
import { createAtlasMap } from './atlas-map';

const canvas = document.querySelector<HTMLCanvasElement>('#atlas')!;
const hud = document.querySelector<HTMLElement>('#hud')!;

const assets = await loadCampaignAssets();
const atlas = await createAtlasMap(canvas);
let sim: SimState = createSim(0x14_18, assets.startingState, assets.terrain);
let running = false;
const selected = new Set<number>();
addEventListener('resize', atlas.resize);

// Start over Rivendell at the Campaign Level's scale, or where `?at=`
// says, its zoom a multiple of the Campaign Level's scale.
const rivendell = atlas.bundle.places.find(p =>
  p.name.toUpperCase().includes('RIVENDELL')
);
if (rivendell) {
  atlas.centreOn(rivendell);
}
const at = new URLSearchParams(location.search)
  .get('at')
  ?.split(',')
  .map(Number);
if (at?.length === 3 && at.every(Number.isFinite)) {
  atlas.camera.zoom = atlas.range().campaign * at[2]!;
  atlas.centreOn({ x: at[0]!, y: at[1]! });
}

const isImportant = (force: Force): boolean =>
  selected.has(force.leader.index) ||
  (sim.ringBearer !== null &&
    force.members.some(m => m.index === sim.ringBearer));

let last = performance.now();
const frame = (now: number): void => {
  const elapsed = now - last;
  last = now;
  if (running) {
    sim = tickSim(sim);
  }
  atlas.draw(
    forcesOnMap(sim.roster),
    {
      flashOn: true,
      important: isImportant,
      ringBearer: sim.ringBearer,
      selected
    },
    elapsed
  );
  const band = atlas.band();
  hud.innerHTML = [
    `<b>${band === 'campaign' ? 'Campaign Level' : 'Full Map Level'}</b> band · zoom ${(atlas.camera.zoom / atlas.range().campaign).toFixed(2)}× Campaign`,
    `${running ? 'Running' : 'Paused'} (space) · click a Force to select it · Home fits the map`
  ].join('<br>');
  requestAnimationFrame(frame);
};

// Input: wheel and pinch zoom about the pointer, drag to pan, click to
// select.
canvas.addEventListener(
  'wheel',
  event => {
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    atlas.zoomAt(Math.exp(-delta * 0.0015), {
      x: event.clientX,
      y: event.clientY
    });
  },
  { passive: false }
);
const pointers = new Map<number, { x: number; y: number }>();
let moved = 0;
canvas.addEventListener('pointerdown', event => {
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  moved = 0;
});
canvas.addEventListener('pointermove', event => {
  const previous = pointers.get(event.pointerId);
  if (!previous) {
    return;
  }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.entries()].map(([id, p]) =>
      id === event.pointerId ? { x: event.clientX, y: event.clientY } : p
    );
    const [oa, ob] = [...pointers.values()];
    const before = Math.hypot(oa!.x - ob!.x, oa!.y - ob!.y);
    const after = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    if (before > 0) {
      atlas.zoomAt(after / before, {
        x: (a!.x + b!.x) / 2,
        y: (a!.y + b!.y) / 2
      });
    }
  } else {
    atlas.panBy(event.clientX - previous.x, event.clientY - previous.y);
  }
  moved +=
    Math.abs(event.clientX - previous.x) + Math.abs(event.clientY - previous.y);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
});
const release = (event: PointerEvent): void => {
  if (pointers.size === 1 && moved < 4) {
    const force = atlas.forceAt({ x: event.clientX, y: event.clientY });
    if (force) {
      const id = force.leader.index;
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
    }
  }
  pointers.delete(event.pointerId);
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
addEventListener('keydown', event => {
  if (event.key === ' ') {
    running = !running;
    event.preventDefault();
  } else if (event.key === 'Home') {
    atlas.flyTo({ zoom: atlas.range().min });
  } else if (event.key === '+' || event.key === '=') {
    atlas.zoomAt(1.25, { x: innerWidth / 2, y: innerHeight / 2 });
  } else if (event.key === '-') {
    atlas.zoomAt(0.8, { x: innerWidth / 2, y: innerHeight / 2 });
  }
});

requestAnimationFrame(frame);
