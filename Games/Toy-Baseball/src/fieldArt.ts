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
