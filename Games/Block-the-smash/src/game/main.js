/**
 * Block the Smash — Three.js court inside the iframe.
 * Depth: readable smash tells/fakes, timing grades, waves, CPU styles, modes + juice.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { createRng } from './rng.js';
import { PHASE_MIX, SMASH_DEFS, resolveAimX } from './smashTypes.js';
import {
  HIT_STOP_GOOD,
  HIT_STOP_PERFECT,
  IMPACT_Z,
  aimZoneFromMouse,
  combineContact,
  etaToImpact,
  getTimingWindowsMs,
  gradePosition,
  gradeTiming,
  scoreForContact,
  versusReturnWinsPoint,
} from './timing.js';
import {
  DIFFICULTY,
  OPPONENTS,
  chooseSmash,
  getOpponent,
} from './opponents.js';
import {
  PHASES,
  applyDrillResult,
  applyScoreAttackResult,
  applyVersusResult,
  drillAccuracy,
  gradeFromAccuracy,
  gradeFromScore,
  loadStats,
  phaseTierFromProgress,
  saveStats,
  scoreAttackWave,
} from './scoring.js';

const DISPLAY_SPEED_MIN = 280;
const DISPLAY_SPEED_MAX = 550;

const CONFIG = {
  baseSpeed: 400,
  dragFactor: 0.008,
  colors: {
    court: 0x1a472a,
    lines: 0xaaaaaa,
    racketFrame: 0x3366cc,
    racketString: 0xeeeeee,
    shuttle: 0xffffff,
    trail: 0x00ffff,
  },
};

const PREFERS_REDUCED =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- AUDIO (in-iframe synth; parent still plays suite tones on result) ---
const AudioSys = {
  ctx: null,
  muted: false,

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  },

  playSwoosh() {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1;
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  },

  playHit(kind) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    if (kind === 'perfect') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.12);
      gain.gain.setValueAtTime(0.85, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
      const osc2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, t);
      g2.gain.setValueAtTime(0.35, t);
      g2.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc2.connect(g2);
      g2.connect(this.ctx.destination);
      osc2.start();
      osc2.stop(t + 0.22);
    } else if (kind === 'good' || kind === 'smash') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
      gain.gain.setValueAtTime(0.75, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    }
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + 0.22);
  },

  playMiss() {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + 0.22);
  },

  playTell() {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.12);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + 0.16);
  },
};

let lastOut = 0;

// --- STATE ---
let state = {
  mode: 'drill', // drill | scoreAttack | versus
  hits: 0,
  misses: 0,
  blocks: 0,
  perfects: 0,
  goods: 0,
  combo: 0,
  maxCombo: 0,
  score: 0,
  maxBalls: 25,
  spawnedBalls: 0,
  clearedBalls: 0,
  difficulty: 'normal',
  phaseIndex: 0,
  isRunning: false,
  isPaused: false,
  isInCountdown: false,
  mouse: { x: 0, y: 0 },
  swinging: false,
  swingTime: 0,
  swingDuration: 0.15,
  swingEtaAtStart: null,
  handedness: 'right',
  lastSpawnTime: 0,
  shake: 0,
  flash: 0,
  hitStop: 0,
  muted: false,
  toastTimer: 0,
  lives: 3,
  windup: null, // { remaining, total, tell, real, isFake }
  opponentId: 'hao',
  playerPoints: 0,
  cpuPoints: 0,
  pointsToWin: 5,
  versusStreak: 0,
  rallyPressure: 0,
  waitingForNextSmash: false,
  rng: createRng(Date.now() >>> 0),
};

function storage() {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

window.addEventListener('message', (e) => {
  if (!e.data || typeof e.data !== 'object') return;
  if (e.data.type === 'PAUSE_GAME') {
    state.isPaused = e.data.payload;
    if (!state.isPaused && !state.isInCountdown && state.isRunning) {
      clock.getDelta();
      AudioSys.init();
    }
  }
  if (e.data.type === 'SET_HANDEDNESS') {
    state.handedness = e.data.payload;
    updateRacketOrientation();
  }
  if (e.data.type === 'SET_MUTE') {
    state.muted = e.data.payload;
    AudioSys.muted = state.muted;
  }
  if (e.data.type === 'START_MATCH') {
    const payload = e.data.payload;
    if (payload && typeof payload === 'object') {
      startMatch(payload);
    } else {
      startMatch({ mode: 'drill', balls: payload ?? 25, difficulty: 'normal' });
    }
  }
});

// --- SCENE ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 200);
const baseCamPos = new THREE.Vector3(0, 1.0, 14);
camera.position.copy(baseCamPos);
camera.rotation.order = 'YXZ';
camera.rotation.x = (-10 * Math.PI) / 180;
camera.rotation.y = 0;

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.5;
bloomPass.strength = 0.6;
bloomPass.radius = 0.2;

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

const textureLoader = new THREE.TextureLoader();
const assetBase = import.meta.env.BASE_URL ?? './';

const skyTex = textureLoader.load(`${assetBase}textures/sky.jpg`);
skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;
scene.fog = new THREE.Fog(CONFIG.colors.court, 40, 140);

const courtTex = textureLoader.load(`${assetBase}textures/court.jpg`);
courtTex.colorSpace = THREE.SRGBColorSpace;
courtTex.wrapS = courtTex.wrapT = THREE.RepeatWrapping;
courtTex.repeat.set(8, 8);
const court = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({
    map: courtTex,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.05,
  }),
);
court.rotation.x = -Math.PI / 2;
court.position.y = -5.01;
scene.add(court);

const gridHelper = new THREE.GridHelper(200, 20, CONFIG.colors.lines, 0x225533);
gridHelper.position.y = -5;
scene.add(gridHelper);

const netGeo = new THREE.BoxGeometry(60, 5, 0.1);
const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, wireframe: true });
const net = new THREE.Mesh(netGeo, netMat);
net.position.set(0, -1, -40);
const tape = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 0.15), new THREE.MeshBasicMaterial({ color: 0xffffff }));
tape.position.y = 2.5;
net.add(tape);
scene.add(net);

// Opponent tell figure (far court)
const opponentGroup = new THREE.Group();
opponentGroup.position.set(0, -0.5, -62);
scene.add(opponentGroup);

const oppBody = new THREE.Mesh(
  new THREE.CylinderGeometry(1.35, 1.5, 4.2, 12),
  new THREE.MeshStandardMaterial({ color: 0x4a6578, roughness: 0.55, metalness: 0.15 }),
);
oppBody.position.y = 1.4;
opponentGroup.add(oppBody);

const oppHead = new THREE.Mesh(
  new THREE.SphereGeometry(0.85, 12, 12),
  new THREE.MeshStandardMaterial({ color: 0xd8c4a8, roughness: 0.65 }),
);
oppHead.position.y = 4.0;
opponentGroup.add(oppHead);

const oppRacketPivot = new THREE.Group();
oppRacketPivot.position.set(1.8, 2.8, 0.6);
opponentGroup.add(oppRacketPivot);

const oppRacket = new THREE.Mesh(
  new THREE.TorusGeometry(1.6, 0.18, 6, 24),
  new THREE.MeshStandardMaterial({
    color: 0xff5555,
    emissive: 0xff2222,
    emissiveIntensity: 0.85,
  }),
);
oppRacket.scale.set(1, 1.25, 1);
oppRacket.position.y = 2.6;
oppRacketPivot.add(oppRacket);

const oppTellLight = new THREE.PointLight(0xff3333, 0, 48);
oppTellLight.position.set(0, 3.5, 4);
opponentGroup.add(oppTellLight);

const playerGroup = new THREE.Group();
playerGroup.position.set(2, -2.5, 4);
scene.add(playerGroup);

const wristPivot = new THREE.Group();
playerGroup.add(wristPivot);

const racketVisuals = new THREE.Group();
racketVisuals.position.y = 5.0;
racketVisuals.rotation.z = -Math.PI / 2;
wristPivot.add(racketVisuals);

function updateRacketOrientation() {
  racketVisuals.rotation.set(0, 0, 0);
  racketVisuals.rotation.z = state.handedness === 'left' ? -Math.PI / 2 : Math.PI / 2;
}

const frameMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.racketFrame, roughness: 0.4 });
const frame = new THREE.Mesh(new THREE.TorusGeometry(2, 0.15, 8, 32), frameMat);
frame.scale.set(1, 1.3, 1);
racketVisuals.add(frame);

function createStringTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  const step = 32;
  for (let i = 0; i <= 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

const strings = new THREE.Mesh(
  new THREE.CircleGeometry(1.9, 32),
  new THREE.MeshBasicMaterial({
    map: createStringTexture(),
    color: CONFIG.colors.racketString,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  }),
);
strings.scale.set(1, 1.3, 1);
racketVisuals.add(strings);

const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1), frameMat);
neck.position.y = -2;
racketVisuals.add(neck);

const handle = new THREE.Mesh(
  new THREE.CylinderGeometry(0.15, 0.15, 3.5),
  new THREE.MeshStandardMaterial({ color: 0x111111 }),
);
handle.position.y = -4.25;
racketVisuals.add(handle);

const light = new THREE.PointLight(0xffffff, 2, 20);
light.position.set(5, 5, 5);
playerGroup.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(0, 10, 0);
scene.add(dirLight);

class Pool {
  constructor(createFn, count) {
    this.createFn = createFn;
    this.pool = [];
    this.active = [];
    for (let i = 0; i < count; i++) {
      const obj = createFn();
      obj.visible = false;
      scene.add(obj);
      this.pool.push(obj);
    }
  }

  get() {
    if (this.pool.length === 0) return null;
    const obj = this.pool.pop();
    obj.visible = true;
    this.active.push(obj);
    return obj;
  }

  release(obj) {
    const index = this.active.indexOf(obj);
    if (index > -1) {
      this.active.splice(index, 1);
      obj.visible = false;
      this.pool.push(obj);
    }
  }

  reset() {
    [...this.active].forEach((obj) => this.release(obj));
  }
}

const shuttlePool = new Pool(() => {
  const group = new THREE.Group();
  const cork = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 16),
    new THREE.MeshStandardMaterial({ color: CONFIG.colors.shuttle, roughness: 0.6 }),
  );
  group.add(cork);
  const skirt = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 0.7, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
  );
  skirt.position.y = 0.35;
  group.add(skirt);

  const trailPoints = [];
  for (let i = 0; i < 5; i++) trailPoints.push(new THREE.Vector3(0, 0, 0));
  const trail = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(trailPoints),
    new THREE.LineBasicMaterial({ color: CONFIG.colors.trail, transparent: true, opacity: 0.5 }),
  );
  scene.add(trail);
  trail.visible = false;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.8, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -4.95;
  scene.add(shadow);
  shadow.visible = false;

  group.rotation.x = -Math.PI / 2;
  group.userData = {
    velocity: new THREE.Vector3(),
    rotSpeed: 0,
    returning: false,
    trail,
    shadow,
    history: [],
    smashType: 'straight',
    dropRate: 0,
    scored: false,
  };
  return group;
}, 30);

const particlePool = new Pool(() => {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
  );
  mesh.userData = { velocity: new THREE.Vector3(), life: 0 };
  return mesh;
}, 150);

// --- INPUT ---
function updatePointer(clientX, clientY) {
  state.mouse.x = (clientX / window.innerWidth) * 2 - 1;
  state.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
}

function trySwing() {
  AudioSys.init();
  if (!state.swinging && state.isRunning && !state.isPaused && state.hitStop <= 0) {
    state.swinging = true;
    state.swingTime = 0;
    // Capture ETA of nearest approaching shuttle for timing grade.
    let bestEta = null;
    for (const s of shuttlePool.active) {
      if (s.userData.returning) continue;
      const eta = etaToImpact(s.position, s.userData.velocity);
      if (eta == null) continue;
      if (bestEta == null || eta < bestEta) bestEta = eta;
    }
    state.swingEtaAtStart = bestEta;
    AudioSys.playSwoosh();
  }
}

window.addEventListener('pointermove', (e) => updatePointer(e.clientX, e.clientY));
window.addEventListener(
  'pointerdown',
  (e) => {
    if (e.pointerType === 'touch') e.preventDefault();
    updatePointer(e.clientX, e.clientY);
    trySwing();
  },
  { passive: false },
);
window.addEventListener('mousemove', (e) => updatePointer(e.clientX, e.clientY));
window.addEventListener('mousedown', () => trySwing());

// --- HUD helpers ---
function diffCfg() {
  return DIFFICULTY[state.difficulty] || DIFFICULTY.normal;
}

function phaseProgress() {
  if (state.mode === 'scoreAttack') {
    return Math.min(0.99, scoreAttackWave(state.clearedBalls) / 6);
  }
  return state.maxBalls > 0 ? state.spawnedBalls / state.maxBalls : 0;
}

function phaseTier() {
  if (state.mode === 'scoreAttack') return Math.min(2, scoreAttackWave(state.clearedBalls));
  if (state.mode === 'versus') return Math.min(2, state.playerPoints + state.cpuPoints);
  return phaseTierFromProgress(phaseProgress());
}

function showToast(text, kind) {
  const el = document.getElementById('hit-toast');
  if (!el) return;
  el.textContent = text;
  el.className = kind === 'bad' ? 'bad show' : kind === 'perfect' ? 'perfect show' : 'good show';
  state.toastTimer = kind === 'perfect' ? 0.7 : 0.55;
}

function updateComboHud() {
  const el = document.getElementById('combo-hud');
  const val = document.getElementById('combo-val');
  if (!el || !val) return;
  val.textContent = String(state.combo);
  el.classList.toggle('active', state.combo >= 2);
}

function updatePhaseBanner() {
  const tier = phaseTier();
  if (tier !== state.phaseIndex) {
    state.phaseIndex = tier;
    if (state.mode === 'drill') showToast(PHASES[tier].label, 'good');
    else if (state.mode === 'scoreAttack') showToast(`第 ${tier + 1} 波`, 'good');
  }
  const el = document.getElementById('phase-banner');
  if (!el) return;
  if (state.mode === 'versus') {
    const opp = getOpponent(state.opponentId);
    el.textContent = opp ? opp.name : '對戰';
  } else if (state.mode === 'scoreAttack') {
    el.textContent = `波次 ${scoreAttackWave(state.clearedBalls) + 1}`;
  } else {
    el.textContent = PHASES[Math.min(2, tier)].label;
  }
}

function updateScoreHud() {
  const scoreVal = document.getElementById('score-val');
  const maxVal = document.getElementById('max-val');
  const missVal = document.getElementById('miss-val');
  const livesEl = document.getElementById('lives-val');
  const versusEl = document.getElementById('versus-score');
  const scoreLabel = document.getElementById('score-label');

  if (state.mode === 'scoreAttack') {
    if (scoreLabel) scoreLabel.textContent = '得分';
    if (scoreVal) scoreVal.textContent = String(state.score);
    if (maxVal) maxVal.textContent = `♥${state.lives}`;
    if (missVal) missVal.textContent = String(state.misses);
  } else if (state.mode === 'versus') {
    if (scoreLabel) scoreLabel.textContent = '比分';
    if (scoreVal) scoreVal.textContent = `${state.playerPoints}`;
    if (maxVal) maxVal.textContent = `${state.cpuPoints}`;
    if (missVal) missVal.textContent = String(state.misses);
    if (versusEl) {
      versusEl.style.display = 'block';
      versusEl.textContent = `先至 ${state.pointsToWin} 分`;
    }
  } else {
    if (scoreLabel) scoreLabel.textContent = '擋下';
    if (scoreVal) scoreVal.textContent = String(state.hits);
    if (maxVal) maxVal.textContent = String(state.maxBalls);
    if (missVal) missVal.textContent = String(state.misses);
    if (versusEl) versusEl.style.display = 'none';
  }
  if (livesEl) {
    const wrap = document.getElementById('lives-hud');
    if (wrap) wrap.style.display = state.mode === 'scoreAttack' ? 'block' : 'none';
    livesEl.textContent = String(state.lives);
  }
  updateComboHud();
  updatePhaseBanner();
}

function setTellBanner(text, colorHex, fake) {
  const el = document.getElementById('tell-banner');
  if (!el) return;
  if (!text) {
    el.classList.remove('show');
    el.textContent = '';
    return;
  }
  el.textContent = fake ? `${text}？` : text;
  el.style.color = `#${colorHex.toString(16).padStart(6, '0')}`;
  el.classList.add('show');
  el.classList.toggle('fake', !!fake);
}

function resetOpponentPose() {
  oppRacketPivot.rotation.set(0, 0, 0);
  oppTellLight.intensity = 0;
  opponentGroup.position.x = 0;
  setTellBanner('', 0, false);
}

function updateWindupVisual(dt) {
  if (!state.windup) {
    resetOpponentPose();
    return;
  }
  state.windup.remaining -= dt;
  const def = SMASH_DEFS[state.windup.tell];
  const progress = 1 - Math.max(0, state.windup.remaining) / state.windup.total;
  const raise = Math.sin(progress * Math.PI * 0.5);
  oppRacketPivot.rotation.x = -raise * 1.1;
  oppRacketPivot.rotation.z = def.aimProfile === 'side' ? (state.windup.sideSign || 1) * raise * 0.6 : 0;
  oppRacket.material.color.setHex(def.tellColor);
  oppRacket.material.emissive.setHex(def.tellColor);
  oppTellLight.color.setHex(def.tellColor);
  oppTellLight.intensity = 0.6 + raise * 1.8;
  opponentGroup.position.x = def.aimProfile === 'side' ? (state.windup.sideSign || 1) * raise * 6 : 0;
  setTellBanner(def.tellHint, def.tellColor, state.windup.isFake);

  if (state.windup.remaining <= 0) {
    const pending = state.windup;
    state.windup = null;
    spawnShuttleFromPlan(pending);
  }
}

function runCountdown(callback) {
  state.isInCountdown = true;
  const el = document.getElementById('countdown');
  let count = 3;
  el.innerText = count;
  el.style.opacity = 1;
  el.style.transform = 'translate(-50%, -50%) scale(1)';

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      el.innerText = count;
      el.style.animation = 'none';
      el.offsetHeight;
      el.style.animation = null;
    } else {
      clearInterval(interval);
      el.innerText = 'SMASH!';
      setTimeout(() => {
        el.style.opacity = 0;
        state.isInCountdown = false;
        callback();
      }, 600);
    }
  }, 800);
}

function startMatch(opts = {}) {
  const mode = opts.mode === 'scoreAttack' || opts.mode === 'versus' ? opts.mode : 'drill';
  state.mode = mode;
  state.difficulty = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
  state.maxBalls = mode === 'drill' ? opts.balls ?? 25 : 999;
  state.opponentId = opts.opponentId || 'hao';
  const opp = getOpponent(state.opponentId);
  state.pointsToWin = opp?.pointsToWin ?? 5;
  state.rng = createRng((Date.now() ^ (opts.seed ?? 0)) >>> 0);

  state.spawnedBalls = 0;
  state.clearedBalls = 0;
  state.hits = 0;
  state.misses = 0;
  state.blocks = 0;
  state.perfects = 0;
  state.goods = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.score = 0;
  state.phaseIndex = 0;
  state.isRunning = false;
  state.swinging = false;
  state.hitStop = 0;
  state.lives = diffCfg().lives;
  state.playerPoints = 0;
  state.cpuPoints = 0;
  state.rallyPressure = 0;
  state.waitingForNextSmash = false;
  state.windup = null;
  state.versusStreak = 0;

  document.getElementById('game-over').style.display = 'none';
  document.getElementById('speed-val').innerText = '0';
  updateScoreHud();
  document.body.style.cursor = 'none';
  resetOpponentPose();

  shuttlePool.reset();
  shuttlePool.pool.forEach((s) => {
    if (s.userData.trail) s.userData.trail.visible = false;
    if (s.userData.shadow) s.userData.shadow.visible = false;
  });
  particlePool.reset();
  AudioSys.init();

  runCountdown(() => {
    state.isRunning = true;
    state.lastSpawnTime = clock.getElapsedTime();
    if (state.mode === 'versus') queueWindup();
  });
}

function currentMix() {
  return PHASE_MIX[Math.min(2, phaseTier())];
}

function opponentStyle() {
  if (state.mode !== 'versus') return null;
  return getOpponent(state.opponentId)?.style ?? null;
}

function queueWindup() {
  if (!state.isRunning) return;
  if (state.mode === 'drill' && state.spawnedBalls >= state.maxBalls) return;
  if (state.windup) return;

  const style = opponentStyle();
  const cfg = diffCfg();
  const mix = currentMix();
  /** @type {import('./opponents.js').OpponentStyle | null} */
  let pickStyle = style;
  if (!pickStyle) {
    pickStyle = {
      straight: mix.straight,
      cross: mix.cross,
      drop: mix.drop,
      body: mix.body,
      fakeRate: Math.min(0.5, 0.1 * cfg.fakeMul * (1 + phaseTier())),
      speedMul: 1,
      spawnMul: 1,
      defense: 0.3,
      coverLeft: 0.4,
      coverCenter: 0.4,
      coverRight: 0.4,
      aimSpread: cfg.aimSpread,
    };
  }
  const pick = chooseSmash(pickStyle, mix, state.rng);

  const tellDef = SMASH_DEFS[pick.tell];
  const sideSign = state.rng() < 0.5 ? -1 : 1;
  state.windup = {
    remaining: tellDef.windupSec * (style ? 1 : 1 - phaseTier() * 0.06),
    total: tellDef.windupSec,
    tell: pick.tell,
    real: pick.real,
    isFake: pick.isFake,
    sideSign,
  };
  AudioSys.playTell();
}

