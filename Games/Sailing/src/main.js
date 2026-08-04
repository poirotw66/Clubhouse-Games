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
import { createCourse, createMarks, gatePosts } from './marks.js';
import { clamp } from './math.js';

const WAVE_AMP = 1.0;
const WAVE_AMP_EASY = 0.45;
const BEST_KEY = 'sailing-best-v3';
const EASY_KEY = 'sailing-easy';
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

  const wind = createWind(1);
  const course = createCourse();
  const marks = createMarks(gl, solid, course);
  const camera = createCamera();
  const input = createInput(document.body);
  const assist = createAssist();
  const coach = createCoach();

  // Easy mode defaults on — this is a casual collection, and the beat is not
  // readable without the guidance arrow. Only an explicit opt-out is stored.
  input.easy = localStorage.getItem(EASY_KEY) !== 'off';
  input.onEasyChange = (on) => {
    localStorage.setItem(EASY_KEY, on ? 'on' : 'off');
    if (on) {
      input.autoTrim = true;
      showToast('簡單模式：按住 ↑ 加速，← → 轉彎衝閘門！');
    } else {
      showToast('簡單模式關閉');
    }
    syncEasyUi();
  };

  // Set while a one-key tack is being driven; holds the target heading.
  let tackTarget = null;
  let tackTimer = 0;
  let perfectGates = 0;
  const minimap = $('#minimap');
  const miniCtx = minimap.getContext('2d');

  let boat = createBoatState(course.start.heading);
  boat.x = course.start.x;
  boat.z = course.start.z;
  boat.surge = 5.5;
  marks.reset(boat);
  assist.reset(boat, wind);

  // Store base gate widths so easy mode can widen without rebuilding posts.
  for (const g of course.gates) {
    if (g._half == null) g._half = g.halfWidth;
  }

  /** @type {'countdown'|'racing'|'finished'} */
  let phase = 'countdown';
  let countdown = 3.2;
  let raceTime = 0;
  /** @type {{ name: string, time: number }[]} */
  let splits = [];
  let bestTime = Number(localStorage.getItem(BEST_KEY) || '') || null;
  let toastTimer = 0;

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
    coach: $('#coach'),
    coachText: $('#coach-text'),
    toast: $('#toast'),
    countdown: $('#countdown'),
    finish: $('#finish-panel'),
    finishTime: $('#finish-time'),
    finishBest: $('#finish-best'),
    finishSplits: $('#finish-splits'),
  };

  function syncEasyUi() {
    const easy = input.easy;
    document.body.classList.toggle('easy-mode', easy);
    for (const g of course.gates) {
      g.halfWidth = easy ? g._half * 1.25 : g._half;
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

  // Backing store is drawn at 2x so the waypoint numbers stay crisp.
  const MINI_SCALE = 2;

  // Fixed frame from the course itself. Fitting the boat in as well made the
  // scale creep every frame, so nothing on the map held still long enough to
  // be read; the boat is clamped to the edge instead on the rare occasions it
  // sails outside.
  const COURSE_BOUNDS = (() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const g of course.gates) {
      minX = Math.min(minX, g.x); maxX = Math.max(maxX, g.x);
      minZ = Math.min(minZ, g.z); maxZ = Math.max(maxZ, g.z);
    }
    const m = 42;
    return { minX: minX - m, maxX: maxX + m, minZ: minZ - m, maxZ: maxZ + m };
  })();

  const GATE_LABELS = ['起', '1', '2', '3'];

  /**
   * Arrowhead at (px, pz) pointing along world heading `h`, in map space.
   * Built from explicit vectors rather than ctx.rotate: the map draws +z
   * downward, which ctx.rotate does not compose with the way the obvious
   * `rotate(heading)` suggests — that flips the marker in z, so the boat
   * pointed north while sailing south.
   */
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

    const { minX, maxX, minZ, maxZ } = COURSE_BOUNDS;
    const pad = 14;
    const s = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxZ - minZ));
    const ox = (w - (maxX - minX) * s) * 0.5;
    const oz = (h - (maxZ - minZ) * s) * 0.5;
    const tx = (x) => ox + (clamp(x, minX, maxX) - minX) * s;
    const tz = (z) => oz + (clamp(z, minZ, maxZ) - minZ) * s;

    const nextIndex = marks.nextIndex;

    // --- legs, with an arrowhead so the lap reads as a direction ------------
    for (let j = 0; j < course.gates.length - 1; j++) {
      const a = course.gates[j];
      const b = course.gates[j + 1];
      const done = nextIndex > j + 1;
      const active = nextIndex === j + 1;

      const ax = tx(a.x), az = tz(a.z), bx = tx(b.x), bz = tz(b.z);
      ctx.strokeStyle = active ? 'rgba(44,181,168,0.95)'
        : done ? 'rgba(232,244,246,0.16)' : 'rgba(232,244,246,0.34)';
      ctx.lineWidth = active ? 2.4 : 1.5;
      ctx.setLineDash(done ? [3, 3] : []);
      ctx.beginPath();
      ctx.moveTo(ax, az);
      ctx.lineTo(bx, bz);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead at the midpoint, pointing the way round.
      const ang = Math.atan2(bz - az, bx - ax);
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      ctx.save();
      ctx.translate(mx, mz);
      ctx.rotate(ang);
      ctx.fillStyle = active ? 'rgba(44,181,168,0.95)' : 'rgba(232,244,246,0.4)';
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(-3, 3.4);
      ctx.lineTo(-3, -3.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // --- gates: the opening you sail through, then a numbered marker --------
    course.gates.forEach((g, i) => {
      if (g.isFinish) return;                       // shares its spot with the start
      const finishNext = marks.nextGate?.isFinish;
      const isNext = i === nextIndex || (finishNext && i === 0);
      const done = i < nextIndex && !(finishNext && i === 0);

      // The opening itself, with a post at each end: these are gates you sail
      // between, and a bare dot never said that.
      const p = gatePosts(g);
      const lx = tx(p.left.x), lz = tz(p.left.z);
      const rx2 = tx(p.right.x), rz2 = tz(p.right.z);
      const tint = isNext ? '#2cb5a8' : done ? 'rgba(160,170,180,0.5)' : 'rgba(240,122,42,0.9)';

      ctx.strokeStyle = tint;
      ctx.lineWidth = isNext ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(lx, lz);
      ctx.lineTo(rx2, rz2);
      ctx.stroke();

      ctx.fillStyle = tint;
      for (const [qx, qz] of [[lx, lz], [rx2, rz2]]) {
        ctx.beginPath();
        ctx.arc(qx, qz, isNext ? 3.2 : 2.6, 0, Math.PI * 2);
        ctx.fill();
      }

      const cx = tx(g.x);
      const cz = tz(g.z);
      const r = isNext ? 9 : 7;

      if (isNext) {                                  // halo, so the target pops
        ctx.fillStyle = 'rgba(44,181,168,0.28)';
        ctx.beginPath();
        ctx.arc(cx, cz, r + 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = isNext ? '#2cb5a8' : done ? 'rgba(120,132,140,0.85)' : '#f07a2a';
      ctx.beginPath();
      ctx.arc(cx, cz, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isNext || !done ? '#06212c' : 'rgba(232,244,246,0.75)';
      ctx.font = '700 10px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(finishNext && i === 0 ? '終' : GATE_LABELS[i] ?? String(i), cx, cz + 0.5);
    });

    // --- boat, plus the heading easy mode is asking for ---------------------
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

    // --- wind, so the beat legs make sense at a glance ----------------------
    const wx = w - 17;
    const wz = 15;
    const blowing = wind.from + Math.PI;       // the way the wind is going
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

  function resetRace() {
    boat = createBoatState(course.start.heading);
    boat.x = course.start.x;
    boat.z = course.start.z;
    boat.surge = 5.5;
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
    camera.snap(boat);
    hud.finish.hidden = true;
    hud.countdown.hidden = false;
    hud.countdown.textContent = '3';
    renderSplits();
    updateHud(0);
  }

  $('#btn-restart')?.addEventListener('click', resetRace);
  $('#btn-finish-restart')?.addEventListener('click', resetRace);
  $('#btn-help')?.addEventListener('click', () => {
    $('#help-panel').hidden = !$('#help-panel').hidden;
  });
  $('#btn-help-close')?.addEventListener('click', () => {
    $('#help-panel').hidden = true;
  });

  camera.snap(boat);
  renderSplits();
  hud.countdown.hidden = false;

  let last = performance.now();
  let hudAcc = 0;

  /**
   * Easy-mode guidance: a second arrow on the checkpoint rose showing the
   * heading to actually steer, plus what to do about it in words. When the gate
   * is upwind the two arrows disagree — that gap *is* the lesson.
   */
  function updateGuide() {
    const gate = marks.nextGate;
    const on = Boolean(input.easy && gate && phase !== 'finished');
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
    else if (rec.approach) text = '對準閘門衝！';
    else if (!aligned) text = `向${deg > 0 ? '右' : '左'}轉對準`;
    else if (rec.beating) text = `對準中（${side}舷）· 按 ↑`;
    else text = '航向正確 · 按 ↑ 衝刺';

    hud.guideTip.textContent = text;
    hud.guideTip.classList.toggle('good', aligned || Boolean(rec.approach));
  }

  /** Coarse description of where the wind sits relative to the bow. */
  function windQuarter(awaDeg) {
    const a = Math.abs(awaDeg);
    const side = awaDeg >= 0 ? '右' : '左';
    if (a < 32) return '正前方';
    if (a < 75) return `${side}前方`;
    if (a < 115) return `正${side}側`;
    if (a < 155) return `${side}後方`;
    return '正後方';
  }

  /**
   * Bow cues: orange wind arrow + (in easy mode) green forward-course arrow.
   * Rotations use the camera heading so dragging the view does not skew them.
   */
  function updateWindCue() {
    const cue = hud.windCue;
    if (!cue) return;
    if (phase === 'finished') {
      cue.hidden = true;
      return;
    }

    // A little ahead of the bow and above the deck, so it clears the sails.
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

    const blowing = wind.from + Math.PI;              // the way the air is going
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
        ? '前進・衝向閘門'
        : rec.beating
          ? `前進・搶風${side}舷`
          : '前進・直指閘門';
    }

    const awaDeg = (boat.awa * 180) / Math.PI;
    const inIrons = Math.abs(boat.awa) < NO_GO;
    const luffing = boat.luffing > 0.35;
    cue.classList.toggle('nogo', inIrons);
    cue.classList.toggle('good', !inIrons && !luffing);
    cue.classList.toggle('holding', holding);
    hud.goBtn?.classList.toggle('holding', holding);
    hud.keyGo?.classList.toggle('holding', holding);

    let label = courseLabel || `風從${windQuarter(awaDeg)}`;
    if (input.easy && courseLabel) {
      label = holding ? `${courseLabel}・加速中` : `${courseLabel}・按 ↑ 加速`;
    } else if (inIrons) label = showCourse ? '頂風・轉開再加速' : '頂風・轉舵離開';
    else if (luffing && !input.autoTrim) label = '帆在抖・收帆 Z';
    else if (!input.autoTrim) {
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

  /**
   * Float a loud "下一門" flag over the next gate. Clamps to the screen edge
   * with a yellow tint when the opening is off-camera.
   */
  function updateGateBeacon() {
    const el = hud.gateBeacon;
    if (!el) return;
    const gate = marks.nextGate;
    if (!gate || phase === 'finished') {
      el.hidden = true;
      return;
    }

    const vis = gate.isFinish ? course.gates[0] : gate;
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
        const tx = Math.abs(nx) > 1e-4 ? 0.42 / Math.abs(nx) : Infinity;
        const ty = Math.abs(ny) > 1e-4 ? 0.38 / Math.abs(ny) : Infinity;
        const t = Math.min(tx, ty);
        sx = 0.5 + nx * t;
        sy = 0.5 + ny * t;
      }
    }

    el.hidden = false;
    el.classList.toggle('offscreen', offscreen);
    el.style.left = `${clamp(sx, 0.07, 0.93) * 100}%`;
    el.style.top = `${clamp(sy, 0.1, 0.86) * 100}%`;
    if (hud.gateBeaconName) hud.gateBeaconName.textContent = gate.name;
    if (hud.gateBeaconDist) {
      hud.gateBeaconDist.textContent = `${marks.distanceToNext(boat).toFixed(0)} m`;
    }
  }

  function updateHud(dt) {
    hudAcc += dt;
    if (hudAcc < 0.08 && dt !== 0) return;
    hudAcc = 0;

    const kn = boat.speed * 1.94384;
    hud.speed.textContent = `${kn.toFixed(1)} kn`;
    hud.wind.textContent = `真風 ${wind.speed.toFixed(1)} m/s`;
    hud.point.textContent = pointOfSail(boat.awa).label;

    const awaDeg = (boat.awa * 180) / Math.PI;
    const awaAbs = Math.abs(awaDeg);
    hud.awa.textContent = `相對風 ${awaAbs.toFixed(0)}° ${awaDeg >= 0 ? '右' : '左'}`;
    let tip = '橫風：好走';
    if (awaAbs < (NO_GO * 180) / Math.PI) tip = '頂風！快轉舵離開紅區';
    else if (awaAbs < 55) tip = '搶風：可走，略收帆';
    else if (awaAbs < 120) tip = '橫風／斜順：最快';
    else tip = '順風：可放帆';
    if (boat.luffing > 0.35) tip = '帆在抖：按 Z 收帆';
    hud.windTip.textContent = tip;
    hud.windTip.classList.toggle('bad', awaAbs < (NO_GO * 180) / Math.PI || boat.luffing > 0.35);
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
    hud.trimFill.classList.toggle('ok', Math.abs(trimDeg - idealDeg) < 8);

    hud.auto.classList.toggle('active', input.autoTrim);
    hud.auto.setAttribute('aria-pressed', input.autoTrim ? 'true' : 'false');

    const total = course.gates.length;
    const idx = Math.min(marks.nextIndex + 1, total);
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

    updateGuide();
    drawMinimap();
  }

  /** Ask the coach whether the player is stuck, and show the one instruction. */
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
      return;
    }
    if (hud.coach.dataset.hint !== hint.id) {
      hud.coach.dataset.hint = hint.id;
      hud.coachText.textContent = hint.text;
    }
    hud.coach.hidden = false;
  }

  /**
   * One-key tack: latch the heading on the other side of the wind and steer to
   * it. Hands control back when settled, the player touches the rudder, or the
   * timer runs out.
   */
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

  /**
   * Easy mode is an arcade racer: YOU steer, ↑ boosts. Guidance arrow is a
   * hint only — no autopilot (watching a boat drive itself is not a game).
   * Space still does a one-key tack for when you want to flip quickly.
   */
  function applyEasyHelms(controls, dt) {
    if (!input.easy) return controls;
    // Lock auto-trim on and ignore sheet keys — sail always at peak angle.
    input.autoTrim = true;
    controls = applyTackAssist(controls, dt);
    return { ...controls, autoTrim: true, trimDelta: 0 };
  }

  function waveAmpNow() {
    return input.easy ? WAVE_AMP_EASY : WAVE_AMP;
  }

  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;

    if (input.consumePress('KeyR')) resetRace();
    if (input.consumePress('KeyH') || input.consumePress('Slash')) {
      $('#help-panel').hidden = !$('#help-panel').hidden;
    }

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) hud.toast.classList.remove('show');
    }

    const aspect = resize(gl, canvas);
    camera.resize(aspect);
    wind.update(now * 0.001);
    // Easy mode: almost flat calm so the boat tracks the autopilot cleanly.
    if (input.easy) {
      wind.speed = wind.baseSpeed * 0.92 + (wind.speed - wind.baseSpeed) * 0.15;
      wind.from = wind.baseFrom + (wind.from - wind.baseFrom) * 0.25;
    }

    const waves = waveAmpNow();
    let controls = { rudder: 0, trimDelta: 0, autoTrim: true };
    if (phase === 'countdown') {
      countdown -= dt;
      const n = Math.ceil(countdown);
      hud.countdown.hidden = false;
      hud.countdown.textContent = n > 0 ? String(n) : 'GO';
      // Soft hold during countdown — slight steer allowed to line up.
      const raw = input.sample(dt);
      controls = { rudder: raw.rudder * 0.35, trimDelta: 0, autoTrim: true, holdCourse: raw.holdCourse };
      controls = applyEasyHelms(controls, dt);
      stepSailing(boat, wind, controls, dt, now * 0.001, waves, input.easy);
      if (countdown <= 0) {
        phase = 'racing';
        raceTime = 0;
        hud.countdown.hidden = true;
        showToast(input.easy ? '按住 ↑ 加速！← → 轉彎衝過綠色閘門' : '計時開始！穿過綠色閘門');
      }
    } else if (phase === 'racing') {
      controls = applyEasyHelms(input.sample(dt), dt);
      stepSailing(boat, wind, controls, dt, now * 0.001, waves, input.easy);
      raceTime += dt;
      updateCoach(dt);

      const cleared = marks.tryClear(boat);
      if (cleared) {
        splits.push({ name: cleared.cleared.name, time: raceTime });
        renderSplits();
        const left = course.gates.length - marks.nextIndex;
        if (cleared.perfect) {
          perfectGates += 1;
          raceTime = Math.max(0, raceTime - 1.2);
          boat.surge = Math.min(11.5, boat.surge + 2.8);
          showToast(`完美穿門！−1.2s · 加速（完美 ${perfectGates}）`);
        } else if (cleared.cleared.isFinish || marks.nextIndex >= course.gates.length) {
          // finish handled below
        } else {
          showToast(`${cleared.cleared.name} · ${formatTime(raceTime)} · 剩 ${left} 門`);
        }
        if (cleared.cleared.isFinish || marks.nextIndex >= course.gates.length) {
          phase = 'finished';
          coach.reset();
          hud.coach.hidden = true;
          if (bestTime == null || raceTime < bestTime) {
            bestTime = raceTime;
            localStorage.setItem(BEST_KEY, String(bestTime));
          }
          hud.finish.hidden = false;
          hud.finishTime.textContent = formatTime(raceTime);
          hud.finishBest.textContent = formatTime(bestTime);
          const perfectLine = perfectGates > 0
            ? `<li><span>完美穿門</span><span>${perfectGates} 次</span></li>`
            : '';
          hud.finishSplits.innerHTML = perfectLine + splits
            .map((s) => `<li><span>${s.name}</span><span>${formatTime(s.time)}</span></li>`)
            .join('');
          showToast(
            perfectGates > 0
              ? `完賽 ${formatTime(raceTime)} · 完美 ${perfectGates}`
              : `完賽 ${formatTime(raceTime)}`
          );
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
    }

    wakeAcc += dt;
    if (wakeAcc > 0.06) {
      wakeAcc = 0;
      const strength = clamp(boat.speed / 5, 0, 1.25) * 1.15;
      if (strength > 0.05) {
        wake.unshift({ x: boat.x, z: boat.z, strength });
        if (wake.length > 40) wake.pop();
      }
      for (const w of wake) w.strength *= 0.955;
    }
    ocean.setWake(wake);

    marks.update(now * 0.001, waves);
    camera.update(boat, input.lookYaw, dt);
    camera.commit();
    updateWindCue();
    updateGateBeacon();

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
      time: now * 0.001,
    });

    const env = {
      time: now * 0.001,
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
    boatMesh.draw(pass);
    marks.draw(pass);
    gl.enable(gl.CULL_FACE);

    updateHud(dt);
    requestAnimationFrame(frame);
  }

  const overlay = $('#title-overlay');
  const dismiss = () => {
    overlay?.classList.add('hidden');
    setTimeout(() => overlay?.remove(), 500);
  };
  $('#btn-start')?.addEventListener('click', dismiss);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'Space') dismiss();
  }, { once: true });

  requestAnimationFrame(frame);
}

boot();
