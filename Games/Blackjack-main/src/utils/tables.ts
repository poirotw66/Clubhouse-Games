/** Table ladder: rising minimums unlocked by peak bankroll. */

export interface TableTier {
  id: string;
  name: string;
  /** Minimum bet required at this table. */
  minBet: number;
  /** Maximum single bet (caps chip spam at low tables). */
  maxBet: number;
  /** Peak bankroll required to unlock (0 = always available). */
  unlockPeak: number;
  /** Chips granted on recovery loan when busted at this table. */
  recoveryStake: number;
  /** Chip denominations offered on the betting rail. */
  chipValues: number[];
}

export const TABLES: TableTier[] = [
  {
    id: 'lounge',
    name: '休閒桌',
    minBet: 10,
    maxBet: 200,
    unlockPeak: 0,
    recoveryStake: 500,
    chipValues: [10, 25, 50, 100],
  },
  {
    id: 'silver',
    name: '銀桌',
    minBet: 50,
    maxBet: 1000,
    unlockPeak: 2500,
    recoveryStake: 1000,
    chipValues: [50, 100, 250, 500],
  },
  {
    id: 'gold',
    name: '金桌',
    minBet: 200,
    maxBet: 5000,
    unlockPeak: 10000,
    recoveryStake: 2000,
    chipValues: [200, 500, 1000, 2000],
  },
  {
    id: 'platinum',
    name: '白金桌',
    minBet: 500,
    maxBet: 15000,
    unlockPeak: 30000,
    recoveryStake: 4000,
    chipValues: [500, 1000, 2500, 5000],
  },
  {
    id: 'highroller',
    name: '高注桌',
    minBet: 1000,
    maxBet: 50000,
    unlockPeak: 75000,
    recoveryStake: 8000,
    chipValues: [1000, 2500, 5000, 10000],
  },
];

export function getTable(id: string): TableTier {
  return TABLES.find(t => t.id === id) ?? TABLES[0];
}

export function isTableUnlocked(tableId: string, peakBankroll: number): boolean {
  const table = getTable(tableId);
  return peakBankroll >= table.unlockPeak;
}

export function unlockedTables(peakBankroll: number): TableTier[] {
  return TABLES.filter(t => peakBankroll >= t.unlockPeak);
}

/** Highest unlocked table id for the given peak. */
export function highestUnlockedTableId(peakBankroll: number): string {
  const list = unlockedTables(peakBankroll);
  return list[list.length - 1]?.id ?? TABLES[0].id;
}
