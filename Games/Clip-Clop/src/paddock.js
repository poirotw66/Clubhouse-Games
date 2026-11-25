import { CFG, makeHorseState, makeLegStates, simHorse, setPhysicsTier } from './physics.js';

/** Real-physics 20m flat warm-up evaluation helper. */
export function simulateWarmupGait(steps = 2000, tier = 'arcade') {
  setPhysicsTier(tier);
  const state = makeHorseState();
  const legs = makeLegStates();
  let stepEvents = 0;
  for (let i = 0; i < steps; i++) {
    const input = Math.floor(i / 70) % 2
      ? [true, false, false, true, false]
      : [false, true, true, false, false];
    const ev = simHorse(state, legs, input, CFG.STEP);
    stepEvents += ev.filter(e => e.type === 'step').length;
  }
  return {
    distance: state.x,
    topSpeed: state.topSpeed,
    steps: state.steps,
    stepEvents,
    fallPose: state.fallPose,
    roll: state.roll,
    stable: Math.abs(state.roll) < 0.15 && state.fallPose === null,
  };
}

/** A safe, untimed rehearsal of the real diagonal gait. Never drives the race. */
export function setupPaddock({ tr, isActive }) {
  const stage = document.getElementById('gaitStage');
  const feedback = document.getElementById('gaitFeedback');
  const progress = document.getElementById('gaitProgress');
  const buttons = {
    A: document.getElementById('gaitBeatA'),
    B: document.getElementById('gaitBeatB'),
  };
  const keys = new Set();
  let completed = 0;
  let message = 'paddock_gait_ready';
  let animationTimer;
  let activePair = '';
  let lastBeatTime = 0;

  function refresh() {
    progress.textContent = `${completed} / 2`;
    stage.dataset.progress = String(completed);
    feedback.textContent = tr(message);
    feedback.classList.toggle('is-complete', completed === 2);
    buttons.A.classList.toggle('is-next', completed === 0);
    buttons.B.classList.toggle('is-next', completed === 1);
  }
  function releasePose() {
    clearTimeout(animationTimer);
    stage.dataset.pair = '';
    Object.values(buttons).forEach(button => {
      button.classList.remove('is-current');
      button.setAttribute('aria-pressed', 'false');
    });
  }
  function playBeat(pair) {
    if (!isActive()) return;
    const now = performance.now();
    const interval = lastBeatTime ? now - lastBeatTime : 400;
    lastBeatTime = now;
    releasePose();
    stage.dataset.pair = pair;
    buttons[pair].classList.add('is-current');
    buttons[pair].setAttribute('aria-pressed', 'true');
    if (pair === 'A' && completed === 0) {
      completed = 1;
      message = 'paddock_gait_next';
    } else if (pair === 'B' && completed === 1) {
      completed = 2;
      message = (interval >= 220 && interval <= 650) ? 'paddock_warmup_optimal' : 'paddock_gait_done';
    } else if (completed === 0) {
      message = 'paddock_gait_first';
    }
    refresh();
    animationTimer = setTimeout(releasePose, 420);
  }
  buttons.A.addEventListener('click', () => playBeat('A'));
  buttons.B.addEventListener('click', () => playBeat('B'));

  const gaitKeys = new Set(['KeyQ', 'KeyW', 'KeyO', 'KeyP']);
  document.addEventListener('keydown', event => {
    if (!isActive() || !gaitKeys.has(event.code) || event.repeat) return;
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    keys.add(event.code);
    if (keys.size > 2) {
      message = 'paddock_gait_four';
      refresh();
      return;
    }
    const pair = keys.has('KeyQ') && keys.has('KeyP') ? 'A'
      : keys.has('KeyW') && keys.has('KeyO') ? 'B' : '';
    if (pair && pair !== activePair) {
      activePair = pair;
      playBeat(pair);
    }
  });
  document.addEventListener('keyup', event => {
    keys.delete(event.code);
    if (keys.size === 0) activePair = '';
  });
  window.addEventListener('blur', () => { keys.clear(); activePair = ''; releasePose(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { keys.clear(); activePair = ''; releasePose(); }
  });
  refresh();
  return refresh;
}

/* ================================================================
   Tournament 3-leg mechanics
   Pony (leg 1) -> Racehorse (leg 2) -> Legend (leg 3)
   Points: 3 pts per win, 0 per loss. 9 pts = champion.
================================================================ */
export const TOUR_AI = ['pony', 'race', 'legend'];

export function createTournament() {
  return {
    on: true,
    leg: 1,
    pts: 0,
    marks: '',
    history: [],
  };
}

export function evaluateTourLeg(tour, playerFinishTime, playerDnf, aiFinishTime) {
  if (!tour || !tour.on) throw new Error('Tournament is not active');
  if (tour.leg < 1 || tour.leg > 3) throw new Error('Invalid tournament leg');
  const win = !playerDnf && (aiFinishTime == null || playerFinishTime <= aiFinishTime);
  tour.pts += win ? 3 : 0;
  tour.marks += win ? '勝' : '負';
  tour.history.push({
    leg: tour.leg,
    opponent: TOUR_AI[tour.leg - 1],
    win,
    playerTime: playerFinishTime,
    aiTime: aiFinishTime,
    dnf: !!playerDnf,
  });
  return win;
}

export function advanceTourLeg(tour) {
  if (!tour || !tour.on) throw new Error('Tournament is not active');
  if (tour.leg < 3) {
    tour.leg += 1;
    return true;
  }
  return false;
}

export function tournamentCup(pts) {
  if (pts >= 9) return 'champ9';
  if (pts >= 6) return 'champ6';
  if (pts >= 3) return 'champ3';
  return 'champ0';
}

export function tournamentCupIcon(pts) {
  if (pts >= 9) return '🏆';
  if (pts >= 6) return '🥈';
  if (pts >= 3) return '🥉';
  return '🐎';
}

/* ================================================================
   Local 2-player duel rules
   Alternating timed runs (1P then 2P), winner compared.
================================================================ */
export function createDuel() {
  return {
    on: true,
    turn: 1,
    t1: 0,
    t2: 0,
    dnf1: false,
    dnf2: false,
  };
}

export function recordDuelTurn(duel, finishTime, dnf = false) {
  if (!duel || !duel.on) throw new Error('Duel is not active');
  if (duel.turn === 1) {
    duel.t1 = finishTime;
    duel.dnf1 = !!dnf;
  } else {
    duel.t2 = finishTime;
    duel.dnf2 = !!dnf;
  }
}

export function evaluateDuel(duel) {
  if (!duel || !duel.on) throw new Error('Duel is not active');
  if (duel.dnf1 && duel.dnf2) {
    return { winner: 0, key: 'duel_draw', icon: '🤝' };
  }
  if (duel.dnf1) {
    return { winner: 2, key: 'duel_p2win', icon: '2️⃣' };
  }
  if (duel.dnf2) {
    return { winner: 1, key: 'duel_p1win', icon: '1️⃣' };
  }
  if (duel.t1 < duel.t2) {
    return { winner: 1, key: 'duel_p1win', icon: '1️⃣' };
  }
  if (duel.t2 < duel.t1) {
    return { winner: 2, key: 'duel_p2win', icon: '2️⃣' };
  }
  return { winner: 0, key: 'duel_draw', icon: '🤝' };
}

/* ================================================================
   Battle code serialization & rival ghost pose reconstruction
   Payload: { v: 1, t: 10*s, f: falls, s: steps, sp: 36*topSpeed, x: [10Hz, 0.1m] }
   Encoding: CC1.<deflate+base64url> or CC0.<raw+base64url>
================================================================ */
export const b64u = {
  enc: b => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
};

export async function deflateText(str) {
  if (typeof CompressionStream === 'undefined') return null;
  const cs = new CompressionStream('deflate-raw');
  const w = cs.writable.getWriter();
  w.write(new TextEncoder().encode(str)).catch(() => {});
  w.close().catch(() => {});
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

export async function inflateText(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('no-inflate');
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter();
  w.write(bytes).catch(() => {});
  w.close().catch(() => {});
  return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
}

export async function makeBattleCodeFromRec(rec, finishTime, falls = 0, steps = 0, topSpeed = 0) {
  if (!Array.isArray(rec)) throw new Error('Invalid recording frames');
  const xs = [];
  for (let i = 0; i < rec.length; i += 3) {
    const frame = rec[i];
    const xVal = Array.isArray(frame) ? frame[0] : (typeof frame === 'number' ? frame : 0);
    xs.push(Math.round(xVal * 10)); // 10 Hz, 0.1 m units
  }
  const payload = {
    v: 1,
    t: Math.round(finishTime * 10),
    f: Math.round(falls),
    s: Math.round(steps),
    sp: Math.round(topSpeed * 36),
    x: xs,
  };
  const json = JSON.stringify(payload);
  const def = await deflateText(json);
  return def ? ('CC1.' + b64u.enc(def)) : ('CC0.' + b64u.enc(new TextEncoder().encode(json)));
}

export async function parseBattleCode(raw) {
  const code = (raw || '').replace(/\s+/g, '');
  const m = /^CC([01])\.([A-Za-z0-9_-]+)$/.exec(code);
  if (!m) throw new Error('Invalid battle code header format');
  const bytes = b64u.dec(m[2]);
  let json;
  try {
    json = m[1] === '1' ? await inflateText(bytes) : new TextDecoder().decode(bytes);
  } catch (err) {
    throw new Error('Decompression failed: ' + (err?.message || err));
  }
  let p;
  try {
    p = JSON.parse(json);
  } catch (err) {
    throw new Error('Invalid JSON in battle code: ' + (err?.message || err));
  }
  if (!p || p.v !== 1 || !Array.isArray(p.x) || p.x.length < 10) {
    throw new Error('Corrupted or truncated battle code payload');
  }
  return p;
}

export function rivalPoseFrom(p, bodyY = 1.05) {
  if (!p || !Array.isArray(p.x)) throw new Error('Invalid rival payload for pose generation');
  const frames = [];
  const n = p.x.length;
  let ph = 0;
  for (let i = 0; i < n * 3; i++) {
    const t10 = i / 3;
    const k = Math.floor(t10);
    const a = p.x[Math.max(0, Math.min(n - 1, k - 1))];
    const b = p.x[Math.max(0, Math.min(n - 1, k))];
    const c = p.x[Math.max(0, Math.min(n - 1, k + 1))];
    const x = ((b - a) + (c - a) * (t10 - k)) * 0.05 + a * 0.1;
    const sp = Math.max(0, b - a);
    ph += sp * 5.0 / 30;
    const A = 0.35 * Math.min(1, sp / 1.2);
    const s1 = Math.sin(ph), s2 = Math.sin(ph + Math.PI);
    const lift = q => Math.max(0, Math.min(1, q * 1.3));
    const y = bodyY + 0.03 * Math.sin(ph * 2);
    frames.push([
      Math.round(x * 1000) / 1000,
      Math.round(y * 1000) / 1000,
      0, 0, 0, 0,
      s1 * A, -s2 * A, -s2 * A, s1 * A,
      lift(s1 * A), lift(-s2 * A), lift(-s2 * A), lift(s1 * A),
    ]);
  }
  return frames;
}

/* ================================================================
   Supabase leaderboard payload formatter & validator
================================================================ */
export function formatLeaderboardPayload({
  name,
  finishTime,
  falls = 0,
  steps = 0,
  topSpeed = 0,
  code,
  mode = 'normal',
  day = null,
}) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Player name is required');
  const cleanName = name.trim().slice(0, 10);
  if (typeof finishTime !== 'number' || !Number.isFinite(finishTime) || finishTime <= 0) {
    throw new Error('Valid finishTime is required');
  }
  if (typeof falls !== 'number' || !Number.isFinite(falls) || falls < 0) {
    throw new Error('Valid falls count is required');
  }
  if (typeof code !== 'string' || !/^CC[01]\.[A-Za-z0-9_-]+$/.test(code)) {
    throw new Error('Valid CC battle code is required');
  }
  if (mode !== 'normal' && mode !== 'daily') {
    throw new Error('Mode must be normal or daily');
  }
  if (mode === 'daily' && (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day))) {
    throw new Error('Valid day format YYYY-MM-DD is required for daily mode');
  }

  return {
    name: cleanName,
    time_ms: Math.round(finishTime * 1000),
    falls: Math.round(falls),
    steps: Math.round(steps),
    speed: Math.round(topSpeed * 36),
    code,
    mode,
    day: mode === 'daily' ? day : null,
  };
}
