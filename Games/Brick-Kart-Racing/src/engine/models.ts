import type {CharacterDef} from '../data/characters';
import type {PropKind} from '../data/tracks';
import type {Brick} from './brickModel';

const TYRE = '#23262d';
const METAL = '#3a3f4a';
const SKIN = '#ffd21e';

/** Kart plus driver. Faces -Y; the origin sits on the ground between the wheels. */
export function kartBricks(c: CharacterDef): Brick[] {
  return [
    // Wheels
    {x: -1.85, y: -1.9, z: 0.75, w: 0.9, d: 1.7, h: 1.5, color: TYRE},
    {x: 1.85, y: -1.9, z: 0.75, w: 0.9, d: 1.7, h: 1.5, color: TYRE},
    {x: -2.0, y: 1.9, z: 0.85, w: 1.0, d: 1.9, h: 1.7, color: TYRE},
    {x: 2.0, y: 1.9, z: 0.85, w: 1.0, d: 1.9, h: 1.7, color: TYRE},

    // Chassis
    {x: 0, y: 0, z: 1.0, w: 3.2, d: 5.4, h: 0.9, color: c.body},
    {x: 0, y: -2.4, z: 1.55, w: 2.8, d: 1.4, h: 0.5, color: c.body, studs: [3, 1]},
    {x: -1.75, y: 0.2, z: 1.5, w: 0.5, d: 3.4, h: 1.0, color: c.accent},
    {x: 1.75, y: 0.2, z: 1.5, w: 0.5, d: 3.4, h: 1.0, color: c.accent},

    // Cockpit
    {x: 0, y: 0.9, z: 1.7, w: 2.0, d: 1.6, h: 0.5, color: METAL},
    {x: 0, y: -0.5, z: 1.9, w: 0.25, d: 0.9, h: 0.25, color: TYRE},
    {x: 0, y: -0.9, z: 2.25, w: 1.2, d: 0.3, h: 0.9, color: TYRE},
    {x: 0, y: 1.85, z: 2.5, w: 2.2, d: 0.5, h: 1.8, color: c.accent},

    // Engine and spoiler
    {x: 0, y: 2.5, z: 1.9, w: 2.4, d: 1.0, h: 1.2, color: METAL, studs: [2, 1]},
    {x: -0.9, y: 2.9, z: 2.5, w: 0.3, d: 0.3, h: 1.0, color: TYRE},
    {x: 0.9, y: 2.9, z: 2.5, w: 0.3, d: 0.3, h: 1.0, color: TYRE},
    {x: 0, y: 2.9, z: 3.1, w: 3.0, d: 0.8, h: 0.3, color: c.accent},

    // Driver
    {x: 0, y: 0.7, z: 1.9, w: 1.5, d: 1.0, h: 0.9, color: '#2a3550'},
    {x: -1.05, y: 0.4, z: 2.7, w: 0.45, d: 1.4, h: 0.45, color: c.accent},
    {x: 1.05, y: 0.4, z: 2.7, w: 0.45, d: 1.4, h: 0.45, color: c.accent},
    {x: 0, y: 1.0, z: 2.85, w: 1.7, d: 1.0, h: 1.5, color: c.accent},
    {x: 0, y: 1.0, z: 3.95, w: 1.15, d: 1.15, h: 1.1, color: SKIN},
    {x: 0, y: 1.0, z: 4.65, w: 1.45, d: 1.5, h: 0.45, color: c.cap},
    {x: 0, y: 0.3, z: 4.55, w: 1.3, d: 0.7, h: 0.25, color: c.cap},
  ];
}

/** The floating "?" brick that hands out items. */
export function itemBrickBricks(): Brick[] {
  return [
    {x: 0, y: 0, z: 1.6, w: 2.4, d: 2.4, h: 2.4, color: '#f4c024', studs: [2, 2]},
    {x: 0, y: -1.25, z: 1.6, w: 1.0, d: 0.2, h: 1.0, color: '#8a5b00'},
    {x: 0, y: 0, z: 0.25, w: 0.5, d: 0.5, h: 0.5, color: '#f8e08a'},
  ];
}

export function oilBrickBricks(): Brick[] {
  return [
    {x: 0, y: 0, z: 0.25, w: 3.0, d: 3.0, h: 0.5, color: '#2b2f38', studs: [3, 3]},
    {x: 0, y: 0, z: 0.62, w: 1.4, d: 1.4, h: 0.25, color: '#4a505e'},
  ];
}

export function homingBrickBricks(): Brick[] {
  return [
    {x: 0, y: 0, z: 0.9, w: 1.8, d: 2.2, h: 1.4, color: '#e0392b', studs: [2, 2]},
    {x: -1.4, y: 0.2, z: 1.0, w: 1.0, d: 0.8, h: 0.3, color: '#f5f6f8'},
    {x: 1.4, y: 0.2, z: 1.0, w: 1.0, d: 0.8, h: 0.3, color: '#f5f6f8'},
    {x: 0, y: -1.3, z: 0.9, w: 0.7, d: 0.6, h: 0.7, color: '#f4c024'},
  ];
}

