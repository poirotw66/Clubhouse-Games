import type {CharacterDef} from '../data/characters';
import type {PropKind} from '../data/tracks';
import {renderSheet, type Brick, type SpriteSheet} from './brickModel';
import {SPRITE_ANGLES} from './constants';
import {
  homingBrickBricks,
  itemBrickBricks,
  kartBricks,
  oilBrickBricks,
  propBricks,
  shieldBrickBricks,
} from './models';

const ELEVATION = (18 * Math.PI) / 180;
const COS_E = Math.cos(ELEVATION);
const SIN_E = Math.sin(ELEVATION);

/**
 * Measures the model across every yaw step so each sheet can pick the largest
 * scale that still fits, and so the ground anchor is exact.
 */
function fitSheet(bricks: Brick[], size: number, angles: number, pad: number) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let a = 0; a < angles; a++) {
    const yaw = (a / angles) * Math.PI * 2;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    for (const b of bricks) {
      for (const dx of [-1, 1]) {
        for (const dy of [-1, 1]) {
          for (const dz of [-1, 1]) {
            const x = b.x + (dx * b.w) / 2;
            const y = b.y + (dy * b.d) / 2;
            const z = b.z + (dz * b.h) / 2 + (dz > 0 && b.studs ? 0.18 : 0);
            const px = x * cy - y * sy;
            const py = x * sy + y * cy;
            const sx = px;
            const sYy = -z * COS_E + py * SIN_E;
            if (sx < minX) minX = sx;
            if (sx > maxX) maxX = sx;
            if (sYy < minY) minY = sYy;
            if (sYy > maxY) maxY = sYy;
          }
        }
      }
    }
  }

  const usable = size - pad * 2;
  const scale = Math.min(usable / (maxX - minX), usable / (maxY - minY));
  const anchorX = size / 2 - ((minX + maxX) / 2) * scale;
  const anchorY = pad - minY * scale;
  return {scale, anchorX, anchorY};
}

function build(bricks: Brick[], size: number, angles: number, pad = 4): SpriteSheet {
  const fit = fitSheet(bricks, size, angles, pad);
  const sheet = renderSheet(bricks, {size, scale: fit.scale, anchorY: fit.anchorY, angles});
  sheet.anchorX = fit.anchorX;
  return sheet;
}

export interface SpriteLibrary {
  karts: Map<string, SpriteSheet>;
  itemBrick: SpriteSheet;
  oil: SpriteSheet;
  homing: SpriteSheet;
  shield: SpriteSheet;
  props: Map<PropKind, SpriteSheet>;
}

let library: SpriteLibrary | null = null;

export function getSprites(characters: CharacterDef[]): SpriteLibrary {
  if (library) return library;

  const karts = new Map<string, SpriteSheet>();
  for (const c of characters) karts.set(c.id, build(kartBricks(c), 128, SPRITE_ANGLES));

  const props = new Map<PropKind, SpriteSheet>();
  const kinds: PropKind[] = ['tree', 'cone', 'sign', 'lamp', 'cactus', 'block'];
  for (const kind of kinds) props.set(kind, build(propBricks(kind), 96, 1));

  library = {
    karts,
    itemBrick: build(itemBrickBricks(), 72, SPRITE_ANGLES),
    oil: build(oilBrickBricks(), 64, 8),
    homing: build(homingBrickBricks(), 56, SPRITE_ANGLES),
    shield: build(shieldBrickBricks(), 40, 8),
    props,
  };
  return library;
}

/** Sprite frame for a yaw in radians. */
export function frameFor(sheet: SpriteSheet, yaw: number): HTMLCanvasElement {
  const n = sheet.frames.length;
  if (n === 1) return sheet.frames[0];
  let i = Math.round((yaw / (Math.PI * 2)) * n) % n;
  if (i < 0) i += n;
  return sheet.frames[i];
}
