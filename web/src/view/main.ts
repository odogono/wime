import {
  createSim,
  forcesOnMap,
  formatClock,
  fullMapDots,
  giveOrder,
  mirrorListing,
  restoreSave,
  serialiseSave,
  tickSim,
  type Force,
  type SimState
} from '../sim/index';
import {
  ARCHIVE_MESSAGES,
  archiveButtonAt,
  archiveMenu,
  archiveMessage,
  drawArchiveWindow,
  type ArchiveWindow
} from './archive-window';
import {
  blackToTransparent,
  loadCampaignAssets,
  loadFullMapAssets,
  type CampaignAssets
} from './assets';
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
  cameraForFight,
  combatHoldsTime,
  drawCombatUi,
  pressCombatUi,
  startCombatUi,
  stepCombatUi,
  type CombatUi
} from './combat-window';
import {
  drawInfoWindow,
  forceWindowLines,
  layoutInfoWindow,
  type InfoWindow
} from './force-window';
import {
  BLINK_PHASE_MS,
  campaignCameraFor,
  drawFullMapLevel,
  fullMapIconAt,
  fullMapIconPlacements,
  type FullMapLevel
} from './full-map-level';
import {
  drawMirrorWindow,
  layoutMirrorWindow,
  type MirrorWindow
} from './mirror-window';
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
// The original picks some combat message wordings at random; the view
// may, since the wording changes nothing in the sim.
const choose = (n: number): number => Math.floor(Math.random() * n);
// A press that moves no further than this is a click, not a drag.
const CLICK_TOLERANCE_PX = 3;

// The Level on show; the game opens on the Campaign Level.
type Level = 'campaign' | 'full-map';

