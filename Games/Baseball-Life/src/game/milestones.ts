import type { GameState, Milestone, SeasonRecord, StatLine } from './types';

/**
 * Career counting-stat thresholds. These are the numbers a broadcast cuts to
 * live, so crossing one is worth interrupting the turn report for.
 */
const CAREER_MARKS: { key: CareerKey; values: number[]; label: (n: number) => string }[] = [
  { key: 'hits', values: [500, 1000, 1500, 2000, 2500, 3000], label: (n) => `生涯通算 ${n} 支安打` },
  { key: 'hr', values: [100, 200, 300, 400, 500], label: (n) => `生涯通算 ${n} 轟` },
  { key: 'rbi', values: [500, 1000, 1500, 2000], label: (n) => `生涯通算 ${n} 打點` },
  { key: 'sb', values: [200, 300, 400], label: (n) => `生涯通算 ${n} 次盜壘成功` },
  // Pitcher counting stats accumulate far slower than a hitter's, so the rungs
  // start lower — otherwise a full career passes with one milestone in it.
  { key: 'wins', values: [30, 50, 80, 100, 150, 200], label: (n) => `生涯通算 ${n} 勝` },
  { key: 'so', values: [500, 1000, 1500, 2000, 2500, 3000], label: (n) => `生涯通算 ${n} 次奪三振` },
  { key: 'saves', values: [50, 100, 200, 300], label: (n) => `生涯通算 ${n} 次救援成功` },
];

type CareerKey = 'hits' | 'hr' | 'rbi' | 'sb' | 'wins' | 'so' | 'saves';

type Totals = Record<CareerKey, number>;

const EMPTY: Totals = { hits: 0, hr: 0, rbi: 0, sb: 0, wins: 0, so: 0, saves: 0 };

/** Only professional and amateur play counts; high-school games do not. */
export function careerTotals(history: SeasonRecord[]): Totals {
  const totals: Totals = { ...EMPTY };
  for (const record of history) {
    if (record.league === 'hs') continue;
    const line = record.line;
    if (line.kind === 'batter') {
      totals.hits += line.hits;
      totals.hr += line.hr;
      totals.rbi += line.rbi;
      totals.sb += line.sb;
    } else {
      totals.wins += line.wins;
      totals.so += line.so;
      totals.saves += line.saves;
    }
  }
  return totals;
}

/**
 * Compares the totals either side of a season, so a player who blows past two
 * thresholds in one year gets credited with both.
 */
export function careerMilestones(before: Totals, after: Totals, state: GameState): Milestone[] {
  const found: Milestone[] = [];
  for (const mark of CAREER_MARKS) {
    for (const value of mark.values) {
      if (before[mark.key] < value && after[mark.key] >= value) {
        found.push({ year: state.year, age: state.age, text: mark.label(value), kind: 'career' });
      }
    }
  }
  return found;
}

/**
 * Single-game feats. There is no play-by-play sim to detect these for real, so
 * they are rolled against the ability and workload that would make them
 * plausible — a no-hitter needs a good starter who actually made starts.
 */
export function seasonFeats(
  state: GameState,
  line: StatLine,
  quality: number,
  rng: () => number,
): Milestone[] {
  const found: Milestone[] = [];
  const add = (text: string) =>
    found.push({ year: state.year, age: state.age, text, kind: 'feat' });

  if (line.kind === 'pitcher') {
    if (line.role === '先發' && line.games >= 12 && line.era <= 3.6) {
      const edge = Math.max(0, (3.6 - line.era) / 3);
      if (rng() < 0.05 + edge * 0.22 * quality) add('投出無安打比賽');
      if (rng() < 0.004 + edge * 0.02 * quality) add('投出完全比賽');
    }
    if (line.so >= 200) add(`單季 ${line.so} 次奪三振`);
    if (line.role === '先發' && line.wins >= 18) add(`單季 ${line.wins} 勝`);
    if (line.era <= 1.80 && line.ip >= 120) add(`單季防禦率 ${line.era.toFixed(2)}`);
  } else {
    const { contact, power, speed } = state.attrs;
    if (contact >= 58 && power >= 48 && speed >= 52 && line.games >= 60) {
      if (rng() < 0.04 + quality * 0.06) add('達成完全打擊');
    }
    if (line.hr >= 40) add(`單季 ${line.hr} 轟`);
    if (line.sb >= 40) add(`單季 ${line.sb} 次盜壘成功`);
    if (line.avg >= 0.350 && line.ab >= 300) {
      add(`單季打率 ${line.avg.toFixed(3).replace(/^0/, '')}`);
    }
  }

  return found;
}
