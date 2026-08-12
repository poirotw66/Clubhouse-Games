import type { TowerType } from '../game/constants';
import type { Enemy } from '../game/types';

const cache = new Map<string, HTMLImageElement>();

function load(path: string): HTMLImageElement {
  let img = cache.get(path);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = `${import.meta.env.BASE_URL}${path}`;
    cache.set(path, img);
  }
  return img;
}

export function towerSprite(type: TowerType): HTMLImageElement {
  return load(`towers/${type}.jpg`);
}

export function enemySprite(type: Enemy['type']): HTMLImageElement {
  return load(`enemies/${type}.jpg`);
}

/** Draw centered sprite; returns false if not ready yet (caller may fall back). */
export function drawCenteredSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  size: number,
): boolean {
  if (!img.complete || img.naturalWidth === 0) return false;
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  return true;
}

/** Kick off loads so first draw rarely falls back. */
export function preloadBattlefieldSprites(): void {
  for (const t of ['crossbow', 'grinder', 'frost', 'coil'] as const) towerSprite(t);
  for (const e of ['grunt', 'runner', 'ironclad', 'kite', 'boss'] as const) enemySprite(e);
}
