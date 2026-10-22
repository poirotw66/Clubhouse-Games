/**
 * Date-keyed daily board: cycles hand-authored mechanism-style layouts.
 */
import { Color, type BottleData, type Order } from '../types.ts';
import { createLayer } from './gameLogic.ts';
import { localDateKey } from './streakService.ts';

const DAILY_CLEAR_KEY = 'mls-daily-clear-v1';

export type DailyBoardDef = {
  id: string;
  name: string;
  capacity: number;
  bottles: { color: keyof typeof Color; isHidden?: boolean }[][];
  orderColors: (keyof typeof Color)[];
};

/** Seven compact boards; day-of-epoch picks one. */
export const DAILY_BOARDS: readonly DailyBoardDef[] = [
  {
    id: 'daily-a',
    name: '晨曦三色',
    capacity: 4,
    bottles: [
      [{ color: 'RED' }, { color: 'BLUE' }, { color: 'RED' }],
      [{ color: 'BLUE' }, { color: 'BLUE' }, { color: 'RED' }, { color: 'BLUE' }],
      [{ color: 'GREEN' }, { color: 'GREEN' }, { color: 'GREEN' }, { color: 'GREEN' }],
      [{ color: 'RED' }],
      [],
    ],
    orderColors: ['RED', 'BLUE', 'GREEN'],
  },
  {
    id: 'daily-b',
    name: '交錯黃藍',
    capacity: 4,
    bottles: [
      [],
      [{ color: 'YELLOW' }, { color: 'YELLOW' }, { color: 'BLUE' }, { color: 'BLUE' }],
      [{ color: 'BLUE' }, { color: 'YELLOW' }, { color: 'BLUE' }, { color: 'YELLOW' }],
      [],
    ],
    orderColors: ['YELLOW', 'BLUE'],
  },
  {
    id: 'daily-c',
    name: '紫青分流',
    capacity: 4,
    bottles: [
      [{ color: 'PURPLE' }, { color: 'CYAN' }, { color: 'PURPLE' }],
      [{ color: 'CYAN' }, { color: 'CYAN' }, { color: 'PURPLE' }, { color: 'CYAN' }],
      [{ color: 'PURPLE' }],
      [],
    ],
    orderColors: ['PURPLE', 'CYAN'],
  },
  {
    id: 'daily-d',
    name: '橙綠入門',
    capacity: 4,
    bottles: [
      [{ color: 'ORANGE' }, { color: 'GREEN' }, { color: 'ORANGE' }, { color: 'GREEN' }],
      [{ color: 'GREEN' }, { color: 'ORANGE' }, { color: 'GREEN' }, { color: 'ORANGE' }],
      [],
      [],
    ],
    orderColors: ['ORANGE', 'GREEN'],
  },
  {
    id: 'daily-e',
    name: '四色短征',
    capacity: 4,
    bottles: [
      [{ color: 'RED' }, { color: 'YELLOW' }, { color: 'BLUE' }, { color: 'RED' }],
      [{ color: 'BLUE' }, { color: 'BLUE' }, { color: 'YELLOW' }, { color: 'YELLOW' }],
      [{ color: 'GREEN' }, { color: 'GREEN' }, { color: 'GREEN' }, { color: 'RED' }],
      [{ color: 'RED' }, { color: 'BLUE' }, { color: 'YELLOW' }, { color: 'GREEN' }],
      [],
      [],
    ],
    orderColors: ['RED', 'BLUE', 'GREEN', 'YELLOW'],
  },
  {
    id: 'daily-f',
    name: '隱藏一瞥',
    capacity: 4,
    bottles: [
      [{ color: 'RED', isHidden: true }, { color: 'BLUE' }, { color: 'BLUE' }],
      [{ color: 'BLUE', isHidden: true }, { color: 'RED' }, { color: 'RED' }],
      [{ color: 'RED' }, { color: 'BLUE' }],
      [],
    ],
    orderColors: ['RED', 'BLUE'],
  },
  {
    id: 'daily-g',
    name: '週末雙空',
    capacity: 4,
    bottles: [
      [{ color: 'CYAN' }, { color: 'PURPLE' }, { color: 'CYAN' }, { color: 'PURPLE' }],
      [{ color: 'PURPLE' }, { color: 'CYAN' }, { color: 'PURPLE' }, { color: 'CYAN' }],
      [],
      [],
    ],
    orderColors: ['CYAN', 'PURPLE'],
  },
];

function dayIndex(dateKey: string): number {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  return h % DAILY_BOARDS.length;
}

export function getDailyBoard(date: Date = new Date()): {
  dateKey: string;
  board: DailyBoardDef;
  index: number;
} {
  const dateKey = localDateKey(date);
  const index = dayIndex(dateKey);
  return { dateKey, board: DAILY_BOARDS[index], index };
}

export function materializeDailyBoard(board: DailyBoardDef): { bottles: BottleData[]; orders: Order[] } {
  const capacity = board.capacity;
  const bottles: BottleData[] = board.bottles.map((defs, bottleIndex) => {
    if (defs.length > capacity) {
      throw new Error(`daily ${board.id}: bottle ${bottleIndex} exceeds capacity`);
    }
    const layers = defs.map((d, layerIndex) => {
      const isTop = layerIndex === defs.length - 1;
      const isHidden = Boolean(d.isHidden) && !isTop;
      return createLayer(Color[d.color], isHidden);
    });
    const isCompleted =
      layers.length === capacity &&
      layers.length > 0 &&
      layers.every((l) => l.color === layers[0].color && !l.isHidden);
    return {
      id: `daily-${board.id}-b${bottleIndex}`,
      layers,
      capacity,
      isCompleted,
      mixingEnabled: false,
    };
  });

  const counts = new Map<string, number>();
  for (const b of bottles) {
    for (const l of b.layers) counts.set(l.color, (counts.get(l.color) ?? 0) + 1);
  }
  for (const key of board.orderColors) {
    const color = Color[key];
    if ((counts.get(color) ?? 0) !== capacity) {
      throw new Error(`daily ${board.id}: colour ${key} count mismatch`);
    }
  }

  const orders: Order[] = board.orderColors.map((key, index) => ({
    id: `daily-${board.id}-o${index}`,
    color: Color[key],
    isCompleted: false,
    isLocked: index >= 2,
  }));

  return { bottles, orders };
}

export function isDailyCleared(dateKey: string = localDateKey()): boolean {
  try {
    return localStorage.getItem(DAILY_CLEAR_KEY) === dateKey;
  } catch {
    return false;
  }
}

export function markDailyCleared(dateKey: string = localDateKey()): void {
  try {
    localStorage.setItem(DAILY_CLEAR_KEY, dateKey);
  } catch {
    /* private mode */
  }
}
