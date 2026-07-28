// Watches for the states a beginner actually gets stuck in and says what to do
// about them.
//
// Every rule has a dwell time, because the useful signal is "this has been true
// for a while", not "this is true right now" — a boat passes through head to
// wind on every tack, and nagging about it would be noise. Rules are ranked, so
// when several fire at once the player is told the one thing that will unstick
// them rather than a pile of symptoms.

/** In priority order: the first whose dwell has elapsed is the one shown. */
export const HINTS = [
  {
    id: 'irons',
    dwell: 2.5,
    text: '頂風了：船頭正對著風，帆吃不到風。按空白鍵換舷，或轉舵讓綠色箭頭朝正上方。',
  },
  {
    id: 'luffing',
    dwell: 3,
    text: '帆在抖，沒吃滿風：按 Z 收帆，或按 C 交給自動調帆。',
  },
  {
    id: 'stalled',
    dwell: 3.5,
    text: '船快停住了：轉舵離開風向盤的紅色扇形，速度就會回來。',
  },
  {
    id: 'receding',
    dwell: 12,
    text: '正在遠離下一個閘門：閘門在上風處時無法直接開過去，跟著綠色箭頭走 Z 字。',
  },
  {
    id: 'offCourse',
    dwell: 6,
    text: '航向和建議路線差很多：跟著羅盤上的綠色箭頭轉舵。',
  },
];

// Keep showing a hint briefly after its cause clears, so a condition hovering
// on the threshold doesn't strobe the banner.
const LINGER = 1.2;

export function createCoach() {
  const dwell = new Map(HINTS.map((h) => [h.id, 0]));
  let lastDist = null;
  let recede = 0;
  let shown = null;
  let linger = 0;

  const reset = () => {
    for (const h of HINTS) dwell.set(h.id, 0);
    lastDist = null;
    recede = 0;
    shown = null;
    linger = 0;
  };

  return {
    reset,

    /**
     * state: { racing, awa, noGo, speed, luffing, autoTrim, easy, guideTurn,
     *          distToGate }
     * → the hint to show, or null.
     */
    update(state, dt) {
      if (!state.racing) {
        reset();
        return null;
      }

      // Losing ground only counts when it persists; bleed it off twice as fast
      // as it builds so a single wave or a tack doesn't trip it.
      if (lastDist !== null && state.distToGate > lastDist + 0.02) recede += dt;
      else recede = Math.max(0, recede - dt * 2);
      lastDist = state.distToGate;

      const holds = {
        irons: Math.abs(state.awa) < state.noGo,
        luffing: state.luffing > 0.4 && !state.autoTrim,
        stalled: state.speed < 1,
        receding: recede >= 12,
        offCourse: state.easy && Math.abs(state.guideTurn) > 1.05,
      };

      for (const h of HINTS) {
        if (h.id === 'receding') {
          dwell.set(h.id, holds.receding ? h.dwell : 0);
        } else {
          dwell.set(h.id, holds[h.id] ? dwell.get(h.id) + dt : 0);
        }
      }

      const next = HINTS.find((h) => dwell.get(h.id) >= h.dwell) ?? null;

      if (next) {
        shown = next;
        linger = LINGER;
      } else if (linger > 0) {
        linger -= dt;
        if (linger <= 0) shown = null;
      }

      return shown;
    },
  };
}
