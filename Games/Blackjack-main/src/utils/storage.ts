import type { BjPayout, DealerRule } from './rules.ts';
import { DEFAULT_BALANCE } from './rules.ts';
import { TABLES, getTable } from './tables.ts';

export type { BjPayout };
export type SurrenderRule = 'early' | 'late' | 'none';
export type PlayMode = 'standard' | 'counting';

export interface GameRulesConfig {
  dealerRule: DealerRule;
  deckCount: number;
  bjPayout: BjPayout;
  /** Max hands after splits (2–4). */
  maxSplitHands: number;
  /** Allow double after split. */
  doubleAfterSplit: boolean;
  /** Allow re-splitting aces. */
  resplitAces: boolean;
  surrender: SurrenderRule;
  /** Cut-card penetration 0.5–0.9. */
  penetration: number;
}

export interface BlackjackStats {
  hands: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  streak: number;
  bestStreak: number;
  peakBankroll: number;
  bustOuts: number;
  recoveriesUsed: number;
  strategyCorrect: number;
  strategyTotal: number;
  netProfit: number;
  tableId: string;
}

export interface BlackjackSettings {
  rules: GameRulesConfig;
  hintsEnabled: boolean;
  feedbackEnabled: boolean;
  showCount: boolean;
  mode: PlayMode;
}

export const STATS_KEY = 'clubhouse-blackjack-stats:v1';
export const SETTINGS_KEY = 'clubhouse-blackjack-settings:v1';
export const BALANCE_STORAGE_KEY = 'clubhouse-blackjack-balance';
/** Max free recoveries before requiring a hard reset of progression. */
export const MAX_RECOVERIES = 5;

export const DEFAULT_RULES: GameRulesConfig = {
  dealerRule: 'H17',
  deckCount: 6,
  bjPayout: '3:2',
  maxSplitHands: 4,
  doubleAfterSplit: true,
  resplitAces: false,
  surrender: 'early',
  penetration: 0.75,
};

export const EMPTY_STATS: BlackjackStats = {
  hands: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  blackjacks: 0,
  streak: 0,
  bestStreak: 0,
  peakBankroll: DEFAULT_BALANCE,
  bustOuts: 0,
  recoveriesUsed: 0,
  strategyCorrect: 0,
  strategyTotal: 0,
  netProfit: 0,
  tableId: TABLES[0].id,
};

export const DEFAULT_SETTINGS: BlackjackSettings = {
  rules: { ...DEFAULT_RULES },
  hintsEnabled: true,
  feedbackEnabled: true,
  showCount: false,
  mode: 'standard',
};

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function loadBalance(): number {
  try {
    const raw = localStorage.getItem(BALANCE_STORAGE_KEY);
    if (raw == null) return DEFAULT_BALANCE;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_BALANCE;
  } catch {
    return DEFAULT_BALANCE;
  }
}

export function saveBalance(balance: number): void {
  try {
    localStorage.setItem(BALANCE_STORAGE_KEY, String(Math.floor(balance)));
  } catch {
    // ignore quota / private mode
  }
}

