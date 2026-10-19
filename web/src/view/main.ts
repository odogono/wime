import {
  createSim,
  forcesOnMap,
  formatClock,
  giveOrder,
  tickSim,
  type Force,
  type SimState
} from '../sim/index';
import { loadCampaignAssets, type CampaignAssets } from './assets';
import {
  clampCamera,
  dragCamera,
  drawCampaignLevel,
  edgeScrollDirection,
  hoverTargetAt,
  iconPlacements,
  isOverIcons,
  stepCamera,
  viewHeightPx,
  viewWidthPx,
  type Camera,
  type IconPlacement
} from './campaign-level';
import {
  drawInfoWindow,
  forceWindowLines,
  layoutInfoWindow,
  type InfoWindow
} from './force-window';
import {
  IDLE_ORDER,
  drawOrderPointerTag,
  drawOrderWindow,
  isInOrderWindow,
  layoutOrderWindow,
  orderWindowOptionAt,
  pickForceAt,
  pickMember,
  toggleOrder,
  type OrderState,
  type OrderWindow
} from './order-window';
import { createScreen, type Fit } from './screen';
import {
  drawSpeedWindow,
  layoutSpeedWindow,
  speedWindowOptionAt,
  type SpeedWindow
} from './speed-window';
import { createTickDriver } from './tick-driver';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
if (!canvas) {
  throw new Error('No #screen canvas');
}
const screen = createScreen(canvas);

const drawMessage = (lines: string[]): void => {
  screen.resize();
  const ctx = screen.buffer;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 320, 200);
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, 8, 8 + i * 10));
  screen.present();
};

const iconAt = (
  placements: IconPlacement[],
  pointer: Camera
): IconPlacement | undefined =>
  placements.find(
    ({ icon, x, y }) =>
      pointer.x >= x &&
      pointer.x < x + icon.image.width &&
      pointer.y >= y &&
      pointer.y < y + icon.image.height
  );

// How long an active Force's icon stays in each half of its flash
// (finding:ui-campaign-level-display). The original's rate has not
// been traced; this is provisional.
const FLASH_INTERVAL_MS = 500;
// A press that moves no further than this is a click, not a drag.
const CLICK_TOLERANCE_PX = 3;

