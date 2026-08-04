/**
 * Block the Smash — the Three.js drill that runs inside the iframe.
 *
 * This used to be an inline <script type="module"> in a static HTML file with
 * an importmap pointing at unpkg, so the whole game needed the network to
 * start and rendered a black void without it. It is a real module now, and
 * three resolves from node_modules and gets bundled with everything else.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- GAME CONFIGURATION ---
const DISPLAY_SPEED_MIN = 280;
const DISPLAY_SPEED_MAX = 550;

const DIFFICULTY = {
    easy: {
        id: 'easy',
        speedMul: 0.78,
        spawnMul: 1.2,
        aimSpread: 8,
        tierBoost: [0, 50, 100],
        doubleChance: 0,
    },
    normal: {
        id: 'normal',
        speedMul: 1,
        spawnMul: 1,
        aimSpread: 12,
        tierBoost: [0, 80, 150],
        doubleChance: 0.08,
    },
    hard: {
        id: 'hard',
        speedMul: 1.22,
        spawnMul: 0.78,
        aimSpread: 18,
        tierBoost: [40, 120, 200],
        doubleChance: 0.18,
    },
};

const PHASES = [
    { id: 'warm', label: '熱身', until: 0.33 },
    { id: 'pressure', label: '加壓', until: 0.66 },
    { id: 'chaos', label: '混戰', until: 1.01 },
];

const CONFIG = {
    baseSpeed: 400,
    dragFactor: 0.008,
    racketBoundX: 18,
    racketBoundY: 10,
    colors: {
        court: 0x1a472a,
        lines: 0xaaaaaa,
        racketFrame: 0x3366cc,
        racketString: 0xeeeeee,
        shuttle: 0xffffff,
        trail: 0x00ffff
    }
};

// --- AUDIO SYNTHESIS ENGINE ---
const AudioSys = {
    ctx: null,
    muted: false,

    init: function() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // "Swoosh" for racket swing
    playSwoosh: function() {
        if(this.muted || !this.ctx) return;
        const t = this.ctx.currentTime;

        // Noise buffer creation (Pink Noise approx)
        const bufferSize = this.ctx.sampleRate * 0.2; // 0.2s duration
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5; // Compensate for gain
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

    // "Smash" or "Block" hit sound
    playHit: function(type) {
        if(this.muted || !this.ctx) return;
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        if (type === 'smash') {
            // High Pitch, Fast decay
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
            gain.gain.setValueAtTime(0.8, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        } else {
            // Dull Thud
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
            gain.gain.setValueAtTime(0.5, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        }

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(t + 0.2);
    },

    playMiss: function() {
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
    }
};

let lastOut = 0; // for pink noise generation

// --- STATE ---
let state = {
    hits: 0,
    misses: 0,
    blocks: 0,
    combo: 0,
    maxCombo: 0,
    maxBalls: 25,
    spawnedBalls: 0,
    difficulty: 'normal',
    phaseIndex: 0,
    isRunning: false,
    isPaused: false,
    isInCountdown: false,
    mouse: { x: 0, y: 0 },
    swinging: false,
    swingTime: 0,
    swingDuration: 0.15,
    handedness: 'right',
    lastSpawnTime: 0,
    shake: 0,
    flash: 0,
    muted: false,
    toastTimer: 0,
};

window.addEventListener('message', (e) => {
     if (e.data && e.data.type === 'PAUSE_GAME') {
         state.isPaused = e.data.payload;
         if (!state.isPaused && !state.isInCountdown && state.isRunning) {
            clock.getDelta();
            AudioSys.init();
         }
     }
     if (e.data && e.data.type === 'SET_HANDEDNESS') {
         state.handedness = e.data.payload;
         updateRacketOrientation();
     }
     if (e.data && e.data.type === 'SET_MUTE') {
         state.muted = e.data.payload;
         AudioSys.muted = state.muted;
     }
     if (e.data && e.data.type === 'START_MATCH') {
         const payload = e.data.payload;
         if (payload && typeof payload === 'object') {
             startMatch(payload.balls ?? 25, payload.difficulty ?? 'normal');
         } else {
             startMatch(payload, 'normal');
         }
     }
});

// --- SETUP SCENE ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.court);
scene.fog = new THREE.Fog(CONFIG.colors.court, 30, 120);

// Camera setup for "Defensive Crouch" stance 
// Lower Y (1.0) simulates defensive crouch eye level
const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 200);
const baseCamPos = new THREE.Vector3(0, 1.0, 14); 
camera.position.copy(baseCamPos);
camera.rotation.order = 'YXZ';
camera.rotation.x = -10 * Math.PI / 180; // Less pitch down as we are lower
camera.rotation.y = 0;

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// --- POST PROCESSING ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.5;
bloomPass.strength = 0.6;
bloomPass.radius = 0.2;

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- ASSETS ---
const gridHelper = new THREE.GridHelper(200, 20, CONFIG.colors.lines, 0x225533);
gridHelper.position.y = -5; // Floor level
scene.add(gridHelper);

const netGeo = new THREE.BoxGeometry(60, 5, 0.1);
const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, wireframe: true });
const net = new THREE.Mesh(netGeo, netMat);
net.position.set(0, -1, -40); // Base of net
// Add Top Tape
const tapeGeo = new THREE.BoxGeometry(60, 0.2, 0.15);
const tapeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const tape = new THREE.Mesh(tapeGeo, tapeMat);
tape.position.y = 2.5; // Top of net mesh
net.add(tape);
scene.add(net);

// --- PLAYER RACKET STRUCTURE ---
// 1. PlayerGroup (The Hand/Grip Position)
const playerGroup = new THREE.Group();
// Lower default position to match lower camera/crouch
playerGroup.position.set(2, -2.5, 4); 
scene.add(playerGroup);

// 2. WristPivot (Rotates for swings)
const wristPivot = new THREE.Group();
playerGroup.add(wristPivot);

// 3. RacketVisuals (Offset so Handle Bottom is at Pivot)
const racketVisuals = new THREE.Group();
// Shift Visuals UP so the Grip (bottom of handle) aligns with Pivot (0,0,0)
// Handle length ~3. Head center is ~5 units from bottom.
racketVisuals.position.y = 5.0; 

// Horizontal Orientation Setup:
// Rotate the Visuals group so the racket points sideways
// Z-Rotation: -90 deg -> Points Right (from camera view)
racketVisuals.rotation.z = -Math.PI / 2;
wristPivot.add(racketVisuals);

function updateRacketOrientation() {
     // Reset visual rotation
     racketVisuals.rotation.set(0,0,0);

     if (state.handedness === 'left') {
         // Left Hand: Hand on Left (-X), Racket Points Right (Towards Center)
         // Racket "Up" is +Y. Rotate Z -90 deg -> +X (Right)
         racketVisuals.rotation.z = -Math.PI / 2;
     } else {
         // Right Hand: Hand on Right (+X), Racket Points Left (Towards Center)
         // Rotate Z +90 deg -> -X (Left)
         racketVisuals.rotation.z = Math.PI / 2;
     }
}

// --- RACKET GEOMETRY ---
// Frame
const frameGeo = new THREE.TorusGeometry(2, 0.15, 8, 32);
const frameMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.racketFrame, roughness: 0.4 });
const frame = new THREE.Mesh(frameGeo, frameMat);
frame.scale.set(1, 1.3, 1);
racketVisuals.add(frame); // Head Center at 0,0,0 of Visuals (which is +5 from Pivot)

// Strings (Generate Grid Texture)
function createStringTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Clear
    ctx.clearRect(0, 0, 512, 512);

    // Grid Lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;

    const step = 32;
    for(let i=0; i<=512; i+=step) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 512);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i); ctx.lineTo(512, i);
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

// Use CircleGeometry to fill the Torus hole properly
const stringGeo = new THREE.CircleGeometry(1.9, 32); 
const stringMat = new THREE.MeshBasicMaterial({ 
    map: createStringTexture(), 
    color: CONFIG.colors.racketString, 
    transparent: true, 
    opacity: 0.7, // Visible but see-through
    side: THREE.DoubleSide
});
const strings = new THREE.Mesh(stringGeo, stringMat);
strings.scale.set(1, 1.3, 1); // Match frame elongation
racketVisuals.add(strings);

// Shaft/Neck
const neckGeo = new THREE.CylinderGeometry(0.15, 0.15, 1);
const neck = new THREE.Mesh(neckGeo, frameMat);
neck.position.y = -2; // Below head
racketVisuals.add(neck);

// Handle
const handleGeo = new THREE.CylinderGeometry(0.15, 0.15, 3.5);
const handleMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const handle = new THREE.Mesh(handleGeo, handleMat);
// Head at 0. Neck ends at -2.5. Handle starts around there.
handle.position.y = -4.25;
racketVisuals.add(handle);

// Lights
const light = new THREE.PointLight(0xffffff, 2, 20);
light.position.set(5, 5, 5);
playerGroup.add(light);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(0, 10, 0);
scene.add(dirLight);

// --- OBJECT POOLING ---
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
        [...this.active].forEach(obj => this.release(obj));
    }
}

// Shuttlecock Pool
const shuttlePool = new Pool(() => {
    const group = new THREE.Group();

    // Cork
    const corkGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const corkMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.shuttle, roughness: 0.6 });
    const cork = new THREE.Mesh(corkGeo, corkMat);
    group.add(cork);

    // Skirt (Cone)
    const skirtGeo = new THREE.ConeGeometry(0.5, 0.7, 16, 1, true);
    const skirtMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0.8 
    });
    const skirt = new THREE.Mesh(skirtGeo, skirtMat);
    skirt.position.y = 0.35;
    group.add(skirt);

    // Trail Line (for Motion Blur effect)
    // We use a Line loop that we'll update every frame
    const trailPoints = [];
    for(let i=0; i<5; i++) trailPoints.push(new THREE.Vector3(0,0,0));
    const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPoints);
    const trailMat = new THREE.LineBasicMaterial({ color: CONFIG.colors.trail, transparent: true, opacity: 0.5 });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(trail); // Add separately so it doesn't rotate with shuttle
    trail.visible = false;

    // Shadow (Drop Shadow on Floor)
    const shadowGeo = new THREE.CircleGeometry(0.8, 16);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -4.95; // Just above floor
    scene.add(shadow);
    shadow.visible = false;

    // Rotate so cork faces forward/motion usually
    group.rotation.x = -Math.PI / 2;

    group.userData = { 
        velocity: new THREE.Vector3(), 
        rotSpeed: 0, 
        returning: false,
        trail: trail,
        shadow: shadow,
        history: [] 
    };
    return group;
}, 30);

// Feather Particle Pool
const particlePool = new Pool(() => {
    const geo = new THREE.PlaneGeometry(0.3, 0.1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { velocity: new THREE.Vector3(), life: 0 };
    return mesh;
}, 150);


// --- INPUT HANDLING ---
// Pointer events cover mouse + touch; phones never get mousemove alone.

function updatePointer(clientX, clientY) {
    state.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    state.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
}

function trySwing() {
    AudioSys.init(); // Ensure audio context is ready

    if (!state.swinging && state.isRunning && !state.isPaused) {
        state.swinging = true;
        state.swingTime = 0;
        AudioSys.playSwoosh();
    }
}

window.addEventListener('pointermove', (e) => {
    updatePointer(e.clientX, e.clientY);
});

window.addEventListener('pointerdown', (e) => {
    // Keep the page from scrolling while dragging the racket on touch devices.
    if (e.pointerType === 'touch') e.preventDefault();
    updatePointer(e.clientX, e.clientY);
    trySwing();
}, { passive: false });

// Keep mouse fallbacks for older browsers that never fire pointer events.
window.addEventListener('mousemove', (e) => {
    updatePointer(e.clientX, e.clientY);
});

window.addEventListener('mousedown', () => {
    trySwing();
});

// --- GAME FUNCTIONS ---

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
            // Reset animation
            el.style.animation = 'none';
            el.offsetHeight; /* trigger reflow */
            el.style.animation = null; 
        } else {
            clearInterval(interval);
            el.innerText = "SMASH!";
            setTimeout(() => {
                el.style.opacity = 0;
                state.isInCountdown = false;
                callback();
            }, 600);
        }
    }, 800);
}