export function shieldBrickBricks(): Brick[] {
  return [{x: 0, y: 0, z: 0.6, w: 1.2, d: 1.2, h: 1.2, color: '#3ad0e8', studs: [1, 1]}];
}

/** Chunky icons for the HUD item slot, drawn with the same brick renderer. */
export function itemIconBricks(item: string | null): Brick[] {
  switch (item) {
    case 'boost':
      return [
        {x: 0, y: 1.0, z: 0.5, w: 3.0, d: 1.0, h: 1.0, color: '#f07018', studs: [3, 1]},
        {x: 0, y: 0, z: 0.5, w: 2.0, d: 1.0, h: 1.0, color: '#f4c024', studs: [2, 1]},
        {x: 0, y: -1.0, z: 0.5, w: 1.0, d: 1.0, h: 1.0, color: '#ffe066', studs: [1, 1]},
      ];
    case 'oil':
      return oilBrickBricks();
    case 'homing':
      return homingBrickBricks();
    case 'shield':
      return [
        {x: -1.4, y: 0, z: 0.6, w: 1.2, d: 1.2, h: 1.2, color: '#3ad0e8', studs: [1, 1]},
        {x: 0, y: 0, z: 0.6, w: 1.2, d: 1.2, h: 1.2, color: '#3ad0e8', studs: [1, 1]},
        {x: 1.4, y: 0, z: 0.6, w: 1.2, d: 1.2, h: 1.2, color: '#3ad0e8', studs: [1, 1]},
      ];
    default:
      return itemBrickBricks();
  }
}

export function propBricks(kind: PropKind): Brick[] {
  switch (kind) {
    case 'tree':
      return [
        {x: 0, y: 0, z: 1.1, w: 0.9, d: 0.9, h: 2.2, color: '#8a5b2a'},
        {x: 0, y: 0, z: 3.0, w: 3.4, d: 3.4, h: 1.8, color: '#2f8a3c', studs: [2, 2]},
        {x: 0, y: 0, z: 4.5, w: 2.4, d: 2.4, h: 1.4, color: '#3aa04a', studs: [2, 2]},
        {x: 0, y: 0, z: 5.6, w: 1.4, d: 1.4, h: 1.0, color: '#45b455', studs: [1, 1]},
      ];
    case 'cactus':
      return [
        {x: 0, y: 0, z: 2.2, w: 1.4, d: 1.4, h: 4.4, color: '#2f8a4f', studs: [1, 1]},
        {x: -1.3, y: 0, z: 2.8, w: 1.4, d: 0.9, h: 0.9, color: '#2f8a4f'},
        {x: -1.6, y: 0, z: 3.7, w: 0.9, d: 0.9, h: 1.6, color: '#2f8a4f'},
        {x: 1.3, y: 0, z: 1.8, w: 1.4, d: 0.9, h: 0.9, color: '#2f8a4f'},
        {x: 1.6, y: 0, z: 2.6, w: 0.9, d: 0.9, h: 1.4, color: '#2f8a4f'},
      ];
    case 'cone':
      return [
        {x: 0, y: 0, z: 0.2, w: 2.0, d: 2.0, h: 0.4, color: '#f07018'},
        {x: 0, y: 0, z: 0.9, w: 1.3, d: 1.3, h: 1.0, color: '#f07018'},
        {x: 0, y: 0, z: 1.6, w: 0.9, d: 0.9, h: 0.5, color: '#f5f6f8'},
        {x: 0, y: 0, z: 2.1, w: 0.7, d: 0.7, h: 0.6, color: '#f07018', studs: [1, 1]},
      ];
    case 'sign':
      return [
        {x: 0, y: 0, z: 1.2, w: 0.5, d: 0.5, h: 2.4, color: '#8a8f98'},
        {x: 0, y: 0, z: 3.2, w: 3.6, d: 0.4, h: 2.0, color: '#f5f6f8'},
        {x: 0, y: -0.3, z: 3.2, w: 2.6, d: 0.2, h: 1.0, color: '#d8352a'},
      ];
    case 'lamp':
      return [
        {x: 0, y: 0, z: 0.3, w: 1.6, d: 1.6, h: 0.6, color: '#3a3f4a'},
        {x: 0, y: 0, z: 3.2, w: 0.6, d: 0.6, h: 5.2, color: '#5a6070'},
        {x: 0, y: 0, z: 6.1, w: 1.8, d: 1.8, h: 0.8, color: '#ffe98a'},
        {x: 0, y: 0, z: 6.7, w: 1.2, d: 1.2, h: 0.5, color: '#3a3f4a', studs: [1, 1]},
      ];
    case 'block':
    default:
      return [
        {x: 0, y: 0, z: 0.7, w: 3.2, d: 3.2, h: 1.4, color: '#2f6fd8', studs: [2, 2]},
        {x: 0, y: 0, z: 2.0, w: 2.2, d: 2.2, h: 1.2, color: '#f4c024', studs: [2, 2]},
      ];
  }
}
