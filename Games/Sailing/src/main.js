// 海灣帆航 — entry point: boot WebGL, run the race loop, drive the HUD.

import { createContext, resize } from './gl.js';
import { createSky } from './sky.js';
import { createOcean } from './ocean.js';
import { createSolidProgram } from './solid.js';
import { createBoat } from './boat.js';
import { createBoatState, createWind, stepSailing, pointOfSail, NO_GO } from './sailing.js';
import { createAssist, steerTo, wrap } from './assist.js';
import { createCoach } from './coach.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createCourse as loadCourseDef } from './courses.js';
import { listCourses } from './courses.js';
import { createMarks, gatePosts, markKind } from './marks.js';
import { clamp } from './math.js';
import {
  sfxFinish,
  sfxGateClear,
  sfxGust,
  sfxLuff,
  sfxMarkRound,
  sfxTrimSweet,
  sfxUnlock,
} from './sfx.js';
import { createResultOverlay } from '@clubhouse/shared/resultOverlayDom';
import {
  bestFor,
  isUnlocked,
  loadProgress,
  recordFinish,
  recordRegatta,
} from './progress.js';
import { createGhostPlayback, createGhostRecorder, loadGhost, saveGhost } from './ghost.js';
import { createRival, pickRaceRivals } from './rivals.js';

const WAVE_AMP = 1.0;
const WAVE_AMP_EASY = 0.45;
const EASY_KEY = 'sailing-easy';
const TUTORIAL_KEY = 'sailing-tutorial-v1';
const PLACE_POINTS = [5, 3, 1];
const SUN_DIR = (() => {
  const a = (28 * Math.PI) / 180;
  const e = (42 * Math.PI) / 180;
  return [
    Math.cos(e) * Math.sin(a),
    Math.sin(e),
    Math.cos(e) * Math.cos(a),
  ];
})();

const HORIZON = [0.62, 0.74, 0.86];
const DEEP = [0.02, 0.12, 0.22];
const SHALLOW = [0.08, 0.38, 0.42];

/** @typedef {'trial'|'race'|'regatta'} PlayMode */

function $(sel) {
  return document.querySelector(sel);
}

