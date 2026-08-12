const cache = new Map<string, HTMLImageElement>();

function load(path: string): HTMLImageElement {
  let img = cache.get(path);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = `${import.meta.env.BASE_URL ?? '/'}${path}`;
    cache.set(path, img);
  }
  return img;
}

export function fieldSkyImage(): HTMLImageElement {
  return load('field-sky.jpg');
}

export function fieldGrassImage(): HTMLImageElement {
  return load('field-grass.jpg');
}

export function fieldDirtImage(): HTMLImageElement {
  return load('field-dirt.jpg');
}

export function batterPortrait(): HTMLImageElement {
  return load('portraits/batter.jpg');
}

export function pitcherPortrait(): HTMLImageElement {
  return load('portraits/pitcher.jpg');
}

function drawPortrait(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  size: number,
): boolean {
  if (!img.complete || img.naturalWidth === 0) return false;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
  return true;
}

export function drawBatterSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size = 36,
): boolean {
  return drawPortrait(ctx, batterPortrait(), cx, cy, size);
}

export function drawPitcherSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size = 32,
): boolean {
  return drawPortrait(ctx, pitcherPortrait(), cx, cy, size);
}