const run = (assets: CampaignAssets, fullMap: FullMapLevel): void => {
  let level: Level = 'campaign';
  // On the Full Map Level, whether the pointer is the magnifying glass,
  // waiting for a click on the map to go down to (manual, pdf-p9).
  let zooming = false;
  let hiresPointer: Camera | null = null;
  let mirror: MirrorWindow | null = null;
  let archive: ArchiveWindow | null = null;
  // The single save slot (finding:ui-single-save-slot). Game Speed and
  // the camera are not saved, and a restore stays on this Level.
  const ARCHIVE_KEY = 'wime.archive';
  const saveGame = (): ArchiveWindow => {
    try {
      localStorage.setItem(ARCHIVE_KEY, serialiseSave(sim));
      return archiveMessage(ARCHIVE_MESSAGES.saved);
    } catch {
      return archiveMessage(ARCHIVE_MESSAGES.saveFailed);
    }
  };
  const restoreGame = (): ArchiveWindow => {
    const data = localStorage.getItem(ARCHIVE_KEY);
    const result = data === null ? null : restoreSave(data, assets.tilemap);
    if (!result || (!result.ok && result.reason === 'invalid')) {
      return archiveMessage(ARCHIVE_MESSAGES.noArchive);
    }
    if (!result.ok) {
      return archiveMessage(ARCHIVE_MESSAGES.otherVersion);
    }
    sim = result.state;
    return archiveMessage(ARCHIVE_MESSAGES.restored);
  };
  // The Archive window, from the scroll or A (finding:ui-archive-window).
  const openArchive = (): void => {
    mirror = null;
    speedWindow = null;
    zooming = false;
    canvas.style.cursor = 'default';
    archive = archiveMenu();
  };
  // Galadriel's Mirror, from the eye or S (docs/spec/full-map.md).
  const toggleMirror = (): void => {
    mirror = mirror
      ? null
      : layoutMirrorWindow(mirrorListing(sim.roster, sim.places));
  };
  const fullMapPlacements = fullMapIconPlacements(fullMap.icons);
  const magnifier = fullMap.icons.find(
    icon => icon.name === 'magnifying-glass'
  );
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
  // The fight's announcement or combat window, while a fight is on
  // (docs/spec/combat.md).
  let combat: CombatUi | null = null;
  let lastTime = performance.now();

  // The pointer in native pixels; hi-res pixels are half as wide.
  const toNative = (event: PointerEvent, xScale = 1): Camera => {
    const rect = canvas.getBoundingClientRect();
    const deviceX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const deviceY = (event.clientY - rect.top) * (canvas.height / rect.height);
    return {
      x: Math.floor(((deviceX - fit.x) * xScale) / fit.scale),
      y: Math.floor((deviceY - fit.y) / fit.scale)
    };
  };
  const toHires = (event: PointerEvent): Camera => toNative(event, 2);

  // Up to the Full Map Level (manual, pdf-p3). Any half-given Order or
  // open window is dropped, as when a decision window opens
  // (finding:ui-pointer-and-icon-column).
  const goUp = (): void => {
    level = 'full-map';
    zooming = false;
    mirror = null;
    archive = null;
    speedWindow = null;
    infoWindow = null;
    drag = null;
    pointer = null;
    setOrder(IDLE_ORDER);
    canvas.style.cursor = 'default';
  };

  const startZoom = (): void => {
    zooming = true;
    canvas.style.cursor = magnifier ? 'none' : 'zoom-in';
  };

  // Down to the Campaign Level, centred on the clicked spot.
  const goDown = (point: Camera): void => {
    camera = campaignCameraFor(point, assets.tilemap);
    level = 'campaign';
    zooming = false;
    hiresPointer = null;
    setOrder(IDLE_ORDER);
  };

  const handleFullMapPress = (event: PointerEvent): void => {
    const point = toHires(event);
    // A press on a button acts on it; anywhere else clears the window.
    if (archive) {
      const button = archiveButtonAt(archive, point);
      archive = button
        ? button.choice === 'save'
          ? saveGame()
          : restoreGame()
        : null;
      return;
    }
    // A press anywhere clears the Mirror.
    if (mirror) {
      mirror = null;
      return;
    }
    // The Game Speed window is laid out in lo-res pixels, as on the
    // Campaign Level, so a hi-res point is halved across.
    if (speedWindow) {
      pressSpeedWindow({ x: Math.floor(point.x / 2), y: point.y });
      return;
    }
    const icon = fullMapIconAt(fullMapPlacements, point);
    if (icon?.icon.name === 'scroll') {
      openArchive();
    } else if (icon?.icon.name === 'eye') {
      zooming = false;
      canvas.style.cursor = 'default';
      toggleMirror();
    } else if (icon?.icon.name === 'hourglass') {
      zooming = false;
      canvas.style.cursor = 'default';
      toggleSpeedWindow();
    } else if (icon?.icon.name === 'magnifying-glass') {
      if (zooming) {
        zooming = false;
        canvas.style.cursor = 'default';
      } else {
        startZoom();
      }
    } else if (zooming && !icon) {
      goDown(point);
    }
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

  // The one Game Speed window, opened under the hourglass of either
  // Level; the setting is shared (manual, pdf-p13).
  const toggleSpeedWindow = (): void => {
    if (speedWindow) {
      speedWindow = null;
      return;
    }
    const hourglass =
      level === 'full-map'
        ? fullMapPlacements.find(p => p.icon.name === 'hourglass')
        : placements.find(p => p.icon.name === 'hourglass');
    speedWindow = layoutSpeedWindow(
      318,
      hourglass ? hourglass.y + hourglass.icon.image.height + 2 : 2,
      driver.paused
    );
  };

  // A press while the Game Speed window is open picks an option, if
  // any, and closes the window.
  const pressSpeedWindow = (point: Camera): void => {
    if (!speedWindow) {
      return;
    }
    const option = speedWindowOptionAt(speedWindow, point.x, point.y);
    if (option?.value === 'pause') {
      driver.paused = !driver.paused;
    } else if (option) {
      driver.speed = option.value;
      driver.paused = false;
    }
    speedWindow = null;
  };

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', event => {
    if (level === 'full-map') {
      handleFullMapPress(event);
      return;
    }
    pointer = toNative(event);
    // A fight's windows take every press while they hold the game.
    if (combat && (combatHoldsTime(combat) || combat.kind === 'boxes')) {
      const before = combat;
      const result = pressCombatUi(combat, sim, pointer, performance.now());
      sim = result.sim;
      combat = result.ui;
      // "Go there" brings the fight into view.
      if (
        before.kind === 'announcement' &&
        combat?.kind === 'window' &&
        sim.fight
      ) {
        camera = clampCamera(
          cameraForFight(sim.fight.position, camera, {
            height: viewHeightPx(assets.tilemap),
            width: viewWidthPx(assets.tilemap)
          }),
          assets.tilemap
        );
      }
      return;
    }
    if (speedWindow) {
      pressSpeedWindow(pointer);
      return;
    }
    const icon = iconAt(placements, pointer);
    if (icon?.icon.name === 'map') {
      goUp();
      return;
    }
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
    if (level === 'full-map') {
      hiresPointer = toHires(event);
      return;
    }
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
    hiresPointer = null;
    if (!drag) {
      pointer = null;
    }
  });
  window.addEventListener('resize', () => {
    fit = screen.resize();
  });
  window.addEventListener('keydown', event => {
    // The original's keys: U goes up a Level, M picks up the
    // magnifying glass, T opens the Game Speed window and P pauses
    // (finding:ui-key-bindings). The Campaign Level's magnifying
    // glass waits for the Animation Level.
    const key = event.key.toLowerCase();
    if (level === 'full-map') {
      if (archive) {
        archive = null;
        return;
      }
      if (key === 'a') {
        openArchive();
        return;
      }
      if (key === 's') {
        speedWindow = null;
        zooming = false;
        canvas.style.cursor = 'default';
        toggleMirror();
        return;
      }
      if (mirror) {
        mirror = null;
        if (key !== 'escape') {
          return;
        }
      }
      if (key === 'm') {
        speedWindow = null;
        startZoom();
      } else if (key === 't') {
        zooming = false;
        canvas.style.cursor = 'default';
        toggleSpeedWindow();
      } else if (key === 'escape') {
        zooming = false;
        speedWindow = null;
        canvas.style.cursor = 'default';
      }
      return;
    }
    // Nothing else is open to the player while a fight holds the game.
    if (combatHoldsTime(combat)) {
      return;
    }
    if (key === 'u') {
      goUp();
    } else if (event.key === 't' || event.key === 'T') {
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
    if (
      !combat &&
      !infoWindow &&
      !speedWindow &&
      !drag &&
      order.kind === 'idle'
    ) {
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
    if (combat) {
      drawCombatUi(ctx, combat, sim);
    }
  };

  const frame = (now: number): void => {
    const elapsedMs = Math.min(1000, now - lastTime);
    lastTime = now;
    // Game time does not pass on the Full Map Level
    // (finding:time-stops-on-full-map-level).
    if (level === 'full-map') {
      drawFullMapLevel(
        screen.hires,
        fullMap,
        fullMapDots(sim.roster),
        Math.floor(now / BLINK_PHASE_MS) % 2 === 0
      );
      // The pointer becomes the magnifying glass, centred on the spot.
      if (zooming && magnifier && hiresPointer) {
        screen.hires.drawImage(
          magnifier.image,
          hiresPointer.x - Math.floor(magnifier.image.width / 2),
          hiresPointer.y - Math.floor(magnifier.image.height / 2)
        );
      }
      if (mirror) {
        drawMirrorWindow(screen.hires, mirror);
      }
      if (archive) {
        drawArchiveWindow(screen.hires, archive);
      }
      if (speedWindow) {
        // Drawn at lo-res size: each of its pixels is two hi-res wide.
        screen.hires.save();
        screen.hires.setTransform(2, 0, 0, 1, 0, 0);
        drawSpeedWindow(screen.hires, speedWindow, driver.speed, driver.paused);
        screen.hires.restore();
      }
      screen.present('hires');
      requestAnimationFrame(frame);
      return;
    }
    if (combat) {
      const result = stepCombatUi(combat, sim, now, choose);
      sim = result.sim;
      combat = result.ui;
    }
    // Game time stands still while a fight holds the game
    // (finding:time-stops-during-a-fight); the ticks due are dropped.
    const ticks = driver.advance(elapsedMs);
    for (let i = 0; i < ticks && !combatHoldsTime(combat) && !sim.fight; i++) {
      sim = tickSim(sim);
      if (sim.fight) {
        combat = startCombatUi(sim, now);
        speedWindow = null;
        infoWindow = null;
        drag = null;
        setOrder(IDLE_ORDER);
      }
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
  const [campaign, fullMap] = await Promise.all([
    loadCampaignAssets(),
    loadFullMapAssets()
  ]);
  run(campaign, {
    ...fullMap,
    // Their black backgrounds are masked out like the Campaign Level's
    // icon sheet; how the original masked them is provisional.
    icons: fullMap.icons.map(icon => ({
      ...icon,
      image: blackToTransparent(icon.image)
    }))
  });
} catch (error) {
  drawMessage([
    'Campaign Level assets are missing.',
    'Run: bun run export:web',
    '',
    error instanceof Error ? error.message : String(error)
  ]);
}