function diffCfg() {
    return DIFFICULTY[state.difficulty] || DIFFICULTY.normal;
}

function phaseProgress() {
    return state.maxBalls > 0 ? state.spawnedBalls / state.maxBalls : 0;
}

function phaseTier() {
    const p = phaseProgress();
    if (p < 0.33) return 0;
    if (p < 0.66) return 1;
    return 2;
}

function updatePhaseBanner() {
    const tier = phaseTier();
    if (tier !== state.phaseIndex) {
        state.phaseIndex = tier;
        showToast(PHASES[tier].label, 'good');
    }
    const el = document.getElementById('phase-banner');
    if (el) el.textContent = PHASES[tier].label;
}

function showToast(text, kind) {
    const el = document.getElementById('hit-toast');
    if (!el) return;
    el.textContent = text;
    el.className = kind === 'bad' ? 'bad show' : 'good show';
    state.toastTimer = 0.55;
}

function updateComboHud() {
    const el = document.getElementById('combo-hud');
    const val = document.getElementById('combo-val');
    if (!el || !val) return;
    val.textContent = String(state.combo);
    el.classList.toggle('active', state.combo >= 2);
}

function startMatch(ballCount, difficulty = 'normal') {
    state.maxBalls = ballCount;
    state.difficulty = DIFFICULTY[difficulty] ? difficulty : 'normal';
    state.spawnedBalls = 0;
    state.hits = 0;
    state.misses = 0;
    state.blocks = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.phaseIndex = 0;
    state.isRunning = false;
    state.swinging = false;

    document.getElementById('score-val').innerText = '0';
    document.getElementById('max-val').innerText = state.maxBalls;
    document.getElementById('miss-val').innerText = '0';
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('speed-val').innerText = '0';
    updatePhaseBanner();
    updateComboHud();
    document.body.style.cursor = 'none';

    shuttlePool.reset();
    shuttlePool.pool.forEach(s => {
        if(s.userData.trail) s.userData.trail.visible = false;
        if(s.userData.shadow) s.userData.shadow.visible = false;
    });

    particlePool.reset();
    AudioSys.init();

    runCountdown(() => {
        state.isRunning = true;
        state.lastSpawnTime = clock.getElapsedTime();
    });
}