function spawnShuttleFromPlan(plan) {
  if (state.mode === 'drill' && state.spawnedBalls >= state.maxBalls) return;
  const s = shuttlePool.get();
  if (!s) return;

  state.spawnedBalls++;
  updatePhaseBanner();

  const cfg = diffCfg();
  const style = opponentStyle();
  const tier = phaseTier();
  const def = SMASH_DEFS[plan.real];
  const originZ = -90 - state.rng() * 30;
  const originY = 18 + state.rng() * 6;
  const originX = (state.rng() - 0.5) * 40;

  s.position.set(originX, originY, originZ);

  const aimSpread = (style?.aimSpread ?? cfg.aimSpread) + tier * 3;
  const targetX = resolveAimX(plan.real, {
    handedness: state.handedness,
    playerX: playerGroup.position.x,
    aimSpread,
    sideSign: plan.sideSign,
    rng: state.rng,
  });
  const targetY = plan.real === 'drop' ? -3.2 + state.rng() * 1.2 : -2.5 + state.rng() * 2;
  const targetZ = IMPACT_Z + 1;

  const dir = new THREE.Vector3(targetX - originX, targetY - originY, targetZ - originZ).normalize();
  const progress = phaseProgress();
  const speedMul = cfg.speedMul * def.speedMul * (style?.speedMul ?? 1);
  const initialSpeed =
    CONFIG.baseSpeed * speedMul + (cfg.tierBoost[Math.min(2, tier)] || 0) + progress * 90;

  s.userData.velocity.copy(dir).multiplyScalar(initialSpeed);
  s.userData.rotSpeed = state.rng() * 10;
  s.userData.returning = false;
  s.userData.scored = false;
  s.userData.history = [];
  s.userData.smashType = plan.real;
  s.userData.dropRate = def.dropRate;
  s.userData.isFake = plan.isFake;

  if (s.userData.trail) {
    s.userData.trail.visible = true;
    s.userData.trail.material.color.setHex(def.trailColor);
  }
  if (s.userData.shadow) s.userData.shadow.visible = true;
  s.rotation.set(-Math.PI / 2, 0, 0);

  const ramp = Math.min(1, (tier / 2) * 0.55 + progress * 0.45);
  const speedFeel = Math.min(1.15, Math.max(0.65, def.speedMul));
  const kmh = Math.round(
    Math.min(
      DISPLAY_SPEED_MAX + 40,
      DISPLAY_SPEED_MIN + (DISPLAY_SPEED_MAX - DISPLAY_SPEED_MIN) * ramp * speedFeel,
    ),
  );
  document.getElementById('speed-val').innerText = String(kmh);
  const speedDisplay = document.getElementById('speed-display');
  speedDisplay.style.transform = 'scale(1.3)';
  setTimeout(() => {
    speedDisplay.style.transform = 'scale(1)';
  }, 100);

  setTellBanner(def.label, def.trailColor, false);
  setTimeout(() => setTellBanner('', 0, false), 450);

  if (
    state.mode !== 'versus' &&
    tier === 2 &&
    cfg.doubleChance > 0 &&
    state.rng() < cfg.doubleChance &&
    (state.mode !== 'drill' || state.spawnedBalls < state.maxBalls)
  ) {
    setTimeout(() => {
      if (state.isRunning && !state.windup) queueWindup();
    }, 180);
  }
}

