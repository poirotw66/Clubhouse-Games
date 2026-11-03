// 美洲盃雙翼電競戰術駕駛艙 (Americas Cup Dual-Wing Racing Cockpit)
// Manages telemetry, polar wind radar, VMG sparklines, delta tracker, and tactical playbook.

import { clamp } from './math.js';
import { NO_GO, pointOfSail } from './sailing.js';
import { wrap } from './assist.js';

const MS_TO_KNOTS = 1.94384;
const SPARKLINE_MAX_SAMPLES = 32;

/**
 * Tactical sailing playbook knowledge base.
 */
export const TACTICAL_CARDS = [
  {
    id: 'tack',
    icon: '🌀',
    title: '搶風轉向',
    subtitle: 'Tacking',
    summary: '頂風時沿 Layline 走 Z 字，切換舷側搶迎風。',
    tip: '搶風技巧：頂風無法直航，保持與真風夾角約 50°~60°，換舷時按【空白鍵】快速翻轉！',
  },
  {
    id: 'reach',
    icon: '⚡',
    title: '橫風疾馳',
    subtitle: 'Beam Reach',
    summary: '風從正側吹來，推力極限，全速破浪衝刺。',
    tip: '橫風技巧：相對風在 90° 附近氣動推力最高！按住加速衝向下一門。',
  },
  {
    id: 'nogo',
    icon: '🛑',
    title: '頂風死角',
    subtitle: 'No-Go Zone',
    summary: '船首夾角小於 32° 推力歸零，快速轉舵脫離。',
    tip: '避險提示：正頂風紅區帆面失速！← → 轉舵離開紅區約 40°，船速恢復再加速。',
  },
  {
    id: 'run',
    icon: '💨',
    title: '順風放帆',
    subtitle: 'Running',
    summary: '順風前進，大幅放鬆帆索捕獲最大風推力。',
    tip: '順風技巧：風從正後方吹來時放帆吃滿風，注意保持船身平穩避免蛇行。',
  },
];

