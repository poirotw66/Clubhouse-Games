/** localStorage progress for Rubik's Cube Academy */
(function (root) {
  "use strict";

  const KEY = "rubiks-cube-academy:progress:v1";
  const TIMES_KEY = "rubiks-cube-academy:times:v1";

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
    return { runs: [], updatedAt: 0 };
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
                typeof r.at === "number",
            )
            .slice(-100)
        : [];
      return { runs, updatedAt: Number(parsed.updatedAt) || 0 };
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

  function recordTime(times, ms, scramble) {
    const run = {
      ms: Math.round(ms),
      at: Date.now(),
      scramble: typeof scramble === "string" ? scramble.slice(0, 200) : "",
    };
    const next = {
      runs: [...times.runs, run].slice(-100),
      updatedAt: Date.now(),
    };
    saveTimes(next);
    return next;
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

  root.CubeProgress = {
    KEY,
    TIMES_KEY,
    emptyProgress,
    loadProgress,
    saveProgress,
    markComplete,
    setCurrentLesson,
    emptyTimes,
    loadTimes,
    saveTimes,
    recordTime,
    averageOf,
    formatMs,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