function createFeatherExplosion(pos, count = 8) {
  for (let i = 0; i < count; i++) {
    const p = particlePool.get();
    if (!p) continue;
    p.position.copy(pos);
    p.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    p.userData.velocity.set(
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15 + 10,
    );
    p.userData.life = 0.6;
    p.scale.setScalar(1);
  }
}

function registerMiss(s) {
  if (s.userData.scored) return;
  s.userData.scored = true;
  state.misses += 1;
  state.combo = 0;
  state.rallyPressure = 0;
  updateComboHud();

  if (state.mode === 'scoreAttack') {
    state.lives -= 1;
    showToast(state.lives > 0 ? '漏接!' : '結束!', 'bad');
  } else if (state.mode === 'versus') {
    state.cpuPoints += 1;
    showToast('對手得分', 'bad');
    state.waitingForNextSmash = true;
  } else {
    showToast('漏接!', 'bad');
  }

  AudioSys.playMiss();
  if (!PREFERS_REDUCED) state.shake = Math.max(state.shake, 0.4);
  updateScoreHud();

  if (state.mode === 'scoreAttack' && state.lives <= 0) {
    finishMatch();
  } else if (state.mode === 'versus') {
    if (state.cpuPoints >= state.pointsToWin) finishMatch();
    else {
      setTimeout(() => {
        if (state.isRunning) {
          state.waitingForNextSmash = false;
          queueWindup();
        }
      }, 700);
    }
  }
}

