import { createSim, formatClock, tickSim, type SimState } from '../sim/index';
import { loadCampaignAssets, type CampaignAssets } from './assets';
import {
  dragCamera,
  drawCampaignLevel,
  edgeScrollDirection,
  iconPlacements,
  isOverIcons,
  stepCamera,
  type Camera,
  type IconPlacement
} from './campaign-level';
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

const run = (assets: CampaignAssets): void => {
  const placements = iconPlacements(assets.icons);
  const driver = createTickDriver();
  let sim: SimState = createSim(0x14_18);
  let camera: Camera = { x: 0, y: 0 };
  let fit: Fit = screen.resize();
  let pointer: Camera | null = null;
  let drag: { camera: Camera; pointer: Camera } | null = null;
  let speedWindow: SpeedWindow | null = null;
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
  const endDrag = (): void => {
    drag = null;
    canvas.style.cursor = 'grab';
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
    }
  });

  const drawOverlay = (): void => {
    const ctx = screen.buffer;
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    // The date line sits in the strip below the 192px map view
    // (provisional placement, docs/spec/time.md).
    ctx.fillText(formatClock(sim.clock), 2, 192);
    if (driver.paused) {
      ctx.fillStyle = '#000';
      ctx.fillRect(8, 8, 118, 12);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(8.5, 8.5, 117, 11);
      ctx.fillStyle = '#fff';
      ctx.fillText('The Game is Paused.', 11, 10);
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
    drawCampaignLevel(screen.buffer, assets, camera);
    drawOverlay();
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
