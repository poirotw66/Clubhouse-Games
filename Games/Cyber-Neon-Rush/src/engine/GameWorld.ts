import * as THREE from 'three';
import { haptic } from '@clubhouse/shared/juice';
import {
  BASE_SPEED,
  BOOST_DURATION,
  BOOST_SPEED,
  CAMERA_BACK,
  CAMERA_FOLLOW,
  CAMERA_HEIGHT,
  CAMERA_LOOK_AHEAD,
  CAMERA_LOOK_Y,
  CAMERA_ROLL_GAIN,
  CAMERA_SWAY_GAIN,
  DASH_DURATION,
  DASH_IFRAME,
  DASH_SPEED_BONUS,
  JUMP_DURATION,
  JUMP_HEIGHT,
  MAX_SPEED,
  MULTIPLIER_POWER,
  NEAR_MISS_SPEED_BONUS,
  NEAR_MISS_SPEED_DECAY,
  NEAR_MISS_WINDOW,
  OBSTACLE_DESPAWN_BEHIND,
  OBSTACLE_MAX_GAP,
  OBSTACLE_MIN_GAP,
  EARLY_SAFE_Z,
  FIRST_OBSTACLE_Z,
  OBSTACLE_SPAWN_AHEAD,
  PERFECT_MISS_WINDOW,
  POWERUP_DURATION_BASE,
  RUSH_TUNING,
  SHIELD_FLASH_SEC,
  SLOWMO_SCALE,
  SPEED_RAMP_PER_METER,
  TRACK_AHEAD,
  TRACK_BEHIND,
  TRACK_SEGMENT_LENGTH,
  clampLane,
  laneToX,
  type RushDifficulty,
} from './constants';
import { createLaneBody, laneBodyRoll, stepLaneBody, type LaneBody } from './lanePhysics';
import {
  createBoostRing,
  createCarMesh,
  createCityBlocks,
  createObstacleMesh,
  createPowerupMesh,
  createRoadChunk,
  createTrailSpark,
  type ObstacleKind,
  type PowerupKind,
} from './meshes';
import { collisionProfile, pickObstacleKind } from './obstacleProfile';
import {
  creditsFromRun,
  dashCooldownSec,
  magnetRange,
  powerDurationMul,
  type CosmeticId,
  type UpgradeLevels,
} from './progress';
import {
  addDistanceScore,
  breakCombo,
  createScoreState,
  finalizeRun,
  isFever,
  registerBoostPickup,
  registerDash,
  registerNearMiss,
  registerPowerupPickup,
  tickScoreTimers,
  toHud,
  type HudSnapshot,
  type RunResult,
} from './scoreSystem';
import { trackCurvature, trackHeading, trackOffset, trackSlope } from './trackPath';

export type GamePhase = 'running' | 'paused' | 'over';

export interface RunConfig {
  difficulty: RushDifficulty;
  upgrades: UpgradeLevels;
  cosmeticId: CosmeticId;
}

interface Obstacle {
  mesh: THREE.Group;
  z: number;
  lane: number;
  kind: ObstacleKind;
  scored: boolean;
  alive: boolean;
}

type PickupKind = 'boost' | PowerupKind;

interface Pickup {
  mesh: THREE.Group;
  z: number;
  lane: number;
  kind: PickupKind;
  alive: boolean;
}

interface TrailBit {
  mesh: THREE.Mesh;
  life: number;
}

export interface GameWorld {
  mount(el: HTMLElement): void;
  unmount(): void;
  start(): void;
  setPaused(paused: boolean): void;
  nudgeLane(dir: -1 | 1): void;
  jump(): void;
  dash(): void;
  getHud(): HudSnapshot;
  getPhase(): GamePhase;
  getResult(): RunResult | null;
  onHud(cb: (hud: HudSnapshot) => void): void;
  onGameOver(cb: (result: RunResult) => void): void;
}

