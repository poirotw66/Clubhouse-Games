import {WORLD_SIZE} from '../engine/constants';
import type {Vec2} from '../engine/spline';

export interface TrackTheme {
  /** Ground outside the road. */
  ground: string;
  groundAlt: string;
  road: string;
  roadAlt: string;
  curbA: string;
  curbB: string;
  skyTop: string;
  skyBottom: string;
  hills: string;
  hillsFar: string;
  fog: string;
  /** Roadside prop mix, cycled around the loop. */
  props: PropKind[];
}

export type PropKind = 'tree' | 'cone' | 'sign' | 'lamp' | 'cactus' | 'block';

export interface TrackDef {
  id: string;
  name: string;
  subtitle: string;
  difficulty: 1 | 2 | 3;
  /** Radial harmonics that shape the closed loop: r = R * (1 + Σ a·sin(kθ+p)). */
  radius: number;
  harmonics: {k: number; a: number; p: number}[];
  squashX: number;
  squashY: number;
  /** Fractions around the lap where a boost pad sits. */
  boostPads: number[];
  /** Fractions around the lap where a row of item bricks sits. */
  itemRows: number[];
  theme: TrackTheme;
}

export const TRACKS: TrackDef[] = [
  {
    id: 'brick-park',
    name: '積木樂園',
    subtitle: '寬闊好開的入門賽道',
    difficulty: 1,
    radius: 0.36,
    harmonics: [
      {k: 2, a: 0.07, p: 0.4},
      {k: 3, a: 0.035, p: 2.1},
    ],
    squashX: 1.12,
    squashY: 0.94,
    boostPads: [0.22, 0.62],
    itemRows: [0.16, 0.46, 0.78],
    theme: {
      ground: '#3f9a3a',
      groundAlt: '#369031',
      road: '#8d9196',
      roadAlt: '#83878c',
      curbA: '#d8352a',
      curbB: '#f2f3f5',
      skyTop: '#3aa6e8',
      skyBottom: '#bfe6ff',
      hills: '#2f7d4a',
      hillsFar: '#67b07f',
      fog: '#bfe6ff',
      props: ['tree', 'sign', 'tree', 'cone', 'lamp', 'tree'],
    },
  },
  {
    id: 'desert-yard',
    name: '沙漠工地',
    subtitle: '連續彎與髮夾彎的考驗',
    difficulty: 2,
    radius: 0.335,
    harmonics: [
      {k: 3, a: 0.085, p: 1.1},
      {k: 5, a: 0.045, p: 0.2},
      {k: 2, a: 0.03, p: 2.6},
    ],
    squashX: 1.08,
    squashY: 0.96,
    boostPads: [0.12, 0.48, 0.79],
    itemRows: [0.28, 0.58, 0.88],
    theme: {
      ground: '#d9b271',
      groundAlt: '#cea764',
      road: '#9a9186',
      roadAlt: '#8f867c',
      curbA: '#f0a01e',
      curbB: '#2f2f33',
      skyTop: '#f0913c',
      skyBottom: '#ffdca8',
      hills: '#a8672f',
      hillsFar: '#d59459',
      fog: '#ffdca8',
      props: ['cactus', 'cone', 'block', 'cactus', 'sign', 'cone'],
    },
  },
  {
    id: 'neon-city',
    name: '霓虹夜城',
    subtitle: '窄道連彎，考驗飄移功力',
    difficulty: 3,
    radius: 0.325,
    harmonics: [
      {k: 4, a: 0.075, p: 0.6},
      {k: 7, a: 0.04, p: 1.9},
      {k: 2, a: 0.045, p: 0.1},
    ],
    squashX: 1.06,
    squashY: 0.98,
    boostPads: [0.08, 0.35, 0.66, 0.9],
    itemRows: [0.2, 0.44, 0.7, 0.94],
    theme: {
      ground: '#1c2340',
      groundAlt: '#182038',
      road: '#454c63',
      roadAlt: '#3d4359',
      curbA: '#00e0ff',
      curbB: '#ff2fa0',
      skyTop: '#0b1030',
      skyBottom: '#5a2a72',
      hills: '#1a1038',
      hillsFar: '#3a2060',
      fog: '#3a2060',
      props: ['lamp', 'block', 'sign', 'lamp', 'cone', 'block'],
    },
  },
];

/** Control points for the closed loop, evaluated from the radial harmonics. */
export function trackControlPoints(def: TrackDef, count = 36): Vec2[] {
  const cx = WORLD_SIZE / 2;
  const cy = WORLD_SIZE / 2;
  const pts: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    // Negative angle so the lap runs clockwise on the y-down map.
    const theta = (-i / count) * Math.PI * 2;
    let r = 1;
    for (const h of def.harmonics) r += h.a * Math.sin(h.k * theta + h.p);
    const rad = def.radius * WORLD_SIZE * r;
    pts.push({
      x: cx + Math.cos(theta) * rad * def.squashX,
      y: cy + Math.sin(theta) * rad * def.squashY,
    });
  }
  return pts;
}