function formatTime(sec) {
  if (sec == null || Number.isNaN(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function boot() {
  const canvas = $('#gl');
  let gl;
  try {
    gl = createContext(canvas);
  } catch (err) {
    const el = $('#boot-error');
    el.hidden = false;
    el.textContent = '此瀏覽器不支援 WebGL2，無法啟動 3D 帆船。';
    console.error(err);
    return;
  }

  try {
    startGame(gl, canvas);
  } catch (err) {
    const el = $('#boot-error');
    el.hidden = false;
    el.textContent = `啟動失敗：${err?.message || err}`;
    console.error(err);
  }
}

function startGame(gl, canvas) {
  const sky = createSky(gl);
  const ocean = createOcean(gl);
  ocean.useSkyTexture(sky.texture);
  const solid = createSolidProgram(gl);
  const boatMesh = createBoat(gl, solid);
  const rivalMeshes = [createBoat(gl, solid), createBoat(gl, solid)];
  const ghostMesh = createBoat(gl, solid);

  let progress = loadProgress();
  /** @type {PlayMode} */
  let playMode = 'trial';
  let courseId = 'harbor';
  let course = loadCourseDef(courseId);
  let regattaQueue = [];
  let regattaIndex = 0;
  let regattaPoints = 0;
  let regattaPlaces = [];

  const wind = createWind(1, course.wind);
  const marks = createMarks(gl, solid, course);
  const camera = createCamera();
  const input = createInput(document.body);
  const assist = createAssist();
  const coach = createCoach();
  const ghostRecorder = createGhostRecorder();
  /** @type {ReturnType<typeof createGhostPlayback>|null} */
  let ghostPlayback = null;
  /** @type {ReturnType<typeof createRival>[]} */
  let rivals = [];

  input.easy = localStorage.getItem(EASY_KEY) !== 'off';
  let bestTime = bestFor(progress, courseId, input.easy ? 'easy' : 'pro');

  input.onEasyChange = (on) => {
    localStorage.setItem(EASY_KEY, on ? 'on' : 'off');
    bestTime = bestFor(progress, courseId, on ? 'easy' : 'pro');
    if (on) {
      input.autoTrim = true;
      showToast('簡單模式：按住 ↑ 加速，← → 轉彎衝閘門！');
    } else {
      showToast('專業模式：自己控帆，挑戰更短完賽時間');
    }
    syncEasyUi();
    updateHud(0);
    refreshMenuMeta();
  };

  let tackTarget = null;
  let tackTimer = 0;
  let perfectGates = 0;
  const minimap = $('#minimap');
  const miniCtx = minimap.getContext('2d');

  let boat = createBoatState(course.start.heading);
  boat.x = course.start.x;
  boat.z = course.start.z;
  boat.surge = 9.0;
  marks.reset(boat);
  assist.reset(boat, wind);

  for (const g of course.gates) {
    if (g.halfWidth != null && g._half == null) g._half = g.halfWidth;
  }

  /** @type {'menu'|'countdown'|'racing'|'finished'} */
  let phase = 'menu';
  let countdown = 3.2;
  let raceTime = 0;
  /** @type {{ name: string, time: number }[]} */
  let splits = [];
  let toastTimer = 0;
  let lastTrimSweet = false;
  let luffSfxCooldown = 0;

  const wake = [];
  let wakeAcc = 0;

  const hud = {
    speed: $('#hud-speed'),
    wind: $('#hud-wind'),
    awa: $('#hud-awa'),
    windTip: $('#hud-wind-tip'),
    point: $('#hud-point'),
    trim: $('#hud-trim'),
    trimFill: $('#trim-fill'),
    trimIdeal: $('#trim-ideal'),
    mark: $('#hud-mark'),
    time: $('#hud-time'),
    best: $('#hud-best'),
    dist: $('#hud-dist'),
    progress: $('#hud-progress'),
    splits: $('#hud-splits'),
    auto: $('#btn-autotrim'),
    compass: $('#wind-needle'),
    arrow: $('#cp-arrow'),
    guide: $('#cp-guide'),
    guideTip: $('#hud-guide'),
    tackBtn: $('#btn-tack'),
    windCue: $('#wind-cue'),
    windCueArrow: $('#wind-cue .wind-cue-arrow'),
    windCueLabel: $('#wind-cue-label'),
    courseCue: $('#course-cue'),
    courseCueArrow: $('#course-cue-arrow'),
    goBtn: $('#btn-go'),
    keyGo: document.querySelector('.key-go'),
    gateBeacon: $('#gate-beacon'),
    gateBeaconName: $('#gate-beacon-name'),
    gateBeaconDist: $('#gate-beacon-dist'),
    speedReadout: $('#speed-readout'),
    speedValue: $('#speed-value'),
    speedMs: $('#speed-ms'),
    speedBarFill: $('#speed-bar-fill'),
    coach: $('#coach'),
    coachText: $('#coach-text'),
    toast: $('#toast'),
    countdown: $('#countdown'),
    tutorial: $('#tutorial-tip'),
    raceStandings: $('#race-standings'),
    gustBadge: $('#gust-badge'),
    courseLabel: $('#hud-course'),
    modeLabel: $('#hud-mode'),
  };

  const resultOverlay = createResultOverlay(document.body);

  function modeKey() {
    return input.easy ? 'easy' : 'pro';
  }

  function syncEasyUi() {
    const easy = input.easy;
    document.body.classList.toggle('easy-mode', easy);
    for (const g of course.gates) {
      if (g._half != null) g.halfWidth = easy ? g._half * 1.25 : g._half;
    }
    if (hud.goBtn) hud.goBtn.hidden = !easy;
    if (hud.tackBtn) hud.tackBtn.hidden = !easy;
    document.querySelectorAll('[data-hold="trimIn"], [data-hold="trimOut"]').forEach((el) => {
      el.hidden = easy;
    });
    const trimPanel = document.querySelector('.trim-panel');
    if (trimPanel) trimPanel.hidden = easy;
    if (hud.auto) hud.auto.hidden = easy;
    const windRose = document.querySelector('.wind-rose');
    if (windRose) windRose.hidden = easy;
  }

  function showToast(text) {
    hud.toast.textContent = text;
    hud.toast.classList.add('show');
    toastTimer = 2.2;
  }

  if (input.easy) input.autoTrim = true;
  syncEasyUi();

  function refreshMenuMeta() {
    const list = $('#course-list');
    if (!list) return;
    list.innerHTML = '';
    for (const c of listCourses()) {
      const unlocked = isUnlocked(progress, c.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `course-card${courseId === c.id ? ' selected' : ''}${unlocked ? '' : ' locked'}`;
      btn.disabled = !unlocked;
      const easyBest = bestFor(progress, c.id, 'easy');
      const proBest = bestFor(progress, c.id, 'pro');
      btn.innerHTML = `
        <span class="course-card-name">${c.name}${unlocked ? '' : ' 🔒'}</span>
        <span class="course-card-blurb">${c.blurb}</span>
        <span class="course-card-best">最佳 簡單 ${formatTime(easyBest)} · 專業 ${formatTime(proBest)}</span>
      `;
      btn.addEventListener('click', () => {
        if (!unlocked) return;
        courseId = c.id;
        refreshMenuMeta();
      });
      list.appendChild(btn);
    }

    document.querySelectorAll('[data-play-mode]').forEach((el) => {
      el.classList.toggle('selected', el.getAttribute('data-play-mode') === playMode);
    });

    const reg = progress.regatta;
    const meta = $('#menu-meta');
    if (meta) {
      meta.textContent = `出航 ${progress.races} 次 · 海灣盃 ${reg.wins} 勝 / 最佳 ${reg.bestPoints ?? '—'} 分`;
    }
  }

  function applyCourse(id) {
    courseId = id;
    course = loadCourseDef(courseId);
    for (const g of course.gates) {
      if (g.halfWidth != null) g._half = g.halfWidth;
    }
    marks.setCourse(course);
    wind.applyProfile(course.wind);
    bestTime = bestFor(progress, courseId, modeKey());
    syncEasyUi();
    if (hud.courseLabel) hud.courseLabel.textContent = course.name;
  }

  function setupGhost() {
    ghostPlayback = null;
    if (playMode !== 'trial') return;
    const tape = loadGhost(courseId, modeKey());
    if (tape) ghostPlayback = createGhostPlayback(tape);
  }

  function setupRivals() {
    rivals = [];
    if (playMode === 'trial') return;
    const profiles = pickRaceRivals(courseId.length + regattaIndex);
    profiles.forEach((profile, i) => {
      const tracker = marks.createTracker();
      const rival = createRival(profile, course.start, tracker, (i + 1) * 6 * (i % 2 === 0 ? 1 : -1));
      rival.reset(course.start, wind);
      rivals.push(rival);
    });
  }

  function modeLabelText() {
    if (playMode === 'race') return '對戰';
    if (playMode === 'regatta') return `海灣盃 ${regattaIndex + 1}/${regattaQueue.length || 3}`;
    return '計時賽';
  }

  function beginRaceSession() {
    if (playMode === 'regatta') {
      regattaQueue = listCourses().map((c) => c.id);
      regattaIndex = 0;
      regattaPoints = 0;
      regattaPlaces = [];
      applyCourse(regattaQueue[0]);
    } else {
      applyCourse(courseId);
    }
    if (hud.modeLabel) hud.modeLabel.textContent = modeLabelText();
    setupGhost();
    setupRivals();
    resetRace();
    phase = 'countdown';
  }

  function renderSplits() {
    const gates = course.gates;
    hud.splits.innerHTML = gates.map((g, i) => {
      const done = i < marks.nextIndex;
      const next = i === marks.nextIndex;
      const split = splits[i];
      const time = split ? formatTime(split.time) : '—';
      return `<li class="${done ? 'done' : ''} ${next ? 'next' : ''}"><span>${g.name}</span><span>${time}</span></li>`;
    }).join('');
  }

  function courseBounds() {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const g of course.gates) {
      minX = Math.min(minX, g.x);
      maxX = Math.max(maxX, g.x);
      minZ = Math.min(minZ, g.z);
      maxZ = Math.max(maxZ, g.z);
    }
    const m = 42;
    return { minX: minX - m, maxX: maxX + m, minZ: minZ - m, maxZ: maxZ + m };
  }

  const MINI_SCALE = 2;
  const GATE_LABELS = ['起', '1', '2', '3', '4', '5'];

  function markerPath(ctx, px, pz, h, len, halfW) {
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    ctx.beginPath();
    ctx.moveTo(px + fx * len, pz + fz * len);
    ctx.lineTo(px - fx * len * 0.6 + fz * halfW, pz - fz * len * 0.6 - fx * halfW);
    ctx.lineTo(px - fx * len * 0.6 - fz * halfW, pz - fz * len * 0.6 + fx * halfW);
    ctx.closePath();
  }

  function drawMinimap() {
    const ctx = miniCtx;
    const w = minimap.width / MINI_SCALE;
    const h = minimap.height / MINI_SCALE;
    ctx.setTransform(MINI_SCALE, 0, 0, MINI_SCALE, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(6, 22, 34, 0.66)';
    ctx.fillRect(0, 0, w, h);

    const { minX, maxX, minZ, maxZ } = courseBounds();
    const pad = 14;
    const s = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxZ - minZ));
    const ox = (w - (maxX - minX) * s) * 0.5;
    const oz = (h - (maxZ - minZ) * s) * 0.5;
    const tx = (x) => ox + (clamp(x, minX, maxX) - minX) * s;
    const tz = (z) => oz + (clamp(z, minZ, maxZ) - minZ) * s;
    const nextIndex = marks.nextIndex;

    for (let j = 0; j < course.gates.length - 1; j++) {
      const a = course.gates[j];
      const b = course.gates[j + 1];
      const done = nextIndex > j + 1;
      const active = nextIndex === j + 1;
      const ax = tx(a.x);
      const az = tz(a.z);
      const bx = tx(b.x);
      const bz = tz(b.z);
      ctx.strokeStyle = active ? 'rgba(44,181,168,0.95)'
        : done ? 'rgba(232,244,246,0.16)' : 'rgba(232,244,246,0.34)';
      ctx.lineWidth = active ? 2.4 : 1.5;
      ctx.setLineDash(done ? [3, 3] : []);
      ctx.beginPath();
      ctx.moveTo(ax, az);
      ctx.lineTo(bx, bz);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    course.gates.forEach((g, i) => {
      if (g.isFinish) return;
      const finishNext = marks.nextGate?.isFinish;
      const isNext = i === nextIndex || (finishNext && i === 0);
      const done = i < nextIndex && !(finishNext && i === 0);
      const tint = isNext ? '#2cb5a8' : done ? 'rgba(160,170,180,0.5)' : 'rgba(240,122,42,0.9)';
      const cx = tx(g.x);
      const cz = tz(g.z);

      if (markKind(g) === 'gate') {
        const p = gatePosts(g);
        ctx.strokeStyle = tint;
        ctx.lineWidth = isNext ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(tx(p.left.x), tz(p.left.z));
        ctx.lineTo(tx(p.right.x), tz(p.right.z));
        ctx.stroke();
      } else {
        ctx.strokeStyle = tint;
        ctx.beginPath();
        ctx.arc(cx, cz, isNext ? 8 : 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(cx, cz, isNext ? 9 : 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isNext || !done ? '#06212c' : 'rgba(232,244,246,0.75)';
      ctx.font = '700 10px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(finishNext && i === 0 ? '終' : GATE_LABELS[i] ?? String(i), cx, cz + 0.5);
    });

    for (const rival of rivals) {
      markerPath(ctx, tx(rival.boat.x), tz(rival.boat.z), rival.boat.heading, 6, 4);
      ctx.fillStyle = `rgb(${rival.profile.tint.map((v) => Math.round(v * 255)).join(',')})`;
      ctx.fill();
    }

    if (ghostPlayback && phase === 'racing') {
      const g = ghostPlayback.sample(raceTime);
      markerPath(ctx, tx(g.x), tz(g.z), g.heading, 6, 4);
      ctx.fillStyle = 'rgba(180,220,255,0.55)';
      ctx.fill();
    }

    const bx = tx(boat.x);
    const bz = tz(boat.z);
    if (input.easy && marks.nextGate && phase !== 'finished') {
      const rec = assist.recommend(boat, wind, marks.nextGate, input.easy);
      ctx.strokeStyle = 'rgba(142,247,210,0.9)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(bx, bz);
      ctx.lineTo(bx + Math.sin(rec.heading) * 22, bz + Math.cos(rec.heading) * 22);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    markerPath(ctx, bx, bz, boat.heading, 8, 5.5);
    ctx.fillStyle = '#e8f4f6';
    ctx.strokeStyle = 'rgba(6,22,34,0.9)';
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();

    const wx = w - 17;
    const wz = 15;
    const blowing = wind.from + Math.PI;
    ctx.strokeStyle = 'rgba(240,122,42,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(wx - Math.sin(blowing) * 8, wz - Math.cos(blowing) * 8);
    ctx.lineTo(wx + Math.sin(blowing) * 4, wz + Math.cos(blowing) * 4);
    ctx.stroke();
    markerPath(ctx, wx + Math.sin(blowing) * 4, wz + Math.cos(blowing) * 4, blowing, 5, 3.6);
    ctx.fillStyle = 'rgba(240,122,42,0.9)';
    ctx.fill();
    ctx.fillStyle = 'rgba(240,122,42,0.95)';
    ctx.font = '700 8px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('風', wx, wz + 15);
  }

  function updateStandings() {
    const el = hud.raceStandings;
    if (!el) return;
    if (playMode === 'trial' || phase === 'menu') {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const rows = [
      { name: '你', time: phase === 'finished' ? raceTime : null, progress: marks.nextIndex, you: true },
      ...rivals.map((r) => ({
        name: r.profile.name,
        time: r.finishTime,
        progress: r.nextIndex,
        you: false,
      })),
    ];
    rows.sort((a, b) => {
      if (a.time != null && b.time != null) return a.time - b.time;
      if (a.time != null) return -1;
      if (b.time != null) return 1;
      return b.progress - a.progress;
    });
    el.innerHTML = rows.map((r, i) => (
      `<div class="stand-row${r.you ? ' you' : ''}"><span>${i + 1}. ${r.name}</span>`
      + `<span>${r.time != null ? formatTime(r.time) : `${r.progress}/${course.gates.length}`}</span></div>`
    )).join('');
  }

  function resetRace() {
    boat = createBoatState(course.start.heading);
    boat.x = course.start.x;
    boat.z = course.start.z;
    boat.surge = 9.0;
    marks.reset(boat);
    assist.reset(boat, wind);
    coach.reset();
    hud.coach.hidden = true;
    tackTarget = null;
    perfectGates = 0;
    phase = 'countdown';
    countdown = 3.2;
    raceTime = 0;
    splits = [];
    wake.length = 0;
    ghostRecorder.reset();
    ghostPlayback?.reset();
    for (const rival of rivals) rival.reset(course.start, wind);
    camera.snap(boat);
    resultOverlay.hide();
    hud.countdown.hidden = false;
    hud.countdown.textContent = '3';
    lastTrimSweet = false;
    if (hud.courseLabel) hud.courseLabel.textContent = course.name;
    if (hud.modeLabel) hud.modeLabel.textContent = modeLabelText();
    renderSplits();
    updateStandings();
    updateHud(0);
  }

  $('#btn-restart')?.addEventListener('click', () => {
    if (phase === 'menu') return;
    resetRace();
  });
  $('#btn-help')?.addEventListener('click', () => {
    $('#help-panel').hidden = !$('#help-panel').hidden;
  });
  $('#btn-help-close')?.addEventListener('click', () => {
    $('#help-panel').hidden = true;
  });

  function updateGuide() {
    const gate = marks.nextGate;
    const on = Boolean(input.easy && gate && phase !== 'finished' && phase !== 'menu');
    hud.guide.hidden = !on;
    hud.guideTip.hidden = !on;
    if (!on) return;

    const rec = assist.recommend(boat, wind, gate, true);
    const rel = wrap(rec.heading - boat.heading);
    hud.guide.style.transform = `rotate(${(rel * 180) / Math.PI}deg)`;
    const deg = (rel * 180) / Math.PI;
    const aligned = Math.abs(deg) < 12;
    const side = wrap(wind.from - rec.heading) >= 0 ? '右' : '左';
    let text;
    if (tackTarget !== null) text = '換舷中…';
    else if (rec.approach) text = markKind(gate) === 'round' ? '靠近浮標左舷繞！' : '對準閘門衝！';
    else if (!aligned) text = `向${deg > 0 ? '右' : '左'}轉對準`;
    else if (rec.beating) text = `對準中（${side}舷）· 按 ↑`;
    else text = '航向正確 · 按 ↑ 衝刺';
    hud.guideTip.textContent = text;
    hud.guideTip.classList.toggle('good', aligned || Boolean(rec.approach));
  }

  function windQuarter(awaDeg) {
    const a = Math.abs(awaDeg);
    const side = awaDeg >= 0 ? '右' : '左';
    if (a < 32) return '正前方';
    if (a < 75) return `${side}前方`;
    if (a < 115) return `正${side}側`;
    if (a < 155) return `${side}後方`;
    return '正後方';
  }

  function updateWindCue() {
    const cue = hud.windCue;
    if (!cue) return;
    if (phase === 'finished' || phase === 'menu') {
      cue.hidden = true;
      return;
    }

    const px = boat.x + Math.sin(boat.heading) * 5.2;
    const pz = boat.z + Math.cos(boat.heading) * 5.2;
    const ndc = camera.project(px, boat.waterY + 3.4, pz);
    if (!ndc) {
      cue.hidden = true;
      return;
    }

    cue.hidden = false;
    cue.style.left = `${(ndc.x * 0.5 + 0.5) * 100}%`;
    cue.style.top = `${(1 - (ndc.y * 0.5 + 0.5)) * 100}%`;

    const blowing = wind.from + Math.PI;
    const windScreen = wrap(blowing - camera.viewHeading);
    hud.windCueArrow.style.transform = `rotate(${(windScreen * 180) / Math.PI}deg)`;

    const holding = input.holdingCourse;
    const gate = marks.nextGate;
    const showCourse = Boolean(input.easy && gate);
    if (hud.courseCue) hud.courseCue.hidden = !showCourse;

    let courseLabel = '';
    if (showCourse && hud.courseCueArrow) {
      const rec = assist.recommend(boat, wind, gate, true);
      const courseScreen = wrap(rec.heading - camera.viewHeading);
      const scale = holding ? 1.12 : 1;
      hud.courseCueArrow.style.transform =
        `rotate(${(courseScreen * 180) / Math.PI}deg) scale(${scale})`;
      const side = wrap(wind.from - rec.heading) >= 0 ? '右' : '左';
      courseLabel = rec.approach
        ? (markKind(gate) === 'round' ? '前進・左舷繞標' : '前進・衝向閘門')
        : rec.beating
          ? `前進・搶風${side}舷`
          : '前進・直指目標';
    }

    const awaDeg = (boat.awa * 180) / Math.PI;
    const inIrons = Math.abs(boat.awa) < NO_GO;
    const luffing = boat.luffing > 0.35;
    cue.classList.toggle('nogo', inIrons);
    cue.classList.toggle('good', !inIrons && !luffing);
    cue.classList.toggle('holding', holding);
    cue.classList.toggle('gust', Boolean(wind.gusting));
    hud.goBtn?.classList.toggle('holding', holding);
    hud.keyGo?.classList.toggle('holding', holding);

    let label = courseLabel || `風從${windQuarter(awaDeg)}`;
    if (wind.gusting) label = `陣風！${label}`;
    if (inIrons) {
      label = showCourse || input.easy
        ? '頂風紅區・轉開再加速'
        : '頂風紅區・← → 轉舵離開';
    } else if (input.easy && courseLabel) {
      label = holding ? `${courseLabel}・加速中` : `${courseLabel}・按住加速`;
      if (wind.gusting) label = `陣風・${label}`;
    } else if (luffing && !input.autoTrim) {
      label = '帆在抖・收帆 Z';
    } else if (!input.autoTrim) {
      const a = Math.abs(awaDeg);
      const windBit = `風從${windQuarter(awaDeg)}`;
      if (a < 75) label = courseLabel ? `${courseLabel}・收帆 Z` : `${windBit}・收帆 Z`;
      else if (a > 115) label = courseLabel ? `${courseLabel}・放帆 X` : `${windBit}・放帆 X`;
      else if (!courseLabel) label = windBit;
    } else if (!courseLabel) {
      label = `風從${windQuarter(awaDeg)}`;
    }
    hud.windCueLabel.textContent = label;
  }

  function updateGateBeacon() {
    const el = hud.gateBeacon;
    if (!el) return;
    const gate = marks.nextGate;
    if (!gate || phase === 'finished' || phase === 'menu') {
      el.hidden = true;
      return;
    }

    const vis = gate.isFinish && markKind(gate) === 'gate'
      ? course.gates[0]
      : gate;
    const worldY = boat.waterY + 5.8;
    const ndc = camera.project(vis.x, worldY, vis.z);

    let sx;
    let sy;
    let offscreen = false;

    if (!ndc) {
      offscreen = true;
      const bearing = Math.atan2(vis.x - boat.x, vis.z - boat.z);
      const rel = wrap(bearing - camera.viewHeading);
      sx = 0.5 + Math.sin(rel) * 0.42;
      sy = 0.5 + Math.max(0.12, Math.cos(rel) * -0.35);
    } else {
      sx = ndc.x * 0.5 + 0.5;
      sy = 1 - (ndc.y * 0.5 + 0.5);
      if (sx < 0.06 || sx > 0.94 || sy < 0.08 || sy > 0.88) {
        offscreen = true;
        const dx = sx - 0.5;
        const dy = sy - 0.5;
        const len = Math.hypot(dx, dy) || 1;
        const nx = dx / len;
        const ny = dy / len;
        const ttx = Math.abs(nx) > 1e-4 ? 0.42 / Math.abs(nx) : Infinity;
        const tty = Math.abs(ny) > 1e-4 ? 0.38 / Math.abs(ny) : Infinity;
        const t = Math.min(ttx, tty);
        sx = 0.5 + nx * t;
        sy = 0.5 + ny * t;
      }
    }

    el.hidden = false;
    el.classList.toggle('offscreen', offscreen);
    el.classList.toggle('round-mark', markKind(gate) === 'round');
    el.style.left = `${clamp(sx, 0.07, 0.93) * 100}%`;
    el.style.top = `${clamp(sy, 0.1, 0.86) * 100}%`;
    if (hud.gateBeaconName) hud.gateBeaconName.textContent = gate.name;
    if (hud.gateBeaconDist) {
      hud.gateBeaconDist.textContent = `${marks.distanceToNext(boat).toFixed(0)} m`;
    }
  }

  function updateSpeedReadout() {
    const el = hud.speedReadout;
    if (!el) return;
    const kn = boat.speed * 1.94384;
    const ms = boat.speed;
    if (hud.speedValue) hud.speedValue.textContent = kn.toFixed(1);
    if (hud.speedMs) hud.speedMs.textContent = `${ms.toFixed(1)} m/s`;
    if (hud.speed) hud.speed.textContent = `${kn.toFixed(1)} kn`;
    const pct = clamp(ms / 20.5, 0, 1) * 100;
    if (hud.speedBarFill) hud.speedBarFill.style.width = `${pct}%`;
    el.classList.toggle('boosting', Boolean(input.holdingCourse && input.easy));
    el.classList.toggle('gust', Boolean(wind.gusting));
  }

  function updateHud(dt) {
    if (phase === 'menu') return;
    hudAcc += dt;
    if (hudAcc < 0.08 && dt !== 0) return;
    hudAcc = 0;

    hud.wind.textContent = `真風 ${wind.speed.toFixed(1)} m/s${wind.gusting ? ' 陣' : ''}`;
    hud.point.textContent = pointOfSail(boat.awa).label;

    const awaDeg = (boat.awa * 180) / Math.PI;
    const awaAbs = Math.abs(awaDeg);
    hud.awa.textContent = `相對風 ${awaAbs.toFixed(0)}° ${awaDeg >= 0 ? '右' : '左'}`;
    let tip = '橫風：好走';
    if (awaAbs < (NO_GO * 180) / Math.PI) tip = '頂風紅區：轉開約 40° 才有推力';
    else if (awaAbs < 55) tip = '搶風：可走，略收帆';
    else if (awaAbs < 120) tip = '橫風／斜順：最快';
    else tip = '順風：可放帆';
    if (boat.luffing > 0.35 && !input.autoTrim) tip = '帆在抖：按 Z 收帆吃滿風';
    if (wind.gusting) tip = `陣風 ${tip}`;
    hud.windTip.textContent = tip;
    hud.windTip.classList.toggle('bad', awaAbs < (NO_GO * 180) / Math.PI || (boat.luffing > 0.35 && !input.autoTrim));
    hud.windTip.classList.toggle('good', awaAbs >= 55 && awaAbs < 120 && boat.luffing < 0.2);

    const trimDeg = (boat.trim * 180) / Math.PI;
    const idealDeg = ((boat.trimIdeal ?? boat.trim) * 180) / Math.PI;
    hud.trim.textContent = input.autoTrim
      ? `自動 ${trimDeg.toFixed(0)}°`
      : `${trimDeg.toFixed(0)}°`;
    const trimPct = clamp(trimDeg / 90, 0, 1);
    const idealPct = clamp(idealDeg / 90, 0, 1);
    hud.trimFill.style.width = `${trimPct * 100}%`;
    hud.trimIdeal.style.left = `${idealPct * 100}%`;
    const trimOk = Math.abs(trimDeg - idealDeg) < 8;
    hud.trimFill.classList.toggle('ok', trimOk);
    if (!input.autoTrim && !input.easy) {
      if (trimOk && !lastTrimSweet) sfxTrimSweet();
      lastTrimSweet = trimOk;
    }

    hud.auto.classList.toggle('active', input.autoTrim);
    hud.auto.setAttribute('aria-pressed', input.autoTrim ? 'true' : 'false');

    const total = course.gates.length;
    if (phase === 'finished') {
      hud.mark.textContent = '完賽';
      hud.dist.textContent = '—';
    } else if (marks.nextGate) {
      hud.mark.textContent = marks.nextGate.name;
      hud.dist.textContent = `${marks.distanceToNext(boat).toFixed(0)} m`;
    }
    hud.progress.textContent = `${Math.min(marks.nextIndex, total)} / ${total}`;
    hud.time.textContent = formatTime(raceTime);
    hud.best.textContent = bestTime != null ? formatTime(bestTime) : '—';

    const awaRot = (boat.awa * 180) / Math.PI;
    hud.compass.style.transform = `rotate(${awaRot}deg)`;
    hud.compass.classList.toggle('luffing', boat.luffing > 0.35);
    hud.compass.classList.toggle('nogo', Math.abs(boat.awa) < NO_GO);

    const bearing = marks.bearingToNext(boat);
    hud.arrow.style.transform = `rotate(${(bearing * 180) / Math.PI}deg)`;

    if (hud.gustBadge) hud.gustBadge.hidden = !wind.gusting;

    updateGuide();
    drawMinimap();
    updateStandings();
  }

  function updateCoach(dt) {
    const gate = marks.nextGate;
    const guideTurn = input.easy && gate
      ? assist.recommend(boat, wind, gate, true).turn
      : 0;

    const hint = coach.update({
      racing: phase === 'racing',
      awa: boat.awa,
      noGo: NO_GO,
      speed: boat.speed,
      luffing: boat.luffing,
      autoTrim: input.autoTrim,
      easy: input.easy,
      guideTurn,
      distToGate: gate ? marks.distanceToNext(boat) : 0,
    }, dt);

    if (!hint) {
      hud.coach.hidden = true;
      hud.coach.dataset.hint = '';
      return;
    }
    if (hud.coach.dataset.hint !== hint.id) {
      hud.coach.dataset.hint = hint.id;
      hud.coachText.textContent = hint.text;
    }
    hud.coach.hidden = false;
  }

  function applyTackAssist(controls, dt) {
    if (input.consumeTack() && input.easy) {
      tackTarget = assist.otherTack(boat, wind);
      tackTimer = 8;
      showToast('換舷中…');
    }
    if (tackTarget === null) return controls;

    tackTimer -= dt;
    const settled = Math.abs(wrap(tackTarget - boat.heading)) < 0.1;
    if (settled || tackTimer <= 0 || (controls.rudder !== 0 && !controls.holdCourse) || !input.easy) {
      tackTarget = null;
      return controls;
    }
    return { ...controls, rudder: steerTo(boat, tackTarget) };
  }

  function applyEasyHelms(controls, dt) {
    if (!input.easy) return controls;
    input.autoTrim = true;
    controls = applyTackAssist(controls, dt);
    return { ...controls, autoTrim: true, trimDelta: 0 };
  }

  function waveAmpNow() {
    return input.easy ? WAVE_AMP_EASY : WAVE_AMP;
  }

  function playerPlace() {
    const finished = [
      { id: 'you', time: raceTime },
      ...rivals.filter((r) => r.finishTime != null).map((r) => ({ id: r.profile.id, time: r.finishTime })),
    ].sort((a, b) => a.time - b.time);
    const idx = finished.findIndex((r) => r.id === 'you');
    return idx < 0 ? rivals.length + 1 : idx + 1;
  }

  function finishRace() {
    phase = 'finished';
    coach.reset();
    hud.coach.hidden = true;
    const mode = modeKey();
    const result = recordFinish(progress, courseId, mode, raceTime);
    progress = result.progress;
    const isRecord = result.isRecord;
    if (isRecord) {
      bestTime = raceTime;
      saveGhost(courseId, mode, ghostRecorder.samples(), raceTime);
    } else {
      bestTime = bestFor(progress, courseId, mode);
    }
    if (result.unlocked.length) {
      sfxUnlock();
      showToast(`解鎖航線：${result.unlocked.map((id) => loadCourseDef(id).name).join('、')}`);
    }
    sfxFinish(isRecord);

    const place = playMode === 'trial' ? null : playerPlace();
    if (place != null) {
      regattaPoints += PLACE_POINTS[place - 1] ?? 0;
      regattaPlaces.push({ courseId, place, time: raceTime });
    }

    const finishStats = [
      { label: '航線', value: course.name },
      { label: '本次時間', value: formatTime(raceTime) },
      { label: '歷史最佳', value: formatTime(bestTime) },
    ];
    if (place != null) finishStats.push({ label: '名次', value: `第 ${place} 名` });
    if (perfectGates > 0) finishStats.push({ label: '完美', value: `${perfectGates} 次` });
    for (const split of splits) {
      finishStats.push({ label: split.name, value: formatTime(split.time) });
    }

    const continueRegatta = playMode === 'regatta' && regattaIndex < regattaQueue.length - 1;
    if (continueRegatta) {
      resultOverlay.show({
        title: isRecord ? `${course.name}・新紀錄！` : `${course.name}・完賽`,
        badge: place != null ? `第 ${place} 名` : undefined,
        subtitle: `海灣盃積分 ${regattaPoints} · 下一場準備`,
        stats: finishStats,
        primaryLabel: '下一航線',
        onPrimary: () => {
          regattaIndex += 1;
          applyCourse(regattaQueue[regattaIndex]);
          setupGhost();
          setupRivals();
          resetRace();
        },
        secondaryLabel: '放棄盃賽',
        onSecondary: () => openMenu(),
        variant: isRecord || place === 1 ? 'win' : 'neutral',
      });
      return;
    }

    if (playMode === 'regatta') {
      progress = recordRegatta(progress, { points: regattaPoints, won: regattaPoints >= 9 });
      finishStats.push({ label: '盃賽積分', value: String(regattaPoints) });
      resultOverlay.show({
        title: regattaPoints >= 9 ? '海灣盃・優勝！' : '海灣盃・完賽',
        badge: `${regattaPoints} 分`,
        subtitle: '三場積分累計（5／3／1）',
        stats: finishStats,
        primaryLabel: '再挑戰盃賽',
        onPrimary: () => {
          playMode = 'regatta';
          beginRaceSession();
        },
        secondaryLabel: '回選單',
        onSecondary: () => openMenu(),
        variant: regattaPoints >= 9 ? 'win' : 'neutral',
      });
      return;
    }

    resultOverlay.show({
      title: isRecord ? '完賽・新紀錄！' : '完賽！',
      badge: isRecord ? '新紀錄' : (place != null ? `第 ${place} 名` : undefined),
      subtitle: '點「再航一趟」重開，或按 R',
      stats: finishStats,
      primaryLabel: '再航一趟',
      onPrimary: resetRace,
      secondaryLabel: '回選單',
      onSecondary: () => openMenu(),
      variant: isRecord || place === 1 ? 'win' : 'neutral',
    });
  }

  function openMenu() {
    phase = 'menu';
    resultOverlay.hide();
    hud.countdown.hidden = true;
    if (hud.raceStandings) hud.raceStandings.hidden = true;
    const overlay = $('#title-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      document.body.appendChild(overlay);
    }
    refreshMenuMeta();
  }

  let last = performance.now();
  let hudAcc = 0;

  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;

    if (phase !== 'menu') {
      if (input.consumePress('KeyR')) resetRace();
      if (input.consumePress('KeyH') || input.consumePress('Slash')) {
        $('#help-panel').hidden = !$('#help-panel').hidden;
      }
    }

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) hud.toast.classList.remove('show');
    }
    if (luffSfxCooldown > 0) luffSfxCooldown -= dt;

    const aspect = resize(gl, canvas);
    camera.resize(aspect);

    if (phase === 'menu') {
      // Idle bob on the title — keep GPU warm and show the bay.
      wind.update(now * 0.001);
      const waves = WAVE_AMP_EASY;
      stepSailing(
        boat,
        wind,
        { rudder: 0.05 * Math.sin(now * 0.001), trimDelta: 0, autoTrim: true },
        dt,
        now * 0.001,
        waves,
        true
      );
      marks.update(now * 0.001, waves);
      camera.update(boat, 0, dt);
      camera.commit();
      renderScene(now, waves);
      requestAnimationFrame(frame);
      return;
    }

    wind.update(now * 0.001);
    if (input.easy) {
      wind.speed = wind.baseSpeed * 0.92 + (wind.speed - wind.baseSpeed) * 0.15;
      wind.from = wind.baseFrom + (wind.from - wind.baseFrom) * 0.25;
    }
    if (wind.consumeGustEdge() && !input.easy) {
      sfxGust();
      showToast('陣風來了！');
    }

    const waves = waveAmpNow();
    let controls = { rudder: 0, trimDelta: 0, autoTrim: true };

    if (phase === 'countdown') {
      countdown -= dt;
      const n = Math.ceil(countdown);
      hud.countdown.hidden = false;
      hud.countdown.textContent = n > 0 ? String(n) : 'GO';
      const raw = input.sample(dt);
      controls = { rudder: raw.rudder * 0.35, trimDelta: 0, autoTrim: true, holdCourse: raw.holdCourse };
      controls = applyEasyHelms(controls, dt);
      stepSailing(boat, wind, controls, dt, now * 0.001, waves, input.easy);
      for (const rival of rivals) {
        rival.step(wind, dt, now * 0.001, waves, 0, input.easy, course.gates.length);
      }
      if (countdown <= 0) {
        phase = 'racing';
        raceTime = 0;
        hud.countdown.hidden = true;
        showToast(
          playMode === 'trial'
            ? (input.easy ? '計時開始！衝過綠色目標' : '計時開始！幽靈是你的最佳紀錄')
            : '起航！盯緊對手航線與陣風'
        );
      }
    } else if (phase === 'racing') {
      controls = applyEasyHelms(input.sample(dt), dt);
      stepSailing(boat, wind, controls, dt, now * 0.001, waves, input.easy);
      raceTime += dt;
      ghostRecorder.push(dt, raceTime, boat);
      updateCoach(dt);

      if (!input.autoTrim && !input.easy && boat.luffing > 0.45 && luffSfxCooldown <= 0) {
        sfxLuff();
        luffSfxCooldown = 1.2;
      }

      for (const rival of rivals) {
        rival.step(wind, dt, now * 0.001, waves, raceTime, input.easy, course.gates.length);
      }

      const cleared = marks.tryClear(boat);
      if (cleared) {
        splits.push({ name: cleared.cleared.name, time: raceTime });
        renderSplits();
        const left = course.gates.length - marks.nextIndex;
        const isRound = markKind(cleared.cleared) === 'round';
        if (cleared.perfect) {
          perfectGates += 1;
          raceTime = Math.max(0, raceTime - 1.2);
          boat.surge = Math.min(20.5, boat.surge + 4.0);
          if (isRound) sfxMarkRound(true);
          else sfxGateClear(true);
          showToast(isRound
            ? `漂亮繞標！−1.2s · 加速（完美 ${perfectGates}）`
            : `完美穿門！−1.2s · 加速（完美 ${perfectGates}）`);
        } else if (!(cleared.cleared.isFinish || marks.nextIndex >= course.gates.length)) {
          if (isRound) sfxMarkRound(false);
          else sfxGateClear(false);
          showToast(`${cleared.cleared.name} · ${formatTime(raceTime)} · 剩 ${left}`);
        }
        if (cleared.cleared.isFinish || marks.nextIndex >= course.gates.length) {
          finishRace();
        }
      }
    } else {
      controls = input.sample(dt);
      stepSailing(
        boat,
        wind,
        { rudder: controls.rudder * 0.5, trimDelta: 0, autoTrim: true },
        dt,
        now * 0.001,
        waves,
        input.easy
      );
      for (const rival of rivals) {
        rival.step(wind, dt, now * 0.001, waves, raceTime, input.easy, course.gates.length);
      }
    }

    wakeAcc += dt;
    if (wakeAcc > 0.06) {
      wakeAcc = 0;
      const pushWake = (b, scale) => {
        const strength = clamp((b.speed || Math.abs(b.surge) || 0) / 5, 0, 1.25) * scale;
        if (strength > 0.05) wake.unshift({ x: b.x, z: b.z, strength });
      };
      pushWake(boat, 1.15);
      for (const rival of rivals) pushWake(rival.boat, 0.85);
      if (ghostPlayback && phase === 'racing') {
        const g = ghostPlayback.sample(raceTime);
        wake.unshift({ x: g.x, z: g.z, strength: 0.35 });
      }
      while (wake.length > 32) wake.pop();
      for (const w of wake) w.strength *= 0.955;
    }
    ocean.setWake(wake);

    marks.update(now * 0.001, waves);
    camera.update(boat, input.lookYaw, dt);
    camera.commit();
    updateWindCue();
    updateGateBeacon();
    updateSpeedReadout();
    renderScene(now, waves);
    updateHud(dt);
    requestAnimationFrame(frame);
  }

  function renderScene(now, waves) {
    const t = now * 0.001;
    const roll = boat.heel + (boat.waveRoll || 0) * 0.65;
    boatMesh.update({
      position: [boat.x, boat.waterY, boat.z],
      heading: boat.heading,
      pitch: boat.pitch,
      roll,
      sailAngle: boat.trim,
      rudderAngle: -boat.rudder * 0.55,
      side: boat.side,
      camber: 0.55 * (1 - boat.luffing * 0.7),
      flutter: boat.luffing * 0.35,
      jibCamber: 0.4 * (1 - boat.luffing * 0.6),
      jibFlutter: boat.luffing * 0.28,
      time: t,
    });

    rivals.forEach((rival, i) => {
      const rb = rival.boat;
      const rRoll = rb.heel + (rb.waveRoll || 0) * 0.65;
      rivalMeshes[i].update({
        position: [rb.x, rb.waterY, rb.z],
        heading: rb.heading,
        pitch: rb.pitch,
        roll: rRoll,
        sailAngle: rb.trim,
        rudderAngle: -rb.rudder * 0.55,
        side: rb.side,
        camber: 0.55 * (1 - rb.luffing * 0.7),
        flutter: rb.luffing * 0.35,
        jibCamber: 0.4 * (1 - rb.luffing * 0.6),
        jibFlutter: rb.luffing * 0.28,
        time: t,
      });
    });

    let ghostPose = null;
    if (ghostPlayback && (phase === 'racing' || phase === 'countdown')) {
      ghostPose = ghostPlayback.sample(phase === 'countdown' ? 0 : raceTime);
      ghostMesh.update({
        position: [ghostPose.x, boat.waterY, ghostPose.z],
        heading: ghostPose.heading,
        pitch: 0,
        roll: 0,
        sailAngle: ghostPose.trim,
        rudderAngle: 0,
        side: ghostPose.side,
        camber: 0.45,
        flutter: 0.05,
        jibCamber: 0.35,
        jibFlutter: 0.04,
        time: t,
      });
    }

    const env = {
      time: t,
      waveAmp: waves,
      sunDir: SUN_DIR,
      horizonColor: HORIZON,
      deepColor: DEEP,
      shallowColor: SHALLOW,
      windStrength: clamp(wind.speed / 10, 0.25, 1.2),
      skyTexture: sky.texture,
    };

    gl.clearColor(HORIZON[0], HORIZON[1], HORIZON[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    sky.draw(camera, env);
    ocean.draw(camera, env, [boat.x, boat.z]);

    const pass = solid.begin(camera, env);
    gl.disable(gl.CULL_FACE);
    if (ghostPose) ghostMesh.draw(pass, { tint: [0.65, 0.8, 0.95], ghost: true });
    rivals.forEach((rival, i) => rivalMeshes[i].draw(pass, { tint: rival.profile.tint }));
    boatMesh.draw(pass);
    marks.draw(pass);
    gl.enable(gl.CULL_FACE);
  }

  function dismissTutorial() {
    localStorage.setItem(TUTORIAL_KEY, '1');
    if (hud.tutorial) hud.tutorial.hidden = true;
  }

  function maybeShowTutorial() {
    if (localStorage.getItem(TUTORIAL_KEY) === '1') return;
    if (hud.tutorial) hud.tutorial.hidden = false;
  }

  $('#btn-tutorial-ok')?.addEventListener('click', dismissTutorial);

  const overlay = $('#title-overlay');
  if (overlay) {
    overlay.style.backgroundImage = [
      'radial-gradient(ellipse at 50% 20%, rgba(44, 181, 168, 0.22), transparent 55%)',
      'linear-gradient(180deg, rgba(7, 24, 36, 0.55), rgba(7, 24, 36, 0.82))',
      "url('./menu-bg.jpg')",
    ].join(', ');
  }

  document.querySelectorAll('[data-play-mode]').forEach((el) => {
    el.addEventListener('click', () => {
      playMode = /** @type {PlayMode} */ (el.getAttribute('data-play-mode') || 'trial');
      refreshMenuMeta();
    });
  });

  $('#btn-start')?.addEventListener('click', () => {
    overlay?.classList.add('hidden');
    setTimeout(() => {
      // Keep node for reopen via openMenu
    }, 500);
    maybeShowTutorial();
    beginRaceSession();
  });

  refreshMenuMeta();
  phase = 'menu';
  requestAnimationFrame(frame);
}

boot();
