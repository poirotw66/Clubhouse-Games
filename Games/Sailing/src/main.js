// 海灣帆航 — entry point: boot WebGL, run the race loop, drive the HUD.

import { createContext, resize } from './gl.js';
import { createSky } from './sky.js';
import { createOcean } from './ocean.js';
import { createSolidProgram } from './solid.js';
import { createBoat } from './boat.js';
import { createBoatState, createWind, stepSailing, pointOfSail, NO_GO } from './sailing.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createCourse, createMarks } from './marks.js';
import { clamp } from './math.js';

const WAVE_AMP = 1.0;
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
  const course = createCourse(wind.baseFrom);
  const marks = createMarks(gl, solid, course);
  const camera = createCamera();
  const input = createInput(document.body);

  let boat = createBoatState(course.start.heading);
  boat.x = course.start.x;
  boat.z = course.start.z;

  let nextMark = 0;
  let lap = 0;
  const TOTAL_LAPS = 1;
  let raceTime = 0;
  let racing = true;
  let finished = false;
  let bestTime = Number(localStorage.getItem('sailing-best') || '') || null;

  const wake = [];
  let wakeAcc = 0;

  const hud = {
    speed: $('#hud-speed'),
    wind: $('#hud-wind'),
    point: $('#hud-point'),
    trim: $('#hud-trim'),
    mark: $('#hud-mark'),
    time: $('#hud-time'),
    best: $('#hud-best'),
    auto: $('#btn-autotrim'),
    compass: $('#wind-needle'),
    finish: $('#finish-panel'),
    finishTime: $('#finish-time'),
    finishBest: $('#finish-best'),
  };

  function resetRace() {
    boat = createBoatState(course.start.heading);
    boat.x = course.start.x;
    boat.z = course.start.z;
    nextMark = 0;
    lap = 0;
    raceTime = 0;
    racing = true;
    finished = false;
    wake.length = 0;
    camera.snap(boat);
    hud.finish.hidden = true;
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

  let last = performance.now();
  let hudAcc = 0;

  function updateHud(dt) {
    hudAcc += dt;
    if (hudAcc < 0.08) return;
    hudAcc = 0;

    const kn = boat.speed * 1.94384;
    hud.speed.textContent = `${kn.toFixed(1)} kn`;
    hud.wind.textContent = `${wind.speed.toFixed(1)} m/s`;
    hud.point.textContent = pointOfSail(boat.awa).label;
    const trimDeg = (boat.trim * 180) / Math.PI;
    hud.trim.textContent = input.autoTrim
      ? `自動 ${trimDeg.toFixed(0)}°`
      : `${trimDeg.toFixed(0)}°`;
    hud.auto.classList.toggle('active', input.autoTrim);
    hud.auto.setAttribute('aria-pressed', input.autoTrim ? 'true' : 'false');

    if (finished) {
      hud.mark.textContent = '完賽';
    } else if (nextMark < course.marks.length) {
      hud.mark.textContent = `下一標：${course.marks[nextMark].name}（${nextMark + 1}/${course.marks.length}）`;
    } else {
      hud.mark.textContent = '返回起點';
    }
    hud.time.textContent = formatTime(raceTime);
    hud.best.textContent = bestTime != null ? formatTime(bestTime) : '—';

    // Wind needle: apparent wind relative to boat heading, screen-up = bow.
    const awaDeg = (boat.awa * 180) / Math.PI;
    hud.compass.style.transform = `rotate(${awaDeg}deg)`;
    hud.compass.classList.toggle('luffing', boat.luffing > 0.35);
    hud.compass.classList.toggle('nogo', Math.abs(boat.awa) < NO_GO);
  }

  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;

    if (input.consumePress('KeyR')) resetRace();
    if (input.consumePress('KeyH') || input.consumePress('Slash')) {
      $('#help-panel').hidden = !$('#help-panel').hidden;
    }

    const aspect = resize(gl, canvas);
    camera.resize(aspect);

    wind.update(now * 0.001);
    const controls = input.sample(dt);

    if (racing && !finished) {
      stepSailing(boat, wind, controls, dt, now * 0.001, WAVE_AMP);
      raceTime += dt;

      if (marks.hitTest(boat, nextMark)) {
        nextMark += 1;
        if (nextMark >= course.marks.length) {
          lap += 1;
          if (lap >= TOTAL_LAPS) {
            finished = true;
            racing = false;
            if (bestTime == null || raceTime < bestTime) {
              bestTime = raceTime;
              localStorage.setItem('sailing-best', String(bestTime));
            }
            hud.finish.hidden = false;
            hud.finishTime.textContent = formatTime(raceTime);
            hud.finishBest.textContent = bestTime != null ? formatTime(bestTime) : '—';
          } else {
            nextMark = 0;
          }
        }
      }
    } else if (!finished) {
      // Still let the boat sit on the waves when paused / finished intro.
      stepSailing(boat, wind, { rudder: 0, trimDelta: 0, autoTrim: true }, dt, now * 0.001, WAVE_AMP);
    } else {
      // Drift gently after finish.
      stepSailing(boat, wind, { rudder: 0, trimDelta: 0, autoTrim: true }, dt, now * 0.001, WAVE_AMP);
    }

    // Wake ribbon.
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
    gl.disable(gl.CULL_FACE); // sails + thin poles
    boatMesh.draw(pass);
    marks.draw(pass);
    gl.enable(gl.CULL_FACE);

    updateHud(dt);
    requestAnimationFrame(frame);
  }

  // Dismiss title overlay on first interaction.
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
