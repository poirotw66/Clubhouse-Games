/** localStorage progress for Rubik's Cube Academy */
(function (root) {
  "use strict";

  const KEY = "rubiks-cube-academy:progress:v1";
  const TIMES_KEY = "rubiks-cube-academy:times:v1";
  const PRACTICE_KEY = "rubiks-cube-academy:practice:v1";
  const DAILY_KEY = "rubiks-cube-academy:daily:v1";
  const SFX_KEY = "rubiks-cube-academy:sfx:v1";

  function emptyProgress() {
    return {
      version: 1,
      completed: {},
      currentLessonId: "basics-pieces",
      freePlayVisits: 0,
      updatedAt: 0,
    };
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyProgress();
      const parsed = JSON.parse(raw);
      const completed = {};
      if (parsed && typeof parsed.completed === "object" && parsed.completed) {
        for (const [id, ts] of Object.entries(parsed.completed)) {
          if (typeof id === "string" && Number.isFinite(Number(ts))) {
            completed[id] = Number(ts);
          }
        }
      }
      return {
        version: 1,
        completed,
        currentLessonId:
          typeof parsed.currentLessonId === "string"
            ? parsed.currentLessonId
            : "basics-pieces",
        freePlayVisits: Math.max(0, Math.floor(Number(parsed.freePlayVisits) || 0)),
        updatedAt: Math.max(0, Math.floor(Number(parsed.updatedAt) || 0)),
      };
    } catch {
      return emptyProgress();
    }
  }

  function saveProgress(progress) {
    try {
      localStorage.setItem(KEY, JSON.stringify(progress));
    } catch {
      /* quota */
    }
  }

  function markComplete(progress, lessonId) {
    const next = {
      ...progress,
      completed: { ...progress.completed, [lessonId]: Date.now() },
      updatedAt: Date.now(),
    };
    const nxt = root.CubeCurriculum?.nextLessonId?.(lessonId);
    if (nxt && !next.completed[nxt]) next.currentLessonId = nxt;
    saveProgress(next);
    return next;
  }

  function setCurrentLesson(progress, lessonId) {
    const next = { ...progress, currentLessonId: lessonId, updatedAt: Date.now() };
    saveProgress(next);
    return next;
  }

  function emptyTimes() {
    return { runs: [], bestMs: null, updatedAt: 0 };
  }

  function loadTimes() {
    try {
      const raw = localStorage.getItem(TIMES_KEY);
      if (!raw) return emptyTimes();
      const parsed = JSON.parse(raw);
      const runs = Array.isArray(parsed.runs)
        ? parsed.runs
            .filter(
              (r) =>
                r &&
                typeof r.ms === "number" &&
                r.ms > 0 &&
                r.ms < 3_600_000 &&
                typeof r.at === "number" &&
                // New writes always set solved:true. Legacy rows omit the flag —
                // keep them, but never keep explicit solved:false.
                r.solved !== false,
            )
            .slice(-100)
        : [];
      let bestMs =
        parsed.bestMs != null && Number.isFinite(Number(parsed.bestMs))
          ? Number(parsed.bestMs)
          : null;
      if (runs.length) {
        const fromRuns = Math.min(...runs.map((r) => r.ms));
        bestMs = bestMs == null ? fromRuns : Math.min(bestMs, fromRuns);
      }
      return { runs, bestMs, updatedAt: Number(parsed.updatedAt) || 0 };
    } catch {
      return emptyTimes();
    }
  }

  function saveTimes(times) {
    try {
      localStorage.setItem(TIMES_KEY, JSON.stringify(times));
    } catch {
      /* quota */
    }
  }

  /**
   * Gate for WCA-style solve recording: cube must be solved and time sane.
   * Exported for unit tests — UI must call this before recordTime.
   */
  function canRecordSolve(isSolved, elapsedMs) {
    return (
      isSolved === true &&
      typeof elapsedMs === "number" &&
      Number.isFinite(elapsedMs) &&
      elapsedMs > 50 &&
      elapsedMs < 3_600_000
    );
  }

  function recordTime(times, ms, scramble, options = {}) {
    const solved = options.solved === true;
    if (!canRecordSolve(solved, ms)) {
      return times;
    }
    const run = {
      ms: Math.round(ms),
      at: Date.now(),
      scramble: typeof scramble === "string" ? scramble.slice(0, 200) : "",
      solved: true,
    };
    const bestMs =
      times.bestMs == null || run.ms < times.bestMs ? run.ms : times.bestMs;
    const next = {
      runs: [...times.runs, run].slice(-100),
      bestMs,
      updatedAt: Date.now(),
    };
    saveTimes(next);
    return next;
  }

  function isPersonalBest(times, ms) {
    if (!Number.isFinite(ms) || ms <= 0) return false;
    if (times.bestMs == null) return true;
    return ms <= times.bestMs;
  }

  function averageOf(runs, n) {
    if (runs.length < n) return null;
    const slice = runs.slice(-n).map((r) => r.ms);
    if (n >= 5) {
      // ao5 / ao12: drop best & worst
      const sorted = [...slice].sort((a, b) => a - b);
      const trimmed = sorted.slice(1, -1);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    }
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  function formatMs(ms) {
    if (ms == null || !Number.isFinite(ms)) return "—";
    const total = ms / 1000;
    const m = Math.floor(total / 60);
    const s = total - m * 60;
    if (m > 0) return `${m}:${s.toFixed(2).padStart(5, "0")}`;
    return s.toFixed(2);
  }

  function emptyStageStat() {
    return {
      attempts: 0,
      solves: 0,
      timedSolves: 0,
      bestMs: null,
      totalSolveMs: 0,
      lastAt: 0,
    };
  }

  function emptyPractice() {
    return { version: 1, byStage: {}, updatedAt: 0 };
  }

  function loadPractice() {
    try {
      const raw = localStorage.getItem(PRACTICE_KEY);
      if (!raw) return emptyPractice();
      const parsed = JSON.parse(raw);
      const byStage = {};
      if (parsed && typeof parsed.byStage === "object" && parsed.byStage) {
        for (const [stageId, rawStat] of Object.entries(parsed.byStage)) {
          if (typeof stageId !== "string" || !rawStat || typeof rawStat !== "object") continue;
          byStage[stageId] = {
            attempts: Math.max(0, Math.floor(Number(rawStat.attempts) || 0)),
            solves: Math.max(0, Math.floor(Number(rawStat.solves) || 0)),
            timedSolves: Math.max(0, Math.floor(Number(rawStat.timedSolves) || 0)),
            bestMs:
              rawStat.bestMs != null &&
              Number.isFinite(Number(rawStat.bestMs)) &&
              Number(rawStat.bestMs) > 0
                ? Number(rawStat.bestMs)
                : null,
            totalSolveMs: Math.max(0, Number(rawStat.totalSolveMs) || 0),
            lastAt: Math.max(0, Math.floor(Number(rawStat.lastAt) || 0)),
          };
        }
      }
      return { version: 1, byStage, updatedAt: Number(parsed.updatedAt) || 0 };
    } catch {
      return emptyPractice();
    }
  }

  function savePractice(practice) {
    try {
      localStorage.setItem(PRACTICE_KEY, JSON.stringify(practice));
    } catch {
      /* quota */
    }
  }

  function recordPracticeAttempt(practice, stageId) {
    const prev = practice.byStage[stageId] || emptyStageStat();
    const next = {
      ...practice,
      byStage: {
        ...practice.byStage,
        [stageId]: {
          ...prev,
          attempts: prev.attempts + 1,
          lastAt: Date.now(),
        },
      },
      updatedAt: Date.now(),
    };
    savePractice(next);
    return next;
  }

  function recordPracticeSolve(practice, stageId, ms) {
    const prev = practice.byStage[stageId] || emptyStageStat();
    const hasTime = Number.isFinite(ms) && ms > 50;
    const rounded = hasTime ? Math.round(ms) : null;
    let bestMs = prev.bestMs;
    let totalSolveMs = prev.totalSolveMs;
    let timedSolves = prev.timedSolves || 0;
    if (rounded != null) {
      bestMs = bestMs == null || rounded < bestMs ? rounded : bestMs;
      totalSolveMs += rounded;
      timedSolves += 1;
    }
    const next = {
      ...practice,
      byStage: {
        ...practice.byStage,
        [stageId]: {
          ...prev,
          solves: prev.solves + 1,
          timedSolves,
          bestMs,
          totalSolveMs,
          lastAt: Date.now(),
        },
      },
      updatedAt: Date.now(),
    };
    savePractice(next);
    return next;
  }

  function stageAverageMs(stat) {
    if (!stat) return null;
    const n = stat.timedSolves || 0;
    if (!n || !stat.totalSolveMs) return null;
    return stat.totalSolveMs / n;
  }

  /** Map curriculum lesson id → practice stage for proficiency chrome. */
  const LESSON_STAGE = {
    "white-cross": "white-cross",
    "white-corners": "white-corners",
    "second-layer": "second-layer",
    "yellow-cross": "yellow-cross",
    "yellow-orient": "yellow-orient",
    "permute-corners": "permute-corners",
    "permute-edges": "permute-edges",
  };

  /* -------- Daily scramble / streak -------- */

  function localDateKey(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function shiftDateKey(dateKey, deltaDays) {
    const [y, m, d] = String(dateKey).split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    return localDateKey(dt);
  }

  function emptyDaily() {
    return {
      version: 1,
      streak: 0,
      lastSolvedDate: null,
      byDate: {},
      updatedAt: 0,
    };
  }

  function loadDaily() {
    try {
      const raw = localStorage.getItem(DAILY_KEY);
      if (!raw) return emptyDaily();
      const parsed = JSON.parse(raw);
      const byDate = {};
      if (parsed && typeof parsed.byDate === "object" && parsed.byDate) {
        for (const [key, entry] of Object.entries(parsed.byDate)) {
          if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
          if (!entry || typeof entry !== "object") continue;
          byDate[key] = {
            scramble: typeof entry.scramble === "string" ? entry.scramble.slice(0, 200) : "",
            bestMs:
              entry.bestMs != null &&
              Number.isFinite(Number(entry.bestMs)) &&
              Number(entry.bestMs) > 0
                ? Number(entry.bestMs)
                : null,
            solves: Math.max(0, Math.floor(Number(entry.solves) || 0)),
            updatedAt: Math.max(0, Math.floor(Number(entry.updatedAt) || 0)),
          };
        }
      }
      return {
        version: 1,
        streak: Math.max(0, Math.floor(Number(parsed.streak) || 0)),
        lastSolvedDate:
          typeof parsed.lastSolvedDate === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(parsed.lastSolvedDate)
            ? parsed.lastSolvedDate
            : null,
        byDate,
        updatedAt: Math.max(0, Math.floor(Number(parsed.updatedAt) || 0)),
      };
    } catch {
      return emptyDaily();
    }
  }

  function saveDaily(daily) {
    try {
      localStorage.setItem(DAILY_KEY, JSON.stringify(daily));
    } catch {
      /* quota */
    }
  }

  function ensureDailyEntry(daily, dateKey, scramble) {
    const existing = daily.byDate[dateKey];
    if (existing && existing.scramble) {
      return { daily, entry: existing };
    }
    const entry = {
      scramble: typeof scramble === "string" ? scramble.slice(0, 200) : "",
      bestMs: existing?.bestMs ?? null,
      solves: existing?.solves ?? 0,
      updatedAt: Date.now(),
    };
    const next = {
      ...daily,
      byDate: { ...daily.byDate, [dateKey]: entry },
      updatedAt: Date.now(),
    };
    saveDaily(next);
    return { daily: next, entry };
  }

  function computeStreakOnSolve(daily, dateKey) {
    const last = daily.lastSolvedDate;
    if (last === dateKey) return daily.streak || 1;
    if (last && shiftDateKey(last, 1) === dateKey) {
      return (daily.streak || 0) + 1;
    }
    return 1;
  }

  function recordDailySolve(daily, dateKey, ms, scramble) {
    if (!canRecordSolve(true, ms)) return daily;
    const rounded = Math.round(ms);
    const prev = daily.byDate[dateKey] || {
      scramble: typeof scramble === "string" ? scramble.slice(0, 200) : "",
      bestMs: null,
      solves: 0,
      updatedAt: 0,
    };
    const bestMs =
      prev.bestMs == null || rounded < prev.bestMs ? rounded : prev.bestMs;
    const streak = computeStreakOnSolve(daily, dateKey);
    const next = {
      ...daily,
      streak,
      lastSolvedDate: dateKey,
      byDate: {
        ...daily.byDate,
        [dateKey]: {
          scramble: prev.scramble || (typeof scramble === "string" ? scramble.slice(0, 200) : ""),
          bestMs,
          solves: prev.solves + 1,
          updatedAt: Date.now(),
        },
      },
      updatedAt: Date.now(),
    };
    saveDaily(next);
    return next;
  }

  function formatShareText(daily, dateKey, options = {}) {
    const entry = daily.byDate[dateKey];
    const best =
      entry?.bestMs != null ? formatMs(entry.bestMs) : options.fallbackMs != null
        ? formatMs(options.fallbackMs)
        : "—";
    const scramble = entry?.scramble || options.scramble || "—";
    const streak = daily.streak || 0;
    return [
      "魔術方塊學院 · 每日打亂",
      `日期：${dateKey}`,
      `今天最佳：${best}`,
      `連續天數：${streak}`,
      `打亂：${scramble}`,
      "#魔術方塊學院 #每日打亂",
    ].join("\n");
  }

  /**
   * Compare averages before/after appending a solve.
   * Returns which of PB / ao5 / ao12 improved (first aoN counts as a milestone).
   */
  function detectRecordBreaks(prevTimes, nextTimes, ms) {
    const isPb =
      prevTimes.bestMs == null || (Number.isFinite(ms) && ms < prevTimes.bestMs);
    const prevAo5 = averageOf(prevTimes.runs, 5);
    const nextAo5 = averageOf(nextTimes.runs, 5);
    const prevAo12 = averageOf(prevTimes.runs, 12);
    const nextAo12 = averageOf(nextTimes.runs, 12);
    const brokeAo5 =
      nextAo5 != null && (prevAo5 == null || nextAo5 < prevAo5);
    const brokeAo12 =
      nextAo12 != null && (prevAo12 == null || nextAo12 < prevAo12);
    return {
      isPb: Boolean(isPb),
      brokeAo5: Boolean(brokeAo5),
      brokeAo12: Boolean(brokeAo12),
      ao5: nextAo5,
      ao12: nextAo12,
    };
  }

  root.CubeProgress = {
    KEY,
    TIMES_KEY,
    PRACTICE_KEY,
    DAILY_KEY,
    SFX_KEY,
    emptyProgress,
    loadProgress,
    saveProgress,
    markComplete,
    setCurrentLesson,
    emptyTimes,
    loadTimes,
    saveTimes,
    canRecordSolve,
    recordTime,
    isPersonalBest,
    averageOf,
    formatMs,
    emptyPractice,
    emptyStageStat,
    loadPractice,
    savePractice,
    recordPracticeAttempt,
    recordPracticeSolve,
    stageAverageMs,
    LESSON_STAGE,
    localDateKey,
    shiftDateKey,
    emptyDaily,
    loadDaily,
    saveDaily,
    ensureDailyEntry,
    computeStreakOnSolve,
    recordDailySolve,
    formatShareText,
    detectRecordBreaks,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