export function createCockpit(root, options = {}) {
  const { showToast = () => {} } = options;

  // DOM elements
  const elVmgVal = root.querySelector('#hud-vmg-val');
  const elVmgEff = root.querySelector('#hud-vmg-eff');
  const elVmgCanvas = root.querySelector('#vmg-canvas');
  const elDeltaBadge = root.querySelector('#hud-delta-badge');
  const elTwaBadge = root.querySelector('#hud-twa-badge');
  const elAwaBadge = root.querySelector('#hud-awa-badge');
  const elWindAppNeedle = root.querySelector('#wind-app-needle');
  const elTacticalTip = root.querySelector('#hud-tactical-tip');
  const elMobileTicker = root.querySelector('#tactical-ticker');
  const tacticCardEls = root.querySelectorAll('.tactic-card');
  const keyCapEls = root.querySelectorAll('.key-cap');

  // Sparkline canvas context
  let vmgCtx = null;
  if (elVmgCanvas) {
    vmgCtx = elVmgCanvas.getContext('2d');
  }

  // Ring buffer for speed & VMG sparkline
  const samples = [];
  let sampleTimer = 0;
  let activeTacticId = 'reach';

  // Bind keypress feedback for Esports Keybindings Bar
  const keyMap = new Map();
  keyCapEls.forEach((cap) => {
    const code = cap.getAttribute('data-code');
    if (code) keyMap.set(code, cap);
  });

  const onKeyDown = (e) => {
    const cap = keyMap.get(e.code);
    if (cap) cap.classList.add('pressed');
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      keyMap.get('KeyA')?.classList.add('pressed');
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      keyMap.get('KeyD')?.classList.add('pressed');
    }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      keyMap.get('KeyW')?.classList.add('pressed');
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      keyMap.get('KeyS')?.classList.add('pressed');
    }
  };

  const onKeyUp = (e) => {
    const cap = keyMap.get(e.code);
    if (cap) cap.classList.remove('pressed');
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      keyMap.get('KeyA')?.classList.remove('pressed');
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      keyMap.get('KeyD')?.classList.remove('pressed');
    }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      keyMap.get('KeyW')?.classList.remove('pressed');
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      keyMap.get('KeyS')?.classList.remove('pressed');
    }
  };

  const onWindowBlur = () => {
    keyCapEls.forEach((cap) => cap.classList.remove('pressed'));
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onWindowBlur);

  // Click on tactic cards to view tactic briefing
  tacticCardEls.forEach((card) => {
    card.addEventListener('click', () => {
      const tid = card.getAttribute('data-tactic');
      const item = TACTICAL_CARDS.find((t) => t.id === tid);
      if (item) {
        showToast(`${item.icon} ${item.title}：${item.tip}`);
      }
    });
  });

  function reset() {
    samples.length = 0;
    sampleTimer = 0;
    activeTacticId = 'reach';
    drawSparkline();
  }

  function drawSparkline() {
    if (!vmgCtx || !elVmgCanvas) return;
    const ctx = vmgCtx;
    const w = elVmgCanvas.width;
    const h = elVmgCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // High-tech subtle background grid lines (5 kn, 10 kn, 15 kn)
    ctx.strokeStyle = 'rgba(232, 244, 246, 0.08)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach((ratio) => {
      ctx.beginPath();
      ctx.moveTo(0, h * ratio);
      ctx.lineTo(w, h * ratio);
      ctx.stroke();
    });

    if (samples.length < 2) return;

    const maxSpeed = 22.0; // scale limit in knots
    const stepX = w / (SPARKLINE_MAX_SAMPLES - 1);
    const startX = w - (samples.length - 1) * stepX;

    // Helper to map speed to Y coord
    const toY = (val) => clamp(h - (val / maxSpeed) * (h - 6) - 3, 2, h - 2);

    // 1. Draw Speed area & curve (cyan: #2cb5a8)
    ctx.beginPath();
    samples.forEach((pt, i) => {
      const x = startX + i * stepX;
      const y = toY(pt.speed);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#2cb5a8';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = 'rgba(44, 181, 168, 0.6)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 2. Draw VMG area & curve (amber/gold: #f5a623)
    ctx.beginPath();
    samples.forEach((pt, i) => {
      const x = startX + i * stepX;
      const y = toY(pt.vmg);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#f5a623';
    ctx.lineWidth = 2.0;
    ctx.shadowColor = 'rgba(245, 166, 35, 0.7)';
    ctx.shadowBlur = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. Glowing current-point pip on leading edge
    const last = samples[samples.length - 1];
    const lastX = w;
    const speedY = toY(last.speed);
    const vmgY = toY(last.vmg);

    ctx.fillStyle = '#8ef7d2';
    ctx.beginPath();
    ctx.arc(lastX - 2, speedY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffcf56';
    ctx.beginPath();
    ctx.arc(lastX - 2, vmgY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function updateTacticalPlaybook(boat, awaAbsDeg) {
    let nextTactic = 'reach';
    const inIrons = Math.abs(boat.awa) < NO_GO;

    if (inIrons) {
      nextTactic = 'nogo';
    } else if (awaAbsDeg < 65) {
      nextTactic = 'tack';
    } else if (awaAbsDeg < 125) {
      nextTactic = 'reach';
    } else {
      nextTactic = 'run';
    }

    if (nextTactic !== activeTacticId) {
      activeTacticId = nextTactic;
      tacticCardEls.forEach((card) => {
        const matches = card.getAttribute('data-tactic') === nextTactic;
        card.classList.toggle('active', matches);
      });
      const card = TACTICAL_CARDS.find((t) => t.id === nextTactic);
      if (elTacticalTip && card) {
        elTacticalTip.textContent = `${card.icon} 建議戰術：${card.summary}`;
      }
    }
  }

  function calculateDelta({ boat, marks, rivals, ghostPlayback, raceTime, playMode }) {
    if (playMode === 'trial') {
      if (!ghostPlayback) {
        return { text: '計時競速 · 挑戰自我', status: 'neutral' };
      }
      const ghost = ghostPlayback.sample(raceTime);
      const gate = marks.nextGate;
      if (!gate) return { text: '完賽結算', status: 'ahead' };
      const dPlayer = marks.distanceToNext(boat);
      const dGhost = Math.hypot(gate.x - ghost.x, gate.z - ghost.z);
      const diffDist = dGhost - dPlayer; // > 0 means player is closer
      const spd = Math.max(1.0, boat.speed);
      const diffSec = diffDist / spd;
      const absSec = Math.abs(diffSec).toFixed(1);
      if (diffSec >= 0) {
        return { text: `領先幽靈 +${absSec}s`, status: 'ahead' };
      }
      return { text: `落後幽靈 -${absSec}s`, status: 'behind' };
    }

    // Race / Regatta mode: compare with rivals
    if (!rivals || rivals.length === 0) {
      return { text: '單獨航行中', status: 'neutral' };
    }

    const gate = marks.nextGate;
    if (!gate) return { text: '完賽衝線', status: 'ahead' };

    const myDist = marks.distanceToNext(boat);
    const sorted = [
      { id: 'you', dist: myDist, nextIdx: marks.nextIndex, isYou: true },
      ...rivals.map((r) => ({
        id: r.profile.id,
        dist: Math.hypot(gate.x - r.boat.x, gate.z - r.boat.z),
        nextIdx: r.nextIndex,
        isYou: false,
      })),
    ].sort((a, b) => {
      if (a.nextIdx !== b.nextIdx) return b.nextIdx - a.nextIdx;
      return a.dist - b.dist;
    });

    const myRank = sorted.findIndex((s) => s.isYou) + 1;
    const spd = Math.max(1.2, boat.speed);

    if (myRank === 1) {
      const runnerUp = sorted[1];
      const gapSec = runnerUp ? Math.max(0.1, (runnerUp.dist - myDist) / spd) : 0;
      return { text: `第 1 名 · 領先 +${gapSec.toFixed(1)}s`, status: 'ahead' };
    }

    const leader = sorted[0];
    const lagSec = Math.max(0.1, (myDist - leader.dist) / spd);
    return { text: `第 ${myRank} 名 · 落後 -${lagSec.toFixed(1)}s`, status: 'behind' };
  }

  function update(params) {
    const {
      boat,
      wind,
      marks,
      rivals,
      ghostPlayback,
      raceTime,
      playMode,
      easy,
      dt,
    } = params;

    const speedKn = boat.speed * MS_TO_KNOTS;

    // 1. Calculate Waypoint VMG (Velocity Made Good)
    let vmgKn = 0;
    if (marks.nextGate) {
      const bearing = marks.bearingToNext(boat);
      const angleToTarget = wrap(bearing - boat.heading);
      vmgKn = Math.max(0, speedKn * Math.cos(angleToTarget));
    } else {
      vmgKn = speedKn;
    }

    const vmgEff = speedKn > 0.5 ? clamp(Math.round((vmgKn / speedKn) * 100), 0, 100) : 0;

    if (elVmgVal) elVmgVal.textContent = `${vmgKn.toFixed(1)} kn`;
    if (elVmgEff) elVmgEff.textContent = `${vmgEff}% 迎風效率`;

    // 2. Sample VMG sparkline buffer
    sampleTimer += dt;
    if (sampleTimer >= 0.12) {
      sampleTimer = 0;
      samples.push({ speed: speedKn, vmg: vmgKn });
      if (samples.length > SPARKLINE_MAX_SAMPLES) samples.shift();
      drawSparkline();
    }

    // 3. True Wind (TWA) & Apparent Wind (AWA) Telemetry
    const twaRad = wrap(boat.heading - wind.from);
    const twaDeg = (twaRad * 180) / Math.PI;
    const twaAbs = Math.abs(twaDeg);
    const twsKn = wind.speed * MS_TO_KNOTS;

    const awaRad = boat.awa;
    const awaDeg = (awaRad * 180) / Math.PI;
    const awaAbs = Math.abs(awaDeg);
    const awsKn = (boat.apparentSpeed || wind.speed) * MS_TO_KNOTS;

    if (elTwaBadge) {
      elTwaBadge.textContent = `真風 TWA ${twaAbs.toFixed(0)}° / ${twsKn.toFixed(1)} kn`;
    }
    if (elAwaBadge) {
      elAwaBadge.textContent = `視風 AWA ${awaAbs.toFixed(0)}° / ${awsKn.toFixed(1)} kn`;
    }

    // Apparent wind vector needle in compass
    if (elWindAppNeedle) {
      elWindAppNeedle.style.transform = `rotate(${awaDeg}deg)`;
    }

    // 4. Update Delta Tracker
    const delta = calculateDelta({ boat, marks, rivals, ghostPlayback, raceTime, playMode });
    if (elDeltaBadge) {
      elDeltaBadge.textContent = delta.text;
      elDeltaBadge.className = `delta-badge ${delta.status}`;
    }

    // 5. Update Tactical Playbook
    updateTacticalPlaybook(boat, easy ? twaAbs : awaAbs);

    // 6. Mobile Ticker update
    if (elMobileTicker) {
      const sailPoint = pointOfSail(boat.awa).label;
      elMobileTicker.textContent = `航速 ${speedKn.toFixed(1)} kn · VMG ${vmgKn.toFixed(1)} kn · ${sailPoint}`;
    }
  }

  function syncMode(easy) {
    document.body.classList.toggle('easy-mode', easy);
    const modeBadge = root.querySelector('#cockpit-trim-mode');
    if (modeBadge) {
      modeBadge.textContent = easy ? '自動調帆' : '手動微調';
      modeBadge.classList.toggle('auto', easy);
    }
  }

  return {
    update,
    reset,
    syncMode,
  };
}
