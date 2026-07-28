// 海灣帆航 — entry point: boot WebGL, run the race loop, drive the HUD.

import { createContext, resize } from './gl.js';
import { createSky } from './sky.js';
import { createOcean } from './ocean.js';
import { createSolidProgram } from './solid.js';
import { createBoat } from './boat.js';
import { createBoatState, createWind, stepSailing, pointOfSail, NO_GO } from './sailing.js';
import { createAssist, steerTo, wrap } from './assist.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createCourse, createMarks, gatePosts } from './marks.js';
import { clamp } from './math.js';

const WAVE_AMP = 1.0;
const BEST_KEY = 'sailing-best-v2';
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

  // Easy mode defaults on — this is a casual collection, and the beat is not
  // readable without the guidance arrow. Only an explicit opt-out is stored.
  input.easy = localStorage.getItem(EASY_KEY) !== 'off';
  input.onEasyChange = (on) => {
    localStorage.setItem(EASY_KEY, on ? 'on' : 'off');
    showToast(on ? '簡單模式：跟著綠色箭頭轉舵' : '簡單模式關閉');
  };

  // Set while a one-key tack is being driven; holds the target heading.
  let tackTarget = null;
  let tackTimer = 0;
  const minimap = $('#minimap');
  const miniCtx = minimap.getContext('2d');

  let boat = createBoatState(course.start.heading);
  boat.x = course.start.x;
  boat.z = course.start.z;
  boat.surge = 3.2;
  marks.reset(boat);
  assist.reset(boat, wind);

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
    toast: $('#toast'),
    countdown: $('#countdown'),
    finish: $('#finish-panel'),
    finishTime: $('#finish-time'),
    finishBest: $('#finish-best'),
    finishSplits: $('#finish-splits'),
  };

  function showToast(text) {
    hud.toast.textContent = text;
    hud.toast.classList.add('show');
    toastTimer = 2.2;
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
      const rec = assist.recommend(boat, wind, marks.nextGate);
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
    boat.surge = 3.2;
    marks.reset(boat);
    assist.reset(boat, wind);
    tackTarget = null;
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
    if (hud.tackBtn) hud.tackBtn.hidden = !input.easy;
    if (!on) return;

    const rec = assist.recommend(boat, wind, gate);
    const rel = wrap(rec.heading - boat.heading);
    hud.guide.style.transform = `rotate(${(rel * 180) / Math.PI}deg)`;

    const deg = (rel * 180) / Math.PI;
    const aligned = Math.abs(deg) < 8;
    // Which side the wind sits on for the recommended heading, using the same
    // sign convention as the apparent-wind readout.
    const side = wrap(wind.from - rec.heading) >= 0 ? '右' : '左';

    let text;
    if (tackTarget !== null) text = '換舷中…';
    else if (!aligned) text = `向${deg > 0 ? '右' : '左'}轉 ${Math.abs(deg).toFixed(0)}°`;
    else if (rec.beating) text = `搶風中（${side}舷）· 空白鍵換舷`;
    else text = '航向正確';

    hud.guideTip.textContent = text;
    hud.guideTip.classList.toggle('good', aligned);
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

  /**
   * One-key tack: latch the heading on the other side of the wind and steer to
   * it. Hands control back the moment the boat settles, the player touches the
   * rudder, or the manoeuvre runs long — an assist that fights you is worse
   * than none.
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
    if (settled || tackTimer <= 0 || controls.rudder !== 0 || !input.easy) {
      tackTarget = null;
      return controls;
    }
    return { ...controls, rudder: steerTo(boat, tackTarget) };
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

    let controls = { rudder: 0, trimDelta: 0, autoTrim: true };
    if (phase === 'countdown') {
      countdown -= dt;
      const n = Math.ceil(countdown);
      hud.countdown.hidden = false;
      hud.countdown.textContent = n > 0 ? String(n) : 'GO';
      // Soft hold during countdown — slight steer allowed to line up.
      const raw = input.sample(dt);
      controls = { rudder: raw.rudder * 0.35, trimDelta: 0, autoTrim: true };
      controls = applyTackAssist(controls, dt);
      stepSailing(boat, wind, controls, dt, now * 0.001, WAVE_AMP, input.easy);
      if (countdown <= 0) {
        phase = 'racing';
        raceTime = 0;
        hud.countdown.hidden = true;
        showToast('計時開始！穿過綠色閘門');
      }
    } else if (phase === 'racing') {
      controls = applyTackAssist(input.sample(dt), dt);
      stepSailing(boat, wind, controls, dt, now * 0.001, WAVE_AMP, input.easy);
      raceTime += dt;

      const cleared = marks.tryClear(boat);
      if (cleared) {
        splits.push({ name: cleared.cleared.name, time: raceTime });
        renderSplits();
        const left = course.gates.length - marks.nextIndex;
        if (cleared.cleared.isFinish || marks.nextIndex >= course.gates.length) {
          phase = 'finished';
          if (bestTime == null || raceTime < bestTime) {
            bestTime = raceTime;
            localStorage.setItem(BEST_KEY, String(bestTime));
          }
          hud.finish.hidden = false;
          hud.finishTime.textContent = formatTime(raceTime);
          hud.finishBest.textContent = formatTime(bestTime);
          hud.finishSplits.innerHTML = splits
            .map((s) => `<li><span>${s.name}</span><span>${formatTime(s.time)}</span></li>`)
            .join('');
          showToast(`完賽 ${formatTime(raceTime)}`);
        } else {
          showToast(`${cleared.cleared.name} · ${formatTime(raceTime)} · 剩 ${left} 門`);
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
        WAVE_AMP
      );
    }

    wakeAcc += dt;
    if (wakeAcc > 0.08) {
      wakeAcc = 0;
      const strength = clamp(boat.speed / 6, 0, 1) * 0.9;
      if (strength > 0.05) {
        wake.unshift({ x: boat.x, z: boat.z, strength });
        if (wake.length > 32) wake.pop();
      }
      for (const w of wake) w.strength *= 0.965;
    }
    ocean.setWake(wake);

    marks.update(now * 0.001, WAVE_AMP);
    camera.update(boat, input.lookYaw, dt);
    camera.commit();

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
      waveAmp: WAVE_AMP,
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