function applyContactResult(s, grade) {
  s.userData.scored = true;
  s.userData.returning = true;
  const aimZone = aimZoneFromMouse(state.mouse.x);
  const style = opponentStyle();

  if (grade === 'perfect') {
    state.perfects += 1;
    state.hits += 1;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    createFeatherExplosion(s.position, 16);
    // Counter: aim return by pointer zone
    const dirX = aimZone === 'left' ? -22 : aimZone === 'right' ? 22 : (state.rng() - 0.5) * 6;
    s.userData.velocity.set(dirX, 14, -Math.abs(s.userData.velocity.z) * 1.15 - 20);
    AudioSys.playHit('perfect');
    if (!PREFERS_REDUCED) {
      state.shake = 0.65;
      state.flash = 1;
      state.hitStop = HIT_STOP_PERFECT;
    }
    showToast(aimZone === 'center' ? '完美!' : `完美・${aimZone === 'left' ? '左' : '右'}路`, 'perfect');

    if (state.mode === 'scoreAttack') {
      state.score += scoreForContact('perfect', state.combo - 1, aimZone);
      state.clearedBalls += 1;
    } else if (state.mode === 'versus') {
      if (versusReturnWinsPoint('perfect', aimZone, style, state.rng)) {
        state.playerPoints += 1;
        state.rallyPressure = 0;
        state.waitingForNextSmash = true;
        showToast('得分!', 'perfect');
        if (state.playerPoints >= state.pointsToWin) {
          updateScoreHud();
          finishMatch();
          return;
        }
        setTimeout(() => {
          if (state.isRunning) {
            state.waitingForNextSmash = false;
            queueWindup();
          }
        }, 650);
      } else {
        state.rallyPressure = 0;
        state.waitingForNextSmash = true;
        showToast('對手接住!', 'good');
        setTimeout(() => {
          if (state.isRunning) {
            state.waitingForNextSmash = false;
            queueWindup();
          }
        }, 550);
      }
    }
  } else if (grade === 'good') {
    state.goods += 1;
    state.hits += 1;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    createFeatherExplosion(s.position, 10);
    const dirX = aimZone === 'left' ? -14 : aimZone === 'right' ? 14 : (state.rng() - 0.5) * 8;
    s.userData.velocity.set(dirX, 10, -Math.abs(s.userData.velocity.z) - 12);
    AudioSys.playHit('good');
    if (!PREFERS_REDUCED) {
      state.shake = 0.4;
      state.flash = 0.6;
      state.hitStop = HIT_STOP_GOOD;
    }
    showToast('擋下!', 'good');

    if (state.mode === 'scoreAttack') {
      state.score += scoreForContact('good', state.combo - 1, aimZone);
      state.clearedBalls += 1;
    } else if (state.mode === 'versus') {
      if (versusReturnWinsPoint('good', aimZone, style, state.rng)) {
        state.playerPoints += 1;
        state.rallyPressure = 0;
        state.waitingForNextSmash = true;
        if (state.playerPoints >= state.pointsToWin) {
          updateScoreHud();
          finishMatch();
          return;
        }
        setTimeout(() => {
          if (state.isRunning) {
            state.waitingForNextSmash = false;
            queueWindup();
          }
        }, 650);
      } else {
        state.rallyPressure += 1;
        state.waitingForNextSmash = true;
        setTimeout(() => {
          if (state.isRunning) {
            state.waitingForNextSmash = false;
            queueWindup();
          }
        }, 500);
      }
    }
  } else {
    // Soft block
    state.blocks += 1;
    state.combo = 0;
    createFeatherExplosion(s.position, 3);
    s.userData.velocity.set((state.rng() - 0.5) * 8, 5, 5);
    AudioSys.playHit('block');
    showToast('輕擋', 'good');
    if (state.mode === 'scoreAttack') {
      state.score += scoreForContact('block', 0, 'center');
      state.clearedBalls += 1;
    } else if (state.mode === 'versus') {
      state.rallyPressure += 1;
      if (state.rallyPressure >= 2) {
        state.cpuPoints += 1;
        state.rallyPressure = 0;
        showToast('被壓死!', 'bad');
        if (state.cpuPoints >= state.pointsToWin) {
          updateScoreHud();
          finishMatch();
          return;
        }
      }
      state.waitingForNextSmash = true;
      setTimeout(() => {
        if (state.isRunning) {
          state.waitingForNextSmash = false;
          queueWindup();
        }
      }, 480);
    }
  }

  updateScoreHud();
}

