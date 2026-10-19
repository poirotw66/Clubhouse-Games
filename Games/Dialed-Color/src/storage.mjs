/**
 * Persist bests, stats, history, and daily records in localStorage.
 */

const BEST_KEY = 'clubhouse-dialed-color-bests';
const STATS_KEY = 'clubhouse-dialed-color-stats';
const DAILY_KEY = 'clubhouse-dialed-color-daily';
const PREFS_KEY = 'clubhouse-dialed-color-prefs';
const HISTORY_LIMIT = 40;

const MODE_KEYS = [
  'single',
  'challenge',
  'ascent',
  'daily',
  'mix',
  'complement',
  'analogous',
  'blitz',
  'survival',
];

function emptyMsMap() {
  return { '1000': 0, '2000': 0, '3000': 0 };
}

function emptyModeMap() {
  /** @type {Record<string, number>} */
  const m = {};
  for (const k of MODE_KEYS) m[k] = 0;
  return m;
}

function emptyModeCount() {
  /** @type {Record<string, number>} */
  const m = {};
  for (const k of MODE_KEYS) m[k] = 0;
  return m;
}

export function defaultBests() {
  return {
    bestScoreByMs: emptyMsMap(),
    bestAverageByMs: emptyMsMap(),
    bestAscentLevel: 0,
    bestByMode: emptyModeMap(),
    bestSurvival: 0,
    bestBlitz: 0,
  };
}

export function defaultStats() {
  return {
    gamesPlayed: 0,
    totalAverageSum: 0,
    modePlays: emptyModeCount(),
    modeAverageSum: emptyModeMap(),
    history: /** @type {{ mode: string, average: number, at: string }[]} */ ([]),
  };
}

export function defaultPrefs() {
  return { colorBlind: false };
}

/**
 * @template T
 * @param {string} key
 * @param {() => T} fallback
 * @returns {T}
 */
function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback();
    return /** @type {T} */ (JSON.parse(raw));
  } catch {
    return fallback();
  }
}

export function loadBests() {
  const parsed = loadJson(BEST_KEY, () => ({}));
  const base = defaultBests();
  const bestScoreByMs = emptyMsMap();
  const bestAverageByMs = emptyMsMap();
  if (parsed.bestScoreByMs && typeof parsed.bestScoreByMs === 'object') {
    for (const key of Object.keys(bestScoreByMs)) {
      bestScoreByMs[key] = Number(parsed.bestScoreByMs[key]) || 0;
    }
  } else if (parsed.bestScore) {
    bestScoreByMs['2000'] = Number(parsed.bestScore) || 0;
  }
  if (parsed.bestAverageByMs && typeof parsed.bestAverageByMs === 'object') {
    for (const key of Object.keys(bestAverageByMs)) {
      bestAverageByMs[key] = Number(parsed.bestAverageByMs[key]) || 0;
    }
  } else if (parsed.bestAverage) {
    bestAverageByMs['2000'] = Number(parsed.bestAverage) || 0;
  }
  const bestByMode = emptyModeMap();
  if (parsed.bestByMode && typeof parsed.bestByMode === 'object') {
    for (const k of MODE_KEYS) {
      bestByMode[k] = Number(parsed.bestByMode[k]) || 0;
    }
  }
  return {
    bestScoreByMs,
    bestAverageByMs,
    bestAscentLevel: Number(parsed.bestAscentLevel) || 0,
    bestByMode,
    bestSurvival: Number(parsed.bestSurvival) || 0,
    bestBlitz: Number(parsed.bestBlitz) || 0,
  };
}

export function saveBests(next) {
  localStorage.setItem(BEST_KEY, JSON.stringify(next));
}

export function loadStats() {
  const parsed = loadJson(STATS_KEY, defaultStats);
  const modePlays = emptyModeCount();
  const modeAverageSum = emptyModeMap();
  if (parsed.modePlays) {
    for (const k of MODE_KEYS) modePlays[k] = Number(parsed.modePlays[k]) || 0;
  }
  if (parsed.modeAverageSum) {
    for (const k of MODE_KEYS) modeAverageSum[k] = Number(parsed.modeAverageSum[k]) || 0;
  }
  return {
    gamesPlayed: Number(parsed.gamesPlayed) || 0,
    totalAverageSum: Number(parsed.totalAverageSum) || 0,
    modePlays,
    modeAverageSum,
    history: Array.isArray(parsed.history) ? parsed.history.slice(0, HISTORY_LIMIT) : [],
  };
}

export function saveStats(next) {
  localStorage.setItem(STATS_KEY, JSON.stringify(next));
}

/**
 * @param {ReturnType<typeof loadStats>} stats
 * @param {string} mode
 * @param {number} average
 */
export function recordGame(stats, mode, average) {
  const next = {
    gamesPlayed: stats.gamesPlayed + 1,
    totalAverageSum: stats.totalAverageSum + average,
    modePlays: { ...stats.modePlays, [mode]: (stats.modePlays[mode] || 0) + 1 },
    modeAverageSum: {
      ...stats.modeAverageSum,
      [mode]: (stats.modeAverageSum[mode] || 0) + average,
    },
    history: [
      { mode, average, at: new Date().toISOString() },
      ...stats.history,
    ].slice(0, HISTORY_LIMIT),
  };
  saveStats(next);
  return next;
}

export function overallAverage(stats) {
  if (!stats.gamesPlayed) return 0;
  return Math.round(stats.totalAverageSum / stats.gamesPlayed);
}

export function modeAverage(stats, mode) {
  const n = stats.modePlays[mode] || 0;
  if (!n) return 0;
  return Math.round((stats.modeAverageSum[mode] || 0) / n);
}

/** @returns {{ date: string, average: number, scores: number[] }[]} */
export function loadDailyRecords() {
  const parsed = loadJson(DAILY_KEY, () => []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveDailyRecords(records) {
  localStorage.setItem(DAILY_KEY, JSON.stringify(records));
}

/**
 * Upsert today's daily result (keeps best average for the day).
 * @param {{ date: string, average: number, scores: number[] }[]} records
 * @param {{ date: string, average: number, scores: number[] }} entry
 */
export function upsertDaily(records, entry) {
  const idx = records.findIndex((r) => r.date === entry.date);
  let next;
  if (idx < 0) {
    next = [entry, ...records].slice(0, 90);
  } else if (entry.average > records[idx].average) {
    next = records.slice();
    next[idx] = entry;
  } else {
    next = records;
  }
  saveDailyRecords(next);
  return next;
}

export function loadPrefs() {
  const parsed = loadJson(PREFS_KEY, defaultPrefs);
  return { colorBlind: Boolean(parsed.colorBlind) };
}

export function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export { MODE_KEYS, HISTORY_LIMIT, BEST_KEY, STATS_KEY, DAILY_KEY, PREFS_KEY };