export function createGameWorld(config: RunConfig): GameWorld {
  const { difficulty, upgrades, cosmeticId } = config;
  const tuning = RUSH_TUNING[difficulty];
  const baseSpeed = BASE_SPEED * tuning.speedMul;
  const maxSpeed = MAX_SPEED * tuning.maxSpeedMul;
  const minGap = OBSTACLE_MIN_GAP * tuning.gapMul;
  const maxGap = OBSTACLE_MAX_GAP * tuning.gapMul;
  const powerDur = POWERUP_DURATION_BASE * powerDurationMul(upgrades.powerDuration);
  const dashCdMax = dashCooldownSec(upgrades.dashCooldown);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x050816, 1);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070b1c, 0.0082);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  const clock = new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0x67e8f9, 0x1e1b4b, 0.95));
  const key = new THREE.DirectionalLight(0xf0abfc, 1.45);
  key.position.set(8, 18, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x22d3ee, 0.55);
  fill.position.set(-10, 8, -6);
  scene.add(fill);
  const rim = new THREE.PointLight(0x22d3ee, 2.2, 56);
  scene.add(rim);
  const accent = new THREE.PointLight(0xf472b6, 1.35, 42);
  scene.add(accent);

  const car = createCarMesh(cosmeticId);
  scene.add(car);
  const shieldMesh = car.userData.shieldMesh as THREE.Mesh;
  const trailColor = (car.userData.trailColor as number) ?? 0x22d3ee;

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(400, 48),
    new THREE.MeshStandardMaterial({
      color: 0x020617,
      metalness: 0.1,
      roughness: 0.95,
      emissive: 0x01030a,
      emissiveIntensity: 0.4,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  const roadGroup = new THREE.Group();
  scene.add(roadGroup);
  const cityGroup = new THREE.Group();
  scene.add(cityGroup);

  const obstacles: Obstacle[] = [];
  const pickups: Pickup[] = [];
  const trails: TrailBit[] = [];

  let laneBody: LaneBody = createLaneBody(1);
  let z = 0;
  let speed = baseSpeed;
  let boostT = 0;
  let jumpT = 0;
  let dashT = 0;
  let dashCd = 0;
  let iframeT = 0;
  let nearMissSpeed = 0;
  let shieldCharges = upgrades.startShield > 0 ? 1 : 0;
  let magnetT = 0;
  let multiplierT = 0;
  let slowmoT = 0;
  let shieldFlashT = 0;
  let phase: GamePhase = 'paused';
  let score = createScoreState(difficulty, upgrades);
  let result: RunResult | null = null;
  let nextObstacleZ = 40;
  let patternStep = 0;
  let roadCursor = -TRACK_BEHIND;
  let cityCursor = -TRACK_BEHIND;
  let camX = 0;
  let camRoll = 0;
  let shake = 0;
  let trailAcc = 0;
  let raf = 0;
  let mountedEl: HTMLElement | null = null;
  let hudCb: ((hud: HudSnapshot) => void) | null = null;
  let overCb: ((result: RunResult) => void) | null = null;
  let lastHudEmit = 0;
  let tickErrorLogged = false;

  const resizeObserver = new ResizeObserver(() => resize());

  function resize(): void {
    if (!mountedEl) return;
    const w = Math.max(1, mountedEl.clientWidth);
    const h = Math.max(1, mountedEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function disposeObject(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }

  function cullGroup(group: THREE.Group, cullZ: number): void {
    for (let i = group.children.length - 1; i >= 0; i--) {
      const child = group.children[i];
      const maxZ = Number(child.userData.maxZ ?? -Infinity);
      if (maxZ < cullZ) {
        group.remove(child);
        disposeObject(child);
      }
    }
  }

  function rebuildRoad(): void {
    while (roadCursor < z + TRACK_AHEAD) {
      const from = roadCursor;
      const to = roadCursor + TRACK_SEGMENT_LENGTH;
      roadGroup.add(createRoadChunk(from, to));
      roadCursor = to;
    }
    cullGroup(roadGroup, z - TRACK_BEHIND - 16);
  }

  function rebuildCity(): void {
    while (cityCursor < z + TRACK_AHEAD) {
      cityGroup.add(createCityBlocks(cityCursor));
      cityCursor += 80;
    }
    cullGroup(cityGroup, z - TRACK_BEHIND - 40);
  }

  function addObstacle(atZ: number, lane: number, kind: ObstacleKind): void {
    const mesh = createObstacleMesh(kind);
    scene.add(mesh);
    const obs: Obstacle = { mesh, z: atZ, lane, kind, scored: false, alive: true };
    placeObstacle(obs);
    obstacles.push(obs);
  }

  function addPickup(atZ: number, lane: number, kind: PickupKind): void {
    const mesh = kind === 'boost' ? createBoostRing() : createPowerupMesh(kind);
    scene.add(mesh);
    const p: Pickup = { mesh, z: atZ, lane, kind, alive: true };
    placePickup(p);
    pickups.push(p);
  }

  function placePickup(p: Pickup): void {
    const ox = trackOffset(p.z);
    const heading = trackHeading(p.z);
    const lx = Math.cos(heading);
    const lateral = laneToX(p.lane);
    p.mesh.position.set(ox + lx * lateral, 0, p.z);
    p.mesh.rotation.y = -heading;
  }

  function randomPowerup(): PowerupKind {
    const roll = Math.random();
    if (roll < 0.28) return 'shield';
    if (roll < 0.52) return 'magnet';
    if (roll < 0.78) return 'multiplier';
    return 'slowmo';
  }

  function maybeSpawnPickup(atZ: number, lane: number, chance: number): void {
    if (Math.random() > chance) return;
    // Mix nitro rings with run power-ups.
    if (Math.random() < 0.42) addPickup(atZ, lane, randomPowerup());
    else addPickup(atZ, lane, 'boost');
  }

  /** Wave patterns that force reading ahead: gate / zigzag / profile mix / bait. */
  function spawnObstacles(): void {
    while (nextObstacleZ < z + OBSTACLE_SPAWN_AHEAD) {
      const progress = Math.min(1, nextObstacleZ / 700);
      const kind = pickObstacleKind(Math.random, progress);
      const wave = patternStep % 6;
      patternStep += 1;

      if (nextObstacleZ < EARLY_SAFE_Z) {
        addObstacle(nextObstacleZ, Math.random() < 0.5 ? 0 : 2, kind === 'slideBar' ? 'cone' : kind);
      } else if (wave === 0) {
        // Gate: two lanes blocked, open lane may hold a pickup.
        const open = Math.floor(Math.random() * 3);
        for (let L = 0; L < 3; L++) {
          if (L !== open) {
            const k = pickObstacleKind(Math.random, progress);
            addObstacle(nextObstacleZ, L, k);
          }
        }
        maybeSpawnPickup(nextObstacleZ + 6, open, 0.6 + progress * 0.2);
      } else if (wave === 1) {
        // Zigzag singles — forces early lane commits.
        const start = Math.floor(Math.random() * 3);
        addObstacle(nextObstacleZ, start, pickObstacleKind(Math.random, progress));
        addObstacle(nextObstacleZ + 9, (start + 1) % 3, pickObstacleKind(Math.random, progress));
        addObstacle(nextObstacleZ + 18, (start + 2) % 3, pickObstacleKind(Math.random, progress));
        nextObstacleZ += 28;
        continue;
      } else if (wave === 2) {
        // Profile read: jumpable in one lane, slideable in another, solid elsewhere.
        const jumpLane = Math.floor(Math.random() * 3);
        const slideLane = (jumpLane + 1) % 3;
        const solidLane = (jumpLane + 2) % 3;
        addObstacle(nextObstacleZ, jumpLane, Math.random() < 0.5 ? 'lowBarrier' : 'cone');
        addObstacle(nextObstacleZ + 5, slideLane, 'slideBar');
        addObstacle(nextObstacleZ + 11, solidLane, Math.random() < 0.5 ? 'highGate' : 'barrier');
        maybeSpawnPickup(nextObstacleZ + 16, jumpLane, 0.45);
        nextObstacleZ += 22;
        continue;
      } else if (wave === 3) {
        // Twin stagger + open side bait.
        const a = Math.random() < 0.5 ? 0 : 2;
        addObstacle(nextObstacleZ, a, kind);
        addObstacle(nextObstacleZ, 1, kind === 'drone' ? 'cone' : kind);
        maybeSpawnPickup(nextObstacleZ + 8, a === 0 ? 2 : 0, 0.5);
      } else if (wave === 4) {
        // Triple-lane pressure with staggered Z — must weave.
        const order = [0, 1, 2].sort(() => Math.random() - 0.5);
        addObstacle(nextObstacleZ, order[0], 'barrier');
        addObstacle(nextObstacleZ + 7, order[1], 'lowBarrier');
        addObstacle(nextObstacleZ + 14, order[2], 'slideBar');
        maybeSpawnPickup(nextObstacleZ + 20, order[0], 0.4);
        nextObstacleZ += 26;
        continue;
      } else {
        const blocked = Math.floor(Math.random() * 3);
        addObstacle(nextObstacleZ, blocked, kind);
        const bait = (blocked + 1 + Math.floor(Math.random() * 2)) % 3;
        maybeSpawnPickup(nextObstacleZ + 4, bait, 0.85);
      }

      const earlyBonus = nextObstacleZ < EARLY_SAFE_Z + 80 ? 6 : 0;
      const gap =
        minGap + Math.random() * (maxGap - minGap) - progress * 9 + earlyBonus;
      nextObstacleZ += Math.max(9, gap);
    }
  }

  function placeObstacle(obs: Obstacle): void {
    const ox = trackOffset(obs.z);
    const heading = trackHeading(obs.z);
    const lx = Math.cos(heading);
    const lateral = laneToX(obs.lane);
    obs.mesh.position.set(ox + lx * lateral, 0, obs.z);
    obs.mesh.rotation.y = -heading;
    obs.mesh.visible = true;
  }

  function clearGroup(group: THREE.Group): void {
    while (group.children.length) {
      const c = group.children[0];
      group.remove(c);
      disposeObject(c);
    }
  }

  function clearTrails(): void {
    for (const t of trails) {
      scene.remove(t.mesh);
      disposeObject(t.mesh);
    }
    trails.length = 0;
  }

  function resetRun(): void {
    z = 0;
    speed = baseSpeed;
    boostT = 0;
    jumpT = 0;
    dashT = 0;
    dashCd = 0;
    iframeT = 0;
    nearMissSpeed = 0;
    shieldCharges = upgrades.startShield > 0 ? 1 : 0;
    magnetT = 0;
    multiplierT = 0;
    slowmoT = 0;
    shieldFlashT = 0;
    laneBody = createLaneBody(1);
    score = createScoreState(difficulty, upgrades);
    score.scorePowerMul = 1;
    result = null;
    phase = 'running';
    nextObstacleZ = FIRST_OBSTACLE_Z;
    patternStep = 0;
    roadCursor = -TRACK_BEHIND;
    cityCursor = -TRACK_BEHIND;
    shake = 0;
    trailAcc = 0;
    camX = trackOffset(0);
    camRoll = 0;
    tickErrorLogged = false;
    shieldMesh.visible = shieldCharges > 0;

    for (const obs of obstacles) {
      scene.remove(obs.mesh);
      disposeObject(obs.mesh);
    }
    obstacles.length = 0;
    for (const p of pickups) {
      scene.remove(p.mesh);
      disposeObject(p.mesh);
    }
    pickups.length = 0;
    clearTrails();
    clearGroup(roadGroup);
    clearGroup(cityGroup);
    rebuildRoad();
    rebuildCity();
    spawnObstacles();
    clock.start();
    emitHud(true);
  }

  const _camUp = new THREE.Vector3();

  function jumpHeight(): number {
    if (jumpT <= 0) return 0;
    const t = 1 - jumpT / JUMP_DURATION;
    return Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * JUMP_HEIGHT;
  }

  function updateCamera(dt: number): void {
    const ox = trackOffset(z);
    const slope = trackSlope(z);
    const curv = trackCurvature(z);

    const targetCamX = ox + laneBody.x * 0.35 - slope * 4 * CAMERA_SWAY_GAIN;
    camX += (targetCamX - camX) * Math.min(1, CAMERA_FOLLOW * dt);
    const targetRoll = THREE.MathUtils.clamp(
      -curv * 18 * CAMERA_ROLL_GAIN - laneBody.vx * 0.015,
      -0.2,
      0.2,
    );
    camRoll += (targetRoll - camRoll) * Math.min(1, 8 * dt);

    const camZ = z - CAMERA_BACK;
    const camY = CAMERA_HEIGHT + Math.abs(laneBody.vx) * 0.02 + jumpHeight() * 0.35;
    const shakeX = (Math.random() - 0.5) * shake;
    const shakeY = (Math.random() - 0.5) * shake * 0.5;

    camera.position.set(camX + shakeX, camY + shakeY, camZ);
    camera.up.set(0, 1, 0);
    const lookX = trackOffset(z + CAMERA_LOOK_AHEAD) + laneBody.x * 0.2;
    camera.lookAt(lookX, CAMERA_LOOK_Y + jumpHeight() * 0.2, z + CAMERA_LOOK_AHEAD);
    _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (_camUp.y < 0) {
      camera.rotateZ(Math.PI);
    }
    camera.rotateZ(camRoll);

    rim.position.set(ox + laneBody.x, 2.5 + jumpHeight(), z + 2);
    accent.position.set(ox - laneBody.x * 0.4, 3.2 + jumpHeight() * 0.5, z - 3);
    const flashBoost = score.nearMissFlash * 2.8;
    if (isFever(score.combo)) {
      rim.color.setHex(0xf472b6);
      rim.intensity = 3.2 + flashBoost;
      accent.intensity = 2.4 + flashBoost * 0.6;
    } else if (multiplierT > 0) {
      rim.color.setHex(0xf0abfc);
      rim.intensity = 2.6 + flashBoost;
      accent.intensity = 1.8;
    } else if (slowmoT > 0) {
      rim.color.setHex(0xa3e635);
      rim.intensity = 2.4 + flashBoost;
      accent.intensity = 1.4;
    } else if (dashT > 0 || boostT > 0) {
      rim.color.setHex(0x67e8f9);
      rim.intensity = 2.8 + flashBoost;
      accent.intensity = 1.9;
    } else {
      rim.color.setHex(0x22d3ee);
      rim.intensity = 2.1 + flashBoost;
      accent.intensity = 1.25 + flashBoost * 0.35;
    }
    ground.position.set(ox, -0.05, z);
  }

  function spawnTrail(dt: number): void {
    trailAcc += dt;
    const hot = dashT > 0 || boostT > 0 || isFever(score.combo);
    const rate = hot ? 0.016 : 0.04;
    if (trailAcc < rate) return;
    trailAcc = 0;
    const burst = hot ? 2 : 1;
    const ox = trackOffset(z);
    const heading = trackHeading(z);
    const lx = Math.cos(heading);
    for (let i = 0; i < burst; i++) {
      const spark = createTrailSpark(trailColor);
      spark.position.set(
        ox + lx * laneBody.x + (Math.random() - 0.5) * (hot ? 0.55 : 0.35),
        0.35 + jumpHeight() * 0.4 + Math.random() * 0.15,
        z - 1.15 - Math.random() * 0.55,
      );
      spark.rotation.y = -heading;
      spark.scale.setScalar(hot ? 1.15 + Math.random() * 0.35 : 1);
      scene.add(spark);
      trails.push({ mesh: spark, life: dashT > 0 ? 0.55 : hot ? 0.42 : 0.32 });
    }
  }

  function updateTrails(dt: number): void {
    for (let i = trails.length - 1; i >= 0; i--) {
      const t = trails[i];
      t.life -= dt;
      const mat = t.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, t.life * 2.2);
      t.mesh.scale.z = 1 + (0.4 - t.life);
      if (t.life <= 0) {
        scene.remove(t.mesh);
        disposeObject(t.mesh);
        trails.splice(i, 1);
      }
    }
  }

  function updateCar(dt: number): void {
    stepLaneBody(laneBody, dt);
    const ox = trackOffset(z);
    const heading = trackHeading(z);
    const lx = Math.cos(heading);
    const crouch = dashT > 0 ? -0.35 : 0;
    const y = 0.02 + jumpHeight() + crouch + Math.sin(performance.now() * 0.01) * 0.03;
    car.position.set(ox + lx * laneBody.x, y, z);
    car.rotation.set(dashT > 0 ? 0.18 : 0, -heading, laneBodyRoll(laneBody));
    const scaleBoost = boostT > 0 || dashT > 0 ? 1.06 : 1;
    car.scale.setScalar(scaleBoost);
    shieldMesh.visible = shieldCharges > 0 || shieldFlashT > 0;
    if (shieldFlashT > 0) {
      const mat = shieldMesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.15 + 0.35 * (shieldFlashT / SHIELD_FLASH_SEC);
    } else if (shieldCharges > 0) {
      const mat = shieldMesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.18 + Math.sin(performance.now() * 0.006) * 0.06;
    }
    spawnTrail(dt);
  }

  function absorbsHit(): boolean {
    if (iframeT > 0) return true;
    if (shieldCharges > 0) {
      shieldCharges -= 1;
      shieldFlashT = SHIELD_FLASH_SEC;
      shake = Math.max(shake, 0.28);
      iframeT = 0.45;
      haptic('impact', 0.7);
      return true;
    }
    return false;
  }

  function hitsObstacle(obs: Obstacle): boolean {
    const profile = collisionProfile(obs.kind);
    if (profile === 'jumpable' && jumpT > 0.08) return false;
    if (profile === 'slideable' && dashT > 0.05) return false;
    return true;
  }

  function updateObstacles(dt: number): void {
    for (const obs of obstacles) {
      if (!obs.alive) continue;
      if (obs.kind === 'drone' && obs.mesh.userData.spin) {
        (obs.mesh.userData.spin as THREE.Object3D).rotation.z += dt * 6;
        obs.mesh.position.y = 0.15 + Math.sin(performance.now() * 0.004 + obs.z) * 0.12;
      }
      const dz = obs.z - z;
      if (dz < 1.25 && dz > -1.05) {
        const carX = trackOffset(z) + laneBody.x;
        const obsX = trackOffset(obs.z) + laneToX(obs.lane);
        if (Math.abs(carX - obsX) < 1.15 && hitsObstacle(obs)) {
          if (!absorbsHit()) {
            triggerCrash();
            return;
          }
          obs.alive = false;
          obs.mesh.visible = false;
          obs.scored = true;
        }
      }
      if (!obs.scored && dz < -0.5) {
        obs.scored = true;
        const lateral = Math.abs(laneBody.x - laneToX(obs.lane));
        if (lateral < NEAR_MISS_WINDOW) {
          const perfect = lateral < PERFECT_MISS_WINDOW;
          registerNearMiss(score, perfect);
          nearMissSpeed = Math.min(14, nearMissSpeed + NEAR_MISS_SPEED_BONUS);
          shake = Math.max(shake, perfect ? 0.28 : 0.16);
          haptic(perfect ? 'success' : 'tap', perfect ? 0.75 : 0.45);
        }
      }
    }
    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (obstacles[i].z < z - OBSTACLE_DESPAWN_BEHIND || !obstacles[i].alive) {
        scene.remove(obstacles[i].mesh);
        disposeObject(obstacles[i].mesh);
        obstacles.splice(i, 1);
      }
    }
  }

  function applyPowerup(kind: PowerupKind): void {
    registerPowerupPickup(score, kind);
    if (kind === 'shield') {
      shieldCharges = Math.min(2, shieldCharges + 1);
    } else if (kind === 'magnet') {
      magnetT = powerDur;
    } else if (kind === 'multiplier') {
      multiplierT = powerDur;
      score.scorePowerMul = MULTIPLIER_POWER;
    } else if (kind === 'slowmo') {
      slowmoT = powerDur * 0.85;
    }
  }

  function updatePickups(dt: number): void {
    const magR = magnetRange(upgrades.magnetBonus, magnetT > 0);
    for (const p of pickups) {
      if (!p.alive) continue;
      if (p.mesh.userData.spin) {
        (p.mesh.userData.spin as THREE.Object3D).rotation.z += dt * 4;
      }
      p.mesh.position.y = Math.sin(performance.now() * 0.006 + p.z) * 0.15;
      if (magR > 0) {
        const dz = p.z - z;
        const carX = trackOffset(z) + laneBody.x;
        const pX = trackOffset(p.z) + laneToX(p.lane);
        const dist = Math.hypot(dz, carX - pX);
        if (dist < magR && dist > 0.2) {
          // Pull along track toward the car; snap lane if close enough laterally.
          p.z += ((z + 0.5 - p.z) / dist) * Math.min(22, 48 * dt);
          if (Math.abs(carX - pX) < magR * 0.85) {
            p.lane = laneBody.targetLane;
          }
          placePickup(p);
        }
      }
      const dz = p.z - z;
      if (dz < 1.1 && dz > -0.8) {
        const carX = trackOffset(z) + laneBody.x;
        const pX = trackOffset(p.z) + laneToX(p.lane);
        if (Math.abs(carX - pX) < 1.35) {
          p.alive = false;
          p.mesh.visible = false;
          if (p.kind === 'boost') {
            registerBoostPickup(score);
            boostT = BOOST_DURATION;
            shake = Math.max(shake, 0.1);
            haptic('tap', 0.5);
          } else {
            applyPowerup(p.kind);
            shake = Math.max(shake, 0.12);
            haptic('place', 0.55);
          }
        }
      }
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      if (!pickups[i].alive || pickups[i].z < z - OBSTACLE_DESPAWN_BEHIND) {
        scene.remove(pickups[i].mesh);
        disposeObject(pickups[i].mesh);
        pickups.splice(i, 1);
      }
    }
  }

  function triggerCrash(): void {
    if (phase !== 'running') return;
    phase = 'over';
    shake = 0.55;
    boostT = 0;
    haptic('error');
    breakCombo(score);
    const credits = creditsFromRun({
      score: score.score,
      avoids: score.avoids,
      pickups: score.pickups,
      powerups: score.powerups,
    });
    result = finalizeRun(score, credits);
    overCb?.(result);
    emitHud(true);
  }

  function hudExtras() {
    return {
      dashCd,
      dashReady: dashCd <= 0 && phase === 'running',
      jumpAir: jumpT > 0,
      shake,
      powers: {
        shield: shieldCharges > 0,
        magnet: magnetT,
        multiplier: multiplierT,
        slowmo: slowmoT,
      },
    };
  }

  function emitHud(force = false): void {
    const now = performance.now();
    if (!force && now - lastHudEmit < 50) return;
    lastHudEmit = now;
    hudCb?.(toHud(score, speed, boostT, hudExtras()));
  }

  function tickPowers(dt: number): void {
    if (magnetT > 0) magnetT = Math.max(0, magnetT - dt);
    if (multiplierT > 0) {
      multiplierT = Math.max(0, multiplierT - dt);
      if (multiplierT <= 0) score.scorePowerMul = 1;
    }
    if (slowmoT > 0) slowmoT = Math.max(0, slowmoT - dt);
    if (shieldFlashT > 0) shieldFlashT = Math.max(0, shieldFlashT - dt);
    if (jumpT > 0) jumpT = Math.max(0, jumpT - dt);
    if (dashT > 0) dashT = Math.max(0, dashT - dt);
    if (dashCd > 0) dashCd = Math.max(0, dashCd - dt);
    if (iframeT > 0) iframeT = Math.max(0, iframeT - dt);
    if (nearMissSpeed > 0) {
      nearMissSpeed = Math.max(0, nearMissSpeed - NEAR_MISS_SPEED_DECAY * dt);
    }
  }

  function tick(): void {
    raf = requestAnimationFrame(tick);
    try {
      const rawDt = Math.min(0.05, clock.getDelta());
      const dt = slowmoT > 0 ? rawDt * SLOWMO_SCALE : rawDt;
      if (phase === 'running') {
        if (boostT > 0) boostT = Math.max(0, boostT - rawDt);
        tickPowers(rawDt);
        const feverBonus = isFever(score.combo) ? 4 : 0;
        const dashBonus = dashT > 0 ? DASH_SPEED_BONUS : 0;
        speed = Math.min(
          maxSpeed + (boostT > 0 ? 8 : 0) + dashBonus * 0.35,
          baseSpeed +
            z * SPEED_RAMP_PER_METER +
            (boostT > 0 ? BOOST_SPEED : 0) +
            feverBonus +
            nearMissSpeed +
            dashBonus,
        );
        const step = speed * dt;
        z += step;
        addDistanceScore(score, step);
        tickScoreTimers(score, rawDt);
        updateCar(dt);
        updateObstacles(dt);
        updatePickups(dt);
        updateTrails(rawDt);
        spawnObstacles();
        rebuildRoad();
        rebuildCity();
        if (shake > 0) shake = Math.max(0, shake - rawDt * 1.1);
      } else {
        updateCar(0);
        updateTrails(rawDt);
        if (shake > 0) shake = Math.max(0, shake - rawDt * 0.5);
      }
      updateCamera(dt);
      emitHud();
      renderer.render(scene, camera);
    } catch (err) {
      if (!tickErrorLogged) {
        tickErrorLogged = true;
        console.error('Cyber Neon Rush tick error', err);
      }
    }
  }

  return {
    mount(el: HTMLElement) {
      mountedEl = el;
      el.appendChild(renderer.domElement);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      resize();
      resizeObserver.observe(el);
      rebuildRoad();
      rebuildCity();
      updateCar(0);
      updateCamera(0);
      renderer.render(scene, camera);
      if (!raf) tick();
    },
    unmount() {
      cancelAnimationFrame(raf);
      raf = 0;
      resizeObserver.disconnect();
      if (mountedEl && renderer.domElement.parentElement === mountedEl) {
        mountedEl.removeChild(renderer.domElement);
      }
      mountedEl = null;
      clearGroup(roadGroup);
      clearGroup(cityGroup);
      clearTrails();
      for (const obs of obstacles) {
        scene.remove(obs.mesh);
        disposeObject(obs.mesh);
      }
      obstacles.length = 0;
      for (const p of pickups) {
        scene.remove(p.mesh);
        disposeObject(p.mesh);
      }
      pickups.length = 0;
      renderer.dispose();
    },
    start() {
      resetRun();
    },
    setPaused(paused: boolean) {
      if (phase === 'over') return;
      phase = paused ? 'paused' : 'running';
      if (!paused) clock.start();
    },
    nudgeLane(dir: -1 | 1) {
      if (phase !== 'running') return;
      laneBody.targetLane = clampLane(laneBody.targetLane + dir);
    },
    jump() {
      if (phase !== 'running') return;
      if (jumpT > 0 || dashT > 0) return;
      jumpT = JUMP_DURATION;
    },
    dash() {
      if (phase !== 'running') return;
      if (dashCd > 0 || dashT > 0) return;
      dashT = DASH_DURATION;
      iframeT = Math.max(iframeT, DASH_IFRAME);
      dashCd = dashCdMax;
      registerDash(score);
      shake = Math.max(shake, 0.12);
      haptic('tap', 0.4);
    },
    getHud() {
      return toHud(score, speed, boostT, hudExtras());
    },
    getPhase() {
      return phase;
    },
    getResult() {
      return result;
    },
    onHud(cb) {
      hudCb = cb;
    },
    onGameOver(cb) {
      overCb = cb;
    },
  };
}