function setStatLabels(hitLabel, accLabel, bestLabel) {
  const boxes = document.querySelectorAll('#stats-grid .stat-box .stat-label');
  if (boxes[0]) boxes[0].textContent = hitLabel;
  if (boxes[2]) boxes[2].textContent = accLabel;
  const wide = document.querySelector('#stats-grid .stat-box.wide .stat-label');
  if (wide) wide.textContent = bestLabel;
}

function finishMatch() {
  state.isRunning = false;
  state.windup = null;
  resetOpponentPose();

  const stats = loadStats(storage());
  let grade;
  let isRecord = false;
  let summaryTitle = '訓練結束';

  if (state.mode === 'scoreAttack') {
    grade = gradeFromScore(state.score);
    isRecord = applyScoreAttackResult(stats, {
      difficulty: state.difficulty,
      score: state.score,
      perfects: state.perfects,
      maxCombo: state.maxCombo,
    });
    summaryTitle = grade.title;
    document.getElementById('final-hits').innerText = String(state.score);
    document.getElementById('final-misses').innerText = String(state.misses);
    document.getElementById('final-accuracy').innerText = `${state.perfects} 完美`;
    document.getElementById('final-combo').innerText = String(state.maxCombo);
    document.getElementById('final-best').innerText = String(
      stats.scoreAttackBest[state.difficulty] ?? state.score,
    );
    setStatLabels('得分', '完美次數', '此難度最佳得分');
  } else if (state.mode === 'versus') {
    const won = state.playerPoints >= state.pointsToWin;
    if (won) state.versusStreak += 1;
    else state.versusStreak = 0;
    applyVersusResult(stats, {
      opponentId: state.opponentId,
      won,
      perfects: state.perfects,
      maxCombo: state.maxCombo,
      streak: state.versusStreak,
    });
    grade = won
      ? { grade: 'S', title: '比賽勝利', cls: 'grade-s' }
      : { grade: 'D', title: '惜敗', cls: 'grade-d' };
    summaryTitle = grade.title;
    isRecord = won;
    document.getElementById('final-hits').innerText = `${state.playerPoints} - ${state.cpuPoints}`;
    document.getElementById('final-misses').innerText = String(state.misses);
    document.getElementById('final-accuracy').innerText = `${state.perfects}`;
    document.getElementById('final-combo').innerText = String(state.maxCombo);
    const wins = stats.versusWins[state.opponentId] ?? 0;
    document.getElementById('final-best').innerText = `${wins} 勝`;
    setStatLabels('比分', '完美次數', '對此對手勝場');
  } else {
    const acc = drillAccuracy({
      perfects: state.perfects,
      goods: state.goods,
      blocks: state.blocks,
      misses: state.misses,
      maxBalls: state.maxBalls,
    });
    state.hits = state.perfects + state.goods;
    grade = gradeFromAccuracy(acc);
    isRecord = applyDrillResult(stats, {
      difficulty: state.difficulty,
      balls: state.maxBalls,
      accuracy: acc,
      perfects: state.perfects,
      maxCombo: state.maxCombo,
    });
    summaryTitle = grade.title;
    document.getElementById('final-hits').innerText = `${state.perfects + state.goods} / ${state.maxBalls}`;
    document.getElementById('final-misses').innerText = String(state.misses);
    document.getElementById('final-accuracy').innerText = `${acc}%`;
    document.getElementById('final-combo').innerText = String(state.maxCombo);
    document.getElementById('final-best').innerText = `${stats.drillBestAcc[`${state.difficulty}:${state.maxBalls}`]}%`;
    setStatLabels('主動殺回', '成功率', '此設定最佳成功率');
  }

  saveStats(stats, storage());

  const gradeEl = document.getElementById('grade-banner');
  gradeEl.textContent = grade.grade;
  gradeEl.className = grade.cls;
  document.getElementById('result-title').textContent = summaryTitle;
  const recordEl = document.getElementById('new-record');
  if (recordEl) {
    recordEl.style.display = isRecord ? 'block' : 'none';
    recordEl.textContent = state.mode === 'versus' ? '挑戰成功！' : '新紀錄！';
  }

  document.getElementById('game-over').style.display = 'block';
  document.body.style.cursor = 'auto';

  try {
    parent.postMessage(
      {
        type: 'DRILL_OVER',
        payload: {
          mode: state.mode,
          hits: state.hits,
          misses: state.misses,
          perfects: state.perfects,
          score: state.score,
          accuracy:
            state.mode === 'drill'
              ? drillAccuracy({
                  perfects: state.perfects,
                  goods: state.goods,
                  blocks: state.blocks,
                  misses: state.misses,
                  maxBalls: state.maxBalls,
                })
              : 0,
          grade: grade.grade,
          opponentId: state.opponentId,
          playerPoints: state.playerPoints,
          cpuPoints: state.cpuPoints,
        },
      },
      '*',
    );
  } catch {
    /* opened directly */
  }
}

