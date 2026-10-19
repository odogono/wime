import { loadCampaignAssets, type CampaignAssets } from './assets';
import {
  dragCamera,
  drawCampaignLevel,
  edgeScrollDirection,
  iconPlacements,
  isOverIcons,
  stepCamera,
  type Camera
} from './campaign-level';
import { createScreen, type Fit } from './screen';

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

const run = (assets: CampaignAssets): void => {
  const placements = iconPlacements(assets.icons);
  let camera: Camera = { x: 0, y: 0 };
  let fit: Fit = screen.resize();
  let pointer: Camera | null = null;
  let drag: { camera: Camera; pointer: Camera } | null = null;
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

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', event => {
    pointer = toNative(event);
    // Drags starting on an icon are for the icon, not the map.
    if (!isOverIcons(pointer, placements)) {
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

  const frame = (now: number): void => {
    const dtSeconds = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    // Hovering the icon column does not scroll the map under it, and
    // dragging pans instead of edge scrolling.
    const direction =
      drag || (pointer && isOverIcons(pointer, placements))
        ? { x: 0, y: 0 }
        : edgeScrollDirection(pointer, assets.tilemap);
    camera = stepCamera(camera, direction, dtSeconds, assets.tilemap);
    drawCampaignLevel(screen.buffer, assets, camera);
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