const run = (assets: CampaignAssets): void => {
  const placements = iconPlacements(assets.icons);
  const driver = createTickDriver();
  let sim: SimState = createSim(0x14_18, assets.startingState, assets.tilemap);
  // Open on the Ring-bearer's Force at Hobbiton, the one Force the
  // player commands at the start (docs/spec/starting-state.md). The
  // game itself opens on the Animation Level, which is not built yet.
  const opening = forcesOnMap(sim.roster).find(
    force => force.leader.index === sim.ringBearer
  );
  let camera: Camera = opening
    ? clampCamera(
        {
          x: opening.position.x + 8 - viewWidthPx(assets.tilemap) / 2,
          y: opening.position.y + 8 - viewHeightPx(assets.tilemap) / 2
        },
        assets.tilemap
      )
    : { x: 0, y: 0 };
  let fit: Fit = screen.resize();
  let pointer: Camera | null = null;
  let drag: { camera: Camera; pointer: Camera } | null = null;
  let speedWindow: SpeedWindow | null = null;
  let infoWindow: InfoWindow | null = null;
  let order: OrderState = IDLE_ORDER;
  let lastTime = performance.now();

  const toNative = (event: PointerEvent): Camera => {
    const rect = canvas.getBoundingClientRect();
    const deviceX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const deviceY = (event.clientY - rect.top) * (canvas.height / rect.height);
    return {
      x: Math.floor((deviceX - fit.x) / fit.scale),
      y: Math.floor((deviceY - fit.y) / fit.scale)
    };
  };

  // The map point under the pointer, or null outside the map view.
  const mapPoint = (native: Camera | null): Camera | null =>
    native &&
    native.x >= 0 &&
    native.x < viewWidthPx(assets.tilemap) &&
    native.y >= 0 &&
    native.y < viewHeightPx(assets.tilemap)
      ? { x: native.x + camera.x, y: native.y + camera.y }
      : null;

  const targetAt = (native: Camera | null, forces: Force[]) => {
    const point = mapPoint(native);
    return point
      ? hoverTargetAt(forces, sim.places, sim.placeKinds, assets.tilemap, point)
      : null;
  };

  // The Order window for the Force being ordered, rebuilt from the
  // live roster each time so it tracks the Force while it moves.
  const orderWindowFor = (): OrderWindow | null => {
    const current = order;
    if (current.kind !== 'pick-destination') {
      return null;
    }
    const force = forcesOnMap(sim.roster).find(
      candidate => candidate.leader.index === current.leaderIndex
    );
    return force ? layoutOrderWindow(force, sim.places) : null;
  };

  const setOrder = (next: OrderState): void => {
    order = next;
    canvas.style.cursor = order.kind === 'idle' ? 'grab' : 'crosshair';
  };

  // A press while an Order is being given (finding:ui-giving-an-order):
  // pick the Force, pick a member in its window, or set the destination.
  const handleOrderClick = (native: Camera): void => {
    const window = orderWindowFor();
    if (window && isInOrderWindow(window, native.x, native.y)) {
      const option = orderWindowOptionAt(window, native.x, native.y);
      if (option) {
        setOrder(pickMember(order, option.memberIndex));
      }
      return;
    }
    const point = mapPoint(native);
    if (!point) {
      return;
    }
    if (order.kind === 'pick-force') {
      setOrder(pickForceAt(order, forcesOnMap(sim.roster), point));
    } else if (order.kind === 'pick-destination') {
      sim = giveOrder(sim, order.selected, point);
      setOrder(IDLE_ORDER);
    }
  };

  const toggleSpeedWindow = (): void => {
    if (speedWindow) {
      speedWindow = null;
      return;
    }
    const hourglass = placements.find(p => p.icon.name === 'hourglass');
    speedWindow = layoutSpeedWindow(
      318,
      hourglass ? hourglass.y + hourglass.icon.image.height + 2 : 2,
      driver.paused
    );
  };

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', event => {
    pointer = toNative(event);
    if (speedWindow) {
      const option = speedWindowOptionAt(speedWindow, pointer.x, pointer.y);
      if (option?.value === 'pause') {
        driver.paused = !driver.paused;
      } else if (option) {
        driver.speed = option.value;
        driver.paused = false;
      }
      speedWindow = null;
      return;
    }
    const icon = iconAt(placements, pointer);
    // The arrow starts or cancels an Order (#10).
    if (icon?.icon.name === 'arrow') {
      infoWindow = null;
      setOrder(toggleOrder(order));
      return;
    }
    // While an Order is being given, presses pick the Force, a
    // member or the destination instead of panning the map; edge
    // scrolling still reaches a distant destination.
    if (order.kind !== 'idle' && !icon) {
      handleOrderClick(pointer);
      return;
    }
    // A press anywhere clears an open window, as with the original's
    // status window (manual, pdf-p14).
    if (infoWindow) {
      infoWindow = null;
      return;
    }
    if (icon?.icon.name === 'hourglass') {
      toggleSpeedWindow();
      return;
    }
    // Drags starting on an icon are for the icon, not the map.
    if (!icon) {
      drag = { camera, pointer };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    }
  });
  canvas.addEventListener('pointermove', event => {
    pointer = toNative(event);
    if (drag) {
      camera = dragCamera(drag.camera, drag.pointer, pointer, assets.tilemap);
    }
  });
  const endDrag = (event: PointerEvent): void => {
    if (drag) {
      const released = toNative(event);
      const moved = Math.max(
        Math.abs(released.x - drag.pointer.x),
        Math.abs(released.y - drag.pointer.y)
      );
      // A press that did not pan is a click: it opens the window at
      // the top left naming what was clicked (manual, pdf-p16).
      if (moved <= CLICK_TOLERANCE_PX) {
        camera = drag.camera;
        const target = targetAt(released, forcesOnMap(sim.roster));
        infoWindow =
          target?.kind === 'force'
            ? layoutInfoWindow(forceWindowLines(target.force))
            : target
              ? layoutInfoWindow([target.name])
              : null;
      }
    }
    drag = null;
    canvas.style.cursor = order.kind === 'idle' ? 'grab' : 'crosshair';
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => {
    if (!drag) {
      pointer = null;
    }
  });
  window.addEventListener('resize', () => {
    fit = screen.resize();
  });
  window.addEventListener('keydown', event => {
    // The original's keys: T opens the Game Speed window, P pauses
    // (finding:ui-key-bindings).
    if (event.key === 't' || event.key === 'T') {
      toggleSpeedWindow();
    } else if (event.key === 'p' || event.key === 'P') {
      driver.paused = !driver.paused;
    } else if (event.key === 'Escape') {
      speedWindow = null;
      infoWindow = null;
      setOrder(IDLE_ORDER);
    }
  });

  const drawOverlay = (forces: Force[]): void => {
    const ctx = screen.buffer;
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    // The date line sits in the strip below the 192px map view
    // (provisional placement, docs/spec/time.md).
    ctx.fillText(formatClock(sim.clock), 2, 192);
    if (driver.paused && order.kind === 'idle') {
      ctx.fillStyle = '#000';
      ctx.fillRect(8, 8, 118, 12);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(8.5, 8.5, 117, 11);
      ctx.fillStyle = '#fff';
      ctx.fillText('The Game is Paused.', 11, 10);
    }
    if (order.kind === 'pick-force') {
      drawInfoWindow(ctx, layoutInfoWindow(['Select a Force']));
    }
    if (order.kind === 'pick-destination') {
      const window = orderWindowFor();
      if (window) {
        drawOrderWindow(ctx, window, order.selected);
      } else {
        setOrder(IDLE_ORDER);
      }
      if (pointer) {
        drawOrderPointerTag(ctx, pointer);
      }
    }
    // Hovering names the Place, Character or Unit under the pointer
    // in the same top-left window a click would open.
    if (!infoWindow && !speedWindow && !drag && order.kind === 'idle') {
      const overIcons = pointer !== null && isOverIcons(pointer, placements);
      const target = overIcons ? null : targetAt(pointer, forces);
      if (target) {
        drawInfoWindow(ctx, layoutInfoWindow([target.name]));
      }
    }
    if (infoWindow) {
      drawInfoWindow(ctx, infoWindow);
    }
    if (speedWindow) {
      drawSpeedWindow(ctx, speedWindow, driver.speed, driver.paused);
    }
  };

  const frame = (now: number): void => {
    const elapsedMs = Math.min(1000, now - lastTime);
    lastTime = now;
    for (let i = 0, ticks = driver.advance(elapsedMs); i < ticks; i++) {
      sim = tickSim(sim);
    }
    // Hovering the icon column does not scroll the map under it, and
    // dragging pans instead of edge scrolling.
    const direction =
      drag || (pointer && isOverIcons(pointer, placements))
        ? { x: 0, y: 0 }
        : edgeScrollDirection(pointer, assets.tilemap);
    camera = stepCamera(camera, direction, elapsedMs / 1000, assets.tilemap);
    const forces = forcesOnMap(sim.roster);
    const flashOn = Math.floor(now / FLASH_INTERVAL_MS) % 2 === 0;
    drawCampaignLevel(screen.buffer, assets, camera, forces, flashOn);
    drawOverlay(forces);
    screen.present();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

drawMessage(['Loading Campaign Level...']);

try {
  run(await loadCampaignAssets());
} catch (error) {
  drawMessage([
    'Campaign Level assets are missing.',
    'Run: bun run export:web',
    '',
    error instanceof Error ? error.message : String(error)
  ]);
}
