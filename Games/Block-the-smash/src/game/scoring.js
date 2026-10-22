/**
 * Grades, score-attack wave rules, and localStorage progression.
 */

/** Legacy drill accuracy map (migrated into v3). */
export const LEGACY_BEST_KEY = 'clubhouse:block-the-smash-best-v2';
export const STATS_KEY = 'clubhouse:block-the-smash-stats-v3';

/**
 * @typedef {object} SmashStats
 * @property {Record<string, number>} drillBestAcc  `${diff}:${balls}` → %
 * @property {Record<string, number>} scoreAttackBest  `${diff}` → score
 * @property {Record<string, number>} versusWins  opponentId → series wins
 * @property {Record<string, number>} versusBestStreak
 * @property {Record<string, number>} dailyBest  Taipei dateKey → score
 * @property {number} careerPerfects
 * @property {number} careerMaxCombo
 * @property {number} careerPlays
 * @property {number} careerCounters  successful Perfect counter choices
 */

/** @returns {SmashStats} */
export function emptyStats() {
  return {
    drillBestAcc: {},
    scoreAttackBest: {},
    versusWins: {},
    versusBestStreak: {},
    dailyBest: {},
    careerPerfects: 0,
    careerMaxCombo: 0,
    careerPlays: 0,
    careerCounters: 0,
  };
}

/**
 * @param {unknown} raw
 * @returns {SmashStats}
 */
export function normalizeStats(raw) {
  const base = emptyStats();
  if (!raw || typeof raw !== 'object') return base;
  const o = /** @type {Record<string, unknown>} */ (raw);

  const copyNumMap = (src) => {
    /** @type {Record<string, number>} */
    const out = {};
    if (!src || typeof src !== 'object') return out;
    for (const [k, v] of Object.entries(src)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) out[k] = Math.floor(n);
    }
    return out;
  };

  return {
    drillBestAcc: copyNumMap(o.drillBestAcc),
    scoreAttackBest: copyNumMap(o.scoreAttackBest),
    versusWins: copyNumMap(o.versusWins),
    versusBestStreak: copyNumMap(o.versusBestStreak),
    dailyBest: copyNumMap(o.dailyBest),
    careerPerfects: Math.max(0, Math.floor(Number(o.careerPerfects) || 0)),
    careerMaxCombo: Math.max(0, Math.floor(Number(o.careerMaxCombo) || 0)),
    careerPlays: Math.max(0, Math.floor(Number(o.careerPlays) || 0)),
    careerCounters: Math.max(0, Math.floor(Number(o.careerCounters) || 0)),
  };
}

/**
 * @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void }} StorageLike
 */

/**
 * @param {StorageLike | null} storage
 * @returns {SmashStats}
 */
export function loadStats(storage) {
  if (!storage) return emptyStats();
  try {
    const raw = storage.getItem(STATS_KEY);
    if (raw) return normalizeStats(JSON.parse(raw));
  } catch {
    /* fall through */
  }

  // Migrate v2 accuracy map.
  try {
    const legacy = storage.getItem(LEGACY_BEST_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const stats = emptyStats();
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          const n = Number(v);
          if (Number.isFinite(n)) stats.drillBestAcc[k] = Math.round(n);
        }
      }
      saveStats(stats, storage);
      return stats;
    }
  } catch {
    /* ignore */
  }
  return emptyStats();
}

/**
 * @param {SmashStats} stats
 * @param {StorageLike | null} storage
 */
export function saveStats(stats, storage) {
  if (!storage) return;
  try {
    storage.setItem(STATS_KEY, JSON.stringify(normalizeStats(stats)));
  } catch {
    /* private mode */
  }
}

/**
 * @param {number} acc
 * @returns {{ grade: string, title: string, cls: string }}
 */
export function gradeFromAccuracy(acc) {
  if (acc >= 92) return { grade: 'S', title: '完美防守', cls: 'grade-s' };
  if (acc >= 80) return { grade: 'A', title: '穩如鐵牆', cls: 'grade-a' };
  if (acc >= 65) return { grade: 'B', title: '防守合格', cls: 'grade-b' };
  if (acc >= 45) return { grade: 'C', title: '還差一口氣', cls: 'grade-c' };
  return { grade: 'D', title: '再練一場', cls: 'grade-d' };
}

/**
 * Score-attack letter from absolute score (escalating waves).
 * @param {number} score
 */