function spawnShuttle() {
    if (state.spawnedBalls >= state.maxBalls) return;

    const s = shuttlePool.get();
    if (!s) return;

    state.spawnedBalls++;
    updatePhaseBanner();

    const cfg = diffCfg();
    const tier = phaseTier();
    const originZ = -90 - (Math.random() * 30);
    const originY = 18 + (Math.random() * 6);
    const originX = (Math.random() - 0.5) * 40;

    s.position.set(originX, originY, originZ);

    const playerX = (state.handedness === 'right') ? 4 : -4;
    const spread = cfg.aimSpread + tier * 3;
    const targetX = playerX + (Math.random() - 0.5) * spread;
    const targetY = -2.5 + (Math.random() * 2);
    const targetZ = 5;

    const dir = new THREE.Vector3(targetX - originX, targetY - originY, targetZ - originZ).normalize();

    const progress = phaseProgress();
    const initialSpeed =
        CONFIG.baseSpeed * cfg.speedMul
        + cfg.tierBoost[tier]
        + progress * 90;

    s.userData.velocity.copy(dir).multiplyScalar(initialSpeed);
    s.userData.rotSpeed = Math.random() * 10;
    s.userData.returning = false;
    s.userData.scored = false;
    s.userData.history = [];

    if(s.userData.trail) s.userData.trail.visible = true;
    if(s.userData.shadow) s.userData.shadow.visible = true;

    s.rotation.set(-Math.PI/2, 0, 0);

    const ramp = Math.min(1, (tier / 2) * 0.55 + progress * 0.45);
    const kmh = Math.round(DISPLAY_SPEED_MIN + (DISPLAY_SPEED_MAX - DISPLAY_SPEED_MIN) * ramp);
    document.getElementById('speed-val').innerText = kmh;

    const speedDisplay = document.getElementById('speed-display');
    speedDisplay.style.transform = 'scale(1.3)';
    setTimeout(() => {
        speedDisplay.style.transform = 'scale(1)';
    }, 100);

    // Hard chaos: occasional second shuttle for pressure.
    if (
        tier === 2
        && cfg.doubleChance > 0
        && Math.random() < cfg.doubleChance
        && state.spawnedBalls < state.maxBalls
    ) {
        setTimeout(() => {
            if (state.isRunning) spawnShuttle();
        }, 180);
    }
}