function replayDrill() {
  startMatch({
    mode: state.mode,
    balls: state.maxBalls,
    difficulty: state.difficulty,
    opponentId: state.opponentId,
  });
}

document.getElementById('restart-btn').addEventListener('click', replayDrill);
document.getElementById('menu-btn')?.addEventListener('click', () => {
  document.getElementById('game-over').style.display = 'none';
  try {
    parent.postMessage({ type: 'SHOW_MENU' }, '*');
  } catch {
    /* no parent */
  }
});

// --- MAIN LOOP ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  if (state.isPaused) return;

  const delta = clock.getDelta();
  const now = clock.getElapsedTime();

  // Hit-stop: freeze sim, keep rendering (juice).
  if (state.hitStop > 0) {
    state.hitStop -= delta;
    if (state.shake > 0 && !PREFERS_REDUCED) {
      camera.position.set(
        baseCamPos.x + (Math.random() - 0.5) * state.shake,
        baseCamPos.y + (Math.random() - 0.5) * state.shake,
        baseCamPos.z + (Math.random() - 0.5) * state.shake,
      );
      state.shake *= 0.85;
    }
    composer.render();
    return;
  }

  if (state.isRunning) {
    if (state.toastTimer > 0) {
      state.toastTimer -= delta;
      if (state.toastTimer <= 0) {
        document.getElementById('hit-toast')?.classList.remove('show');
      }
    }

    if (state.shake > 0 && !PREFERS_REDUCED) {
      camera.position.set(
        baseCamPos.x + (Math.random() - 0.5) * state.shake,
        baseCamPos.y + (Math.random() - 0.5) * state.shake,
        baseCamPos.z + (Math.random() - 0.5) * state.shake,
      );
      state.shake *= 0.85;
      if (state.shake < 0.05) {
        state.shake = 0;
        camera.position.copy(baseCamPos);
      }
    }

    if (state.flash > 0) {
      bloomPass.strength = 0.6 + state.flash * 2;
      state.flash *= 0.8;
      if (state.flash < 0.05) {
        state.flash = 0;
        bloomPass.strength = 0.6;
      }
    }

    updateWindupVisual(delta);

    if (
      state.mode === 'drill' &&
      state.spawnedBalls >= state.maxBalls &&
      shuttlePool.active.length === 0 &&
      !state.windup
    ) {
      finishMatch();
    }

    const rangeX = 14;
    const rangeY = 6;
    const centerX = state.handedness === 'right' ? 4 : -4;
    const targetX = centerX + state.mouse.x * rangeX;
    const targetY = -2 + state.mouse.y * rangeY;
    playerGroup.position.x += (targetX - playerGroup.position.x) * 0.25;
    playerGroup.position.y += (targetY - playerGroup.position.y) * 0.25;
    playerGroup.rotation.z = (playerGroup.position.x - targetX) * 0.05;

    if (state.swinging) {
      state.swingTime += delta;
      const progress = state.swingTime / state.swingDuration;
      if (progress < 1) {
        const snap = Math.sin(progress * Math.PI);
        wristPivot.rotation.x = -snap * 0.8;
        playerGroup.position.z = 4 - snap * 2.5;
      } else {
        state.swinging = false;
        wristPivot.rotation.x = 0;
        playerGroup.position.z = 4;
      }
    } else {
      wristPivot.rotation.x = Math.sin(now * 4) * 0.05;
    }

    // Spawn pacing (drill / score-attack). Versus uses point callbacks.
    if (state.mode !== 'versus' && !state.windup) {
      const cfg = diffCfg();
      const style = opponentStyle();
      const tier = phaseTier();
      const baseDelay = (0.95 - tier * 0.18) * cfg.spawnMul * (style?.spawnMul ?? 1);
      const spawnDelay = Math.max(0.35, baseDelay);
      const canSpawn =
        state.mode === 'scoreAttack' || state.spawnedBalls < state.maxBalls;
      if (canSpawn && now - state.lastSpawnTime > spawnDelay && shuttlePool.active.length < 2) {
        queueWindup();
        state.lastSpawnTime = now;
      }
    }

    const sweetSpot = new THREE.Vector3();
    strings.getWorldPosition(sweetSpot);

    for (let i = shuttlePool.active.length - 1; i >= 0; i--) {
      const s = shuttlePool.active[i];

      if (!s.userData.returning) {
        const speed = s.userData.velocity.length();
        if (speed > 0) {
          const drag = CONFIG.dragFactor * speed * speed * delta;
          const newSpeed = Math.max(0, speed - drag);
          s.userData.velocity.multiplyScalar(newSpeed / speed);
        }
        // Drop smash extra gravity while approaching
        if (s.userData.dropRate > 0 && s.position.z < IMPACT_Z) {
          s.userData.velocity.y -= s.userData.dropRate * 120 * delta;
        }
      }

      s.position.addScaledVector(s.userData.velocity, delta);

      if (s.userData.shadow) {
        s.userData.shadow.position.x = s.position.x;
        s.userData.shadow.position.z = s.position.z;
        const h = Math.max(0, s.position.y + 5);
        s.userData.shadow.scale.setScalar(Math.max(0.2, 1 - h * 0.05));
        s.userData.shadow.visible = s.position.z > -40;
      }

      if (s.userData.trail && s.visible) {
        const hist = s.userData.history;
        hist.unshift(s.position.clone());
        if (hist.length > 5) hist.pop();
        const positions = s.userData.trail.geometry.attributes.position.array;
        for (let k = 0; k < hist.length; k++) {
          positions[k * 3] = hist[k].x;
          positions[k * 3 + 1] = hist[k].y;
          positions[k * 3 + 2] = hist[k].z;
        }
        const last = hist[hist.length - 1];
        for (let k = hist.length; k < 5; k++) {
          positions[k * 3] = last.x;
          positions[k * 3 + 1] = last.y;
          positions[k * 3 + 2] = last.z;
        }
        s.userData.trail.geometry.attributes.position.needsUpdate = true;
      }

      if (s.userData.velocity.lengthSq() > 0.1) {
        const target = s.position.clone().add(s.userData.velocity);
        const m = new THREE.Matrix4();
        m.lookAt(target, s.position, new THREE.Vector3(0, 1, 0));
        s.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), 0.15);
      }

      if (!s.userData.returning && s.position.z > -10 && s.position.z < 10) {
        const dist = s.position.distanceTo(sweetSpot);
        const posGrade = gradePosition(dist);
        if (posGrade !== 'out') {
          const tier = phaseTier();
          const windows = getTimingWindowsMs(tier, state.combo);
          const timing = state.swinging
            ? gradeTiming(state.swingTime, state.swingDuration, state.swingEtaAtStart, windows)
            : 'late';
          const grade = combineContact({
            swinging: state.swinging,
            timing,
            position: posGrade,
          });
          if (grade !== 'miss') {
            applyContactResult(s, grade);
          }
        }
      }

      if (s.userData.returning) {
        if (s.position.z < -150 || s.position.y > 50 || s.position.y < -10) {
          shuttlePool.release(s);
          if (s.userData.trail) s.userData.trail.visible = false;
          if (s.userData.shadow) s.userData.shadow.visible = false;
        }
        const gravity = s.userData.velocity.z > 0 && s.userData.velocity.z < 10 ? 40 : 20;
        s.userData.velocity.y -= gravity * delta;
        continue;
      }

      if (s.position.z > 20) {
        registerMiss(s);
        shuttlePool.release(s);
        if (s.userData.trail) s.userData.trail.visible = false;
        if (s.userData.shadow) s.userData.shadow.visible = false;
      }
    }

    for (let i = particlePool.active.length - 1; i >= 0; i--) {
      const p = particlePool.active[i];
      p.userData.life -= delta;
      if (p.userData.life <= 0) {
        particlePool.release(p);
      } else {
        p.position.addScaledVector(p.userData.velocity, delta);
        p.userData.velocity.y -= 10 * delta;
        p.scale.setScalar(p.userData.life);
        p.rotation.z += 5 * delta;
      }
    }
  }

  composer.render();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

updateRacketOrientation();
animate();

try {
  parent.postMessage({ type: 'GAME_READY' }, '*');
} catch {
  /* no parent */
}

// Expose opponents list length for sanity (unused in prod, helps debugging).
void OPPONENTS;