export function gradeFromScore(score) {
  if (score >= 25000) return { grade: 'S', title: '殺球殺手', cls: 'grade-s' };
  if (score >= 15000) return { grade: 'A', title: '接殺達人', cls: 'grade-a' };
  if (score >= 8000) return { grade: 'B', title: '節奏不錯', cls: 'grade-b' };
  if (score >= 3500) return { grade: 'C', title: '再衝一波', cls: 'grade-c' };
  return { grade: 'D', title: '熱身結束', cls: 'grade-d' };
}

/**
 * Drill quality: count perfect+good as full hits, blocks as half for accuracy display.
 * Primary reported accuracy still uses successful contacts / balls for grade continuity.
 * @param {{ perfects: number, goods: number, blocks: number, misses: number, maxBalls: number }} s
 */
export function drillAccuracy(s) {
  const contacts = s.perfects + s.goods + s.blocks;
  const denom = Math.max(1, s.maxBalls);
  return Math.round((contacts / denom) * 100);
}

/**
 * Score-attack wave: every `perWave` contacts advances tier (0…).
 * @param {number} cleared
 * @param {number} [perWave]
 */
export function scoreAttackWave(cleared, perWave = 8) {
  return Math.floor(Math.max(0, cleared) / perWave);
}

/**
 * Apply end-of-drill record update. Returns whether a new accuracy record was set.
 * @param {SmashStats} stats
 * @param {{ difficulty: string, balls: number, accuracy: number, perfects: number, maxCombo: number }} result
 */
export function applyDrillResult(stats, result) {
  const key = `${result.difficulty}:${result.balls}`;
  const prev = stats.drillBestAcc[key];
  let isRecord = false;
  if (prev == null || result.accuracy > prev) {
    stats.drillBestAcc[key] = result.accuracy;
    isRecord = prev != null ? result.accuracy > prev : result.accuracy > 0;
  }
  stats.careerPerfects += result.perfects;
  stats.careerMaxCombo = Math.max(stats.careerMaxCombo, result.maxCombo);
  stats.careerPlays += 1;
  return isRecord;
}

/**
 * @param {SmashStats} stats
 * @param {{ difficulty: string, score: number, perfects: number, maxCombo: number }} result
 */
export function applyScoreAttackResult(stats, result) {
  const key = result.difficulty;
  const prev = stats.scoreAttackBest[key] ?? 0;
  const isRecord = result.score > prev;
  if (isRecord) stats.scoreAttackBest[key] = result.score;
  stats.careerPerfects += result.perfects;
  stats.careerMaxCombo = Math.max(stats.careerMaxCombo, result.maxCombo);
  stats.careerPlays += 1;
  return isRecord;
}

/**
 * @param {SmashStats} stats
 * @param {{ opponentId: string, won: boolean, perfects: number, maxCombo: number, streak: number, counters?: number }} result
 */
export function applyVersusResult(stats, result) {
  if (result.won) {
    stats.versusWins[result.opponentId] = (stats.versusWins[result.opponentId] ?? 0) + 1;
    const best = stats.versusBestStreak[result.opponentId] ?? 0;
    stats.versusBestStreak[result.opponentId] = Math.max(best, result.streak);
  }
  stats.careerPerfects += result.perfects;
  stats.careerMaxCombo = Math.max(stats.careerMaxCombo, result.maxCombo);
  stats.careerCounters += Math.max(0, Math.floor(result.counters ?? 0));
  stats.careerPlays += 1;
}

/**
 * Record a daily run. Returns whether today's best improved.
 * @param {SmashStats} stats
 * @param {{ dateKey: string, score: number, perfects: number, maxCombo: number, counters?: number }} result
 */
export function applyDailyResult(stats, result) {
  const prev = stats.dailyBest[result.dateKey] ?? 0;
  const isRecord = result.score > prev;
  if (isRecord) stats.dailyBest[result.dateKey] = result.score;
  else if (prev === 0 && result.score >= 0) {
    // First play of the day still stamps a score so streak counts.
    stats.dailyBest[result.dateKey] = result.score;
  }
  stats.careerPerfects += result.perfects;
  stats.careerMaxCombo = Math.max(stats.careerMaxCombo, result.maxCombo);
  stats.careerCounters += Math.max(0, Math.floor(result.counters ?? 0));
  stats.careerPlays += 1;
  return isRecord || prev === 0;
}

export const PHASES = Object.freeze([
  { id: 'warm', label: '熱身', until: 0.33 },
  { id: 'pressure', label: '加壓', until: 0.66 },
  { id: 'chaos', label: '混戰', until: 1.01 },
]);

export function phaseTierFromProgress(progress) {
  if (progress < 0.33) return 0;
  if (progress < 0.66) return 1;
  return 2;
}