function createFeatherExplosion(pos, count = 8) {
    for (let i = 0; i < count; i++) {
        const p = particlePool.get();
        if (p) {
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
}

function registerMiss(s) {
    if (s.userData.scored) return;
    s.userData.scored = true;
    state.misses += 1;
    state.combo = 0;
    updateComboHud();
    document.getElementById('miss-val').innerText = String(state.misses);
    AudioSys.playMiss();
    showToast('漏接!', 'bad');
    state.shake = Math.max(state.shake, 0.35);
}

function updateScore(points) {
    state.hits += points;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    document.getElementById('score-val').innerText = state.hits;
    updateComboHud();
    if (state.combo >= 3) showToast(`連擋 x${state.combo}`, 'good');
    else showToast('擋下!', 'good');
}

function gradeFromAccuracy(acc) {
    if (acc >= 92) return { grade: 'S', title: '完美防守', cls: 'grade-s' };
    if (acc >= 80) return { grade: 'A', title: '穩如鐵牆', cls: 'grade-a' };
    if (acc >= 65) return { grade: 'B', title: '防守合格', cls: 'grade-b' };
    if (acc >= 45) return { grade: 'C', title: '還差一口氣', cls: 'grade-c' };
    return { grade: 'D', title: '再練一場', cls: 'grade-d' };
}

/** Personal best accuracy, kept per drill length + difficulty. */
const BEST_KEY = 'clubhouse:block-the-smash-best-v2';

function readBest() {
    try {
        const parsed = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function finishMatch() {
    state.isRunning = false;

    const denom = Math.max(1, state.maxBalls);
    // Success rate: active smash returns over balls in the drill.
    const acc = Math.round((state.hits / denom) * 100);
    const grade = gradeFromAccuracy(acc);

    document.getElementById('final-hits').innerText = `${state.hits} / ${state.maxBalls}`;
    document.getElementById('final-misses').innerText = String(state.misses);
    document.getElementById('final-accuracy').innerText = acc + '%';
    document.getElementById('final-combo').innerText = String(state.maxCombo);

    const gradeEl = document.getElementById('grade-banner');
    gradeEl.textContent = grade.grade;
    gradeEl.className = grade.cls;
    document.getElementById('result-title').textContent = grade.title;

    const best = readBest();
    const key = `${state.difficulty}:${state.maxBalls}`;
    const previous = typeof best[key] === 'number' ? best[key] : null;
    let isRecord = false;
    if (previous === null || acc > previous) {
        best[key] = acc;
        isRecord = previous !== null ? acc > previous : acc > 0;
        try {
            localStorage.setItem(BEST_KEY, JSON.stringify(best));
        } catch {
            /* ignore */
        }
    }
    const shown = previous === null ? acc : Math.max(previous, acc);
    document.getElementById('final-best').innerText = shown + '%';
    const recordEl = document.getElementById('new-record');
    if (recordEl) recordEl.style.display = isRecord && acc > (previous ?? -1) ? 'block' : 'none';

    document.getElementById('game-over').style.display = 'block';
    document.body.style.cursor = 'auto';

    try {
        parent.postMessage({
            type: 'DRILL_OVER',
            payload: { hits: state.hits, misses: state.misses, accuracy: acc, grade: grade.grade },
        }, '*');
    } catch {
        /* opened directly */
    }
}

function replayDrill() {
    startMatch(state.maxBalls, state.difficulty);
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

    if (state.isRunning) {
        if (state.toastTimer > 0) {
            state.toastTimer -= delta;
            if (state.toastTimer <= 0) {
                const toast = document.getElementById('hit-toast');
                if (toast) toast.classList.remove('show');
            }
        }

        // JUICE: Camera Shake
        if (state.shake > 0) {
            camera.position.set(
                baseCamPos.x + (Math.random() - 0.5) * state.shake,
                baseCamPos.y + (Math.random() - 0.5) * state.shake,
                baseCamPos.z + (Math.random() - 0.5) * state.shake
            );
            state.shake *= 0.85; // Decay
            if (state.shake < 0.05) { 
                state.shake = 0;
                camera.position.copy(baseCamPos);
            }
        }

        // JUICE: Impact Flash
        if (state.flash > 0) {
            bloomPass.strength = 0.6 + state.flash * 2;
            state.flash *= 0.8;
            if (state.flash < 0.05) {
                state.flash = 0;
                bloomPass.strength = 0.6;
            }
        }

        if (state.spawnedBalls >= state.maxBalls && shuttlePool.active.length === 0) {
            finishMatch();
        }

        // Player Movement (Hand)
        const rangeX = 14;
        const rangeY = 6;
        const centerX = (state.handedness === 'right') ? 4 : -4;

        const targetX = centerX + (state.mouse.x * rangeX);
        const targetY = -2 + (state.mouse.y * rangeY); 

        playerGroup.position.x += (targetX - playerGroup.position.x) * 0.25;
        playerGroup.position.y += (targetY - playerGroup.position.y) * 0.25;

        // Tilt Hand slightly with movement
        playerGroup.rotation.z = (playerGroup.position.x - targetX) * 0.05;

        // WRIST SWING ANIMATION
        if (state.swinging) {
            state.swingTime += delta;
            const progress = state.swingTime / state.swingDuration;

            if (progress < 1) {
                 const t = progress;
                 // Wrist Snap: Rotate Pivot on X axis
                 const snap = Math.sin(t * Math.PI);

                 // Wrist Rotation (Forward Snap)
                 wristPivot.rotation.x = -snap * 0.8; 

                 // Slight forward push of arm
                 playerGroup.position.z = 4 - (snap * 2.5);
            } else {
                state.swinging = false;
                wristPivot.rotation.x = 0;
                playerGroup.position.z = 4;
            }
        } else {
            // Ready Breathing
            wristPivot.rotation.x = Math.sin(now * 4) * 0.05;
        }

        // Spawn paced by phase + difficulty (not only hit count).
        const cfg = diffCfg();
        const tier = phaseTier();
        const baseDelay = (0.95 - tier * 0.18) * cfg.spawnMul;
        const spawnDelay = Math.max(0.32, baseDelay);
        if (now - state.lastSpawnTime > spawnDelay) {
            spawnShuttle();
            state.lastSpawnTime = now;
        }

        // Update Shuttles & Collisions
        const sweetSpot = new THREE.Vector3();
        strings.getWorldPosition(sweetSpot);
        const hitRadius = 4.0; // WIDER HITBOX: Increased from 3.5 to 4.0 to compensate for high speed

        for (let i = shuttlePool.active.length - 1; i >= 0; i--) {
            const s = shuttlePool.active[i];

            // --- PHYSICS: DRAG SIMULATION ---
            if (!s.userData.returning) {
                const speed = s.userData.velocity.length();
                // Drag equation: Fd = -c * v^2. 
                // Simplified: speed -= speed * speed * factor * delta
                if (speed > 0) {
                    const drag = CONFIG.dragFactor * speed * speed * delta;
                    const newSpeed = Math.max(0, speed - drag);
                    s.userData.velocity.multiplyScalar(newSpeed / speed);
                }
            }

            s.position.addScaledVector(s.userData.velocity, delta);

            // UPDATE SHADOW
            if(s.userData.shadow) {
                s.userData.shadow.position.x = s.position.x;
                s.userData.shadow.position.z = s.position.z;
                // Scale shadow based on height (smaller when higher)
                const h = Math.max(0, s.position.y + 5);
                const scale = Math.max(0.2, 1 - (h * 0.05));
                s.userData.shadow.scale.setScalar(scale);

                // Hide shadow if behind net or too far
                s.userData.shadow.visible = (s.position.z > -40);
            }

            // UPDATE TRAIL
            if(s.userData.trail && s.visible) {
                 const hist = s.userData.history;
                 hist.unshift(s.position.clone());
                 if(hist.length > 5) hist.pop();

                 const positions = s.userData.trail.geometry.attributes.position.array;
                 for(let k=0; k<hist.length; k++) {
                     positions[k*3] = hist[k].x;
                     positions[k*3+1] = hist[k].y;
                     positions[k*3+2] = hist[k].z;
                 }
                 // Fill rest with last point to prevent trails jumping to 0,0,0
                 const last = hist[hist.length-1];
                 for(let k=hist.length; k<5; k++) {
                      positions[k*3] = last.x;
                      positions[k*3+1] = last.y;
                      positions[k*3+2] = last.z;
                 }
                 s.userData.trail.geometry.attributes.position.needsUpdate = true;
            }

            if (s.userData.velocity.lengthSq() > 0.1) {
                 const target = s.position.clone().add(s.userData.velocity);
                 const m = new THREE.Matrix4();
                 m.lookAt(target, s.position, new THREE.Vector3(0,1,0));
                 s.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), 0.15);
            }

            // Collision Logic
            if (!s.userData.returning && s.position.z > -10 && s.position.z < 10) {
                 if (s.position.distanceTo(sweetSpot) < hitRadius) {

                      s.userData.returning = true;
                      s.userData.scored = true;

                      if (state.swinging) {
                           createFeatherExplosion(s.position, 12);
                           s.userData.velocity.z = -Math.abs(s.userData.velocity.z) * 1.0 - 15;
                           s.userData.velocity.y = Math.abs(s.userData.velocity.y) + 12;
                           s.userData.velocity.x += (Math.random() - 0.5) * 10;

                           AudioSys.playHit('smash');
                           state.shake = 0.5;
                           state.flash = 0.8;

                           updateScore(1);
                      } else {
                           // Passive block — save, but breaks smash combo.
                           createFeatherExplosion(s.position, 3);
                           s.userData.velocity.set(
                               (Math.random() - 0.5) * 8,
                               5,
                               5
                           );
                           state.blocks += 1;
                           state.combo = 0;
                           updateComboHud();
                           AudioSys.playHit('block');
                           showToast('輕擋', 'good');
                      }
                 }
            }

            if (s.userData.returning) {
                 if (s.position.z < -150 || s.position.y > 50 || s.position.y < -10) {
                     shuttlePool.release(s);
                     if(s.userData.trail) s.userData.trail.visible = false;
                     if(s.userData.shadow) s.userData.shadow.visible = false;
                 }
                 const gravity = (s.userData.velocity.z > 0 && s.userData.velocity.z < 10) ? 40 : 20;
                 s.userData.velocity.y -= gravity * delta;
                 continue;
            }

            if (s.position.z > 20) {
                registerMiss(s);
                shuttlePool.release(s);
                if(s.userData.trail) s.userData.trail.visible = false;
                if(s.userData.shadow) s.userData.shadow.visible = false;
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

// Tell the wrapper the renderer is live. It used to wait on the iframe's load
// event, which a slow webfont could stall indefinitely — leaving the player
// staring at "Initializing System..." over a drill that was already running.
try {
  parent.postMessage({ type: 'GAME_READY' }, '*');
} catch {
  /* no parent (opened directly) — nothing to notify */
}