export function loadStats(): BlackjackStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...EMPTY_STATS };
    const parsed = JSON.parse(raw) as Partial<BlackjackStats>;
    const tableId =
      typeof parsed.tableId === 'string' && TABLES.some(t => t.id === parsed.tableId)
        ? parsed.tableId
        : TABLES[0].id;
    return {
      hands: num(parsed.hands, 0),
      wins: num(parsed.wins, 0),
      losses: num(parsed.losses, 0),
      pushes: num(parsed.pushes, 0),
      blackjacks: num(parsed.blackjacks, 0),
      streak: num(parsed.streak, 0),
      bestStreak: num(parsed.bestStreak, 0),
      peakBankroll: Math.max(num(parsed.peakBankroll, DEFAULT_BALANCE), DEFAULT_BALANCE),
      bustOuts: num(parsed.bustOuts, 0),
      recoveriesUsed: num(parsed.recoveriesUsed, 0),
      strategyCorrect: num(parsed.strategyCorrect, 0),
      strategyTotal: num(parsed.strategyTotal, 0),
      netProfit: num(parsed.netProfit, 0),
      tableId,
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

export function saveStats(stats: BlackjackStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

export function loadSettings(): BlackjackSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, rules: { ...DEFAULT_RULES } };
    const parsed = JSON.parse(raw) as Partial<BlackjackSettings> & {
      rules?: Partial<GameRulesConfig>;
    };
    const r: Partial<GameRulesConfig> = parsed.rules ?? {};
    const deckCount = num(r.deckCount, DEFAULT_RULES.deckCount);
    const maxSplitHands = Math.min(4, Math.max(2, num(r.maxSplitHands, 4)));
    const penetration = Math.min(0.9, Math.max(0.5, num(r.penetration, 0.75)));
    return {
      hintsEnabled: bool(parsed.hintsEnabled, true),
      feedbackEnabled: bool(parsed.feedbackEnabled, true),
      showCount: bool(parsed.showCount, false),
      mode: parsed.mode === 'counting' ? 'counting' : 'standard',
      rules: {
        dealerRule: r.dealerRule === 'S17' ? 'S17' : 'H17',
        deckCount: [1, 2, 4, 6, 8].includes(deckCount) ? deckCount : 6,
        bjPayout: r.bjPayout === '6:5' ? '6:5' : '3:2',
        maxSplitHands,
        doubleAfterSplit: bool(r.doubleAfterSplit, true),
        resplitAces: bool(r.resplitAces, false),
        surrender:
          r.surrender === 'late' || r.surrender === 'none' ? r.surrender : 'early',
        penetration,
      },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, rules: { ...DEFAULT_RULES } };
  }
}

export function saveSettings(settings: BlackjackSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export type HandOutcome = 'win' | 'lose' | 'push' | 'blackjack';

export function recordHandResult(
  stats: BlackjackStats,
  outcome: HandOutcome,
  balanceAfter: number,
  profitDelta: number,
  strategyCorrect: number,
  strategyTotal: number,
): BlackjackStats {
  const won = outcome === 'win' || outcome === 'blackjack';
  const streak = won ? stats.streak + 1 : outcome === 'push' ? stats.streak : 0;
  return {
    ...stats,
    hands: stats.hands + 1,
    wins: stats.wins + (won ? 1 : 0),
    losses: stats.losses + (outcome === 'lose' ? 1 : 0),
    pushes: stats.pushes + (outcome === 'push' ? 1 : 0),
    blackjacks: stats.blackjacks + (outcome === 'blackjack' ? 1 : 0),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    peakBankroll: Math.max(stats.peakBankroll, balanceAfter),
    strategyCorrect: stats.strategyCorrect + strategyCorrect,
    strategyTotal: stats.strategyTotal + strategyTotal,
    netProfit: stats.netProfit + profitDelta,
  };
}

export function applyRecovery(stats: BlackjackStats, tableId: string): {
  stats: BlackjackStats;
  balance: number;
} | null {
  if (stats.recoveriesUsed >= MAX_RECOVERIES) return null;
  const table = getTable(tableId);
  // Drop to the lounge after recovery if current table min exceeds recovery stake.
  const safeTableId =
    table.recoveryStake >= table.minBet ? tableId : TABLES[0].id;
  const safeTable = getTable(safeTableId);
  return {
    balance: safeTable.recoveryStake,
    stats: {
      ...stats,
      recoveriesUsed: stats.recoveriesUsed + 1,
      bustOuts: stats.bustOuts + 1,
      streak: 0,
      tableId: safeTableId,
      peakBankroll: Math.max(stats.peakBankroll, safeTable.recoveryStake),
    },
  };
}

/** Full progression wipe — last resort after recoveries exhausted. */
export function hardResetProgression(): {
  stats: BlackjackStats;
  balance: number;
  settings: BlackjackSettings;
} {
  return {
    balance: DEFAULT_BALANCE,
    stats: { ...EMPTY_STATS },
    settings: { ...DEFAULT_SETTINGS, rules: { ...DEFAULT_RULES } },
  };
}
