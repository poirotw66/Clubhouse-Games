import * as THREE from 'three';
import {
  BASE_SPEED,
  CAMERA_BACK,
  CAMERA_FOLLOW,
  CAMERA_HEIGHT,
  CAMERA_LOOK_AHEAD,
  CAMERA_LOOK_Y,
  CAMERA_ROLL_GAIN,
  CAMERA_SWAY_GAIN,
  MAX_SPEED,
  NEAR_MISS_WINDOW,
  OBSTACLE_DESPAWN_BEHIND,
  OBSTACLE_MAX_GAP,
  OBSTACLE_MIN_GAP,
  OBSTACLE_SPAWN_AHEAD,
  SPEED_RAMP_PER_METER,
  TRACK_AHEAD,
  TRACK_BEHIND,
  TRACK_SEGMENT_LENGTH,
  clampLane,
  laneToX,
} from './constants';
import { createLaneBody, laneBodyRoll, stepLaneBody, type LaneBody } from './lanePhysics';
import {
  createCarMesh,
  createCityBlocks,
  createObstacleMesh,
  createRoadChunk,
  type ObstacleKind,
} from './meshes';
import {
  addDistanceScore,
  breakCombo,
  createScoreState,
  finalizeRun,
  registerNearMiss,
  toHud,
  type HudSnapshot,
  type RunResult,
} from './scoreSystem';
import { trackCurvature, trackHeading, trackOffset, trackSlope } from './trackPath';

export type GamePhase = 'running' | 'paused' | 'over';

interface Obstacle {
  mesh: THREE.Group;
  z: number;
  lane: number;
  kind: ObstacleKind;
  scored: boolean;
  alive: boolean;
}

export interface GameWorld {
  mount(el: HTMLElement): void;
  unmount(): void;
  start(): void;
  setPaused(paused: boolean): void;
  nudgeLane(dir: -1 | 1): void;
  getHud(): HudSnapshot;
  getPhase(): GamePhase;
  getResult(): RunResult | null;
  onHud(cb: (hud: HudSnapshot) => void): void;
  onGameOver(cb: (result: RunResult) => void): void;
}

export function createGameWorld(): GameWorld {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x050816, 1);
  // Shadows off: VM/software GL stalls hard on shadow-map ReadPixels.
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050816, 0.009);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  const clock = new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0x67e8f9, 0x1e1b4b, 0.75));
  const key = new THREE.DirectionalLight(0xf0abfc, 1.15);
  key.position.set(8, 18, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0x22d3ee, 1.6, 48);
  scene.add(rim);

  const car = createCarMesh();
  scene.add(car);

  // Huge ground disc so "down" reads clearly under the neon track.
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

  let laneBody: LaneBody = createLaneBody(1);
  let z = 0;
  let speed = BASE_SPEED;
  let phase: GamePhase = 'paused';
  let score = createScoreState();
  let result: RunResult | null = null;
  let nextObstacleZ = 40;
  let roadCursor = -TRACK_BEHIND;
  let cityCursor = -TRACK_BEHIND;
  let camX = 0;
  let camRoll = 0;
  let shake = 0;
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

  function spawnObstacles(): void {
    while (nextObstacleZ < z + OBSTACLE_SPAWN_AHEAD) {
      const kindRoll = Math.random();
      const kind: ObstacleKind =
        kindRoll < 0.4 ? 'barrier' : kindRoll < 0.75 ? 'cone' : 'drone';
      // Prefer side lanes early so the opening stretch is readable.
      let lane = Math.floor(Math.random() * 3);
      if (nextObstacleZ < 120 && lane === 1) {
        lane = Math.random() < 0.5 ? 0 : 2;
      }
      const lanes =
        Math.random() < 0.28
          ? [lane, (lane + 1 + Math.floor(Math.random() * 2)) % 3]
          : [lane];
      // Never block all three lanes.
      const unique = [...new Set(lanes)].slice(0, 2);
      for (const L of unique) {
        const mesh = createObstacleMesh(kind);
        scene.add(mesh);
        const obs: Obstacle = {
          mesh,
          z: nextObstacleZ,
          lane: L,
          kind,
          scored: false,
          alive: true,
        };
        placeObstacle(obs);
        obstacles.push(obs);
      }
      const gap =
        OBSTACLE_MIN_GAP +
        Math.random() * (OBSTACLE_MAX_GAP - OBSTACLE_MIN_GAP) -
        Math.min(8, z * 0.01);
      nextObstacleZ += Math.max(10, gap);
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

  function resetRun(): void {
    z = 0;
    speed = BASE_SPEED;
    laneBody = createLaneBody(1);
    score = createScoreState();
    result = null;
    phase = 'running';
    nextObstacleZ = 70;
    roadCursor = -TRACK_BEHIND;
    cityCursor = -TRACK_BEHIND;
    shake = 0;
    camX = trackOffset(0);
    camRoll = 0;
    tickErrorLogged = false;

    for (const obs of obstacles) {
      scene.remove(obs.mesh);
      disposeObject(obs.mesh);
    }
    obstacles.length = 0;
    clearGroup(roadGroup);
    clearGroup(cityGroup);
    rebuildRoad();
    rebuildCity();
    spawnObstacles();
    clock.start();
    emitHud(true);
  }

  const _camUp = new THREE.Vector3();

  function updateCamera(dt: number): void {
    const ox = trackOffset(z);
    const slope = trackSlope(z);
    const curv = trackCurvature(z);

    const targetCamX = ox + laneBody.x * 0.35 - slope * 4 * CAMERA_SWAY_GAIN;
    camX += (targetCamX - camX) * Math.min(1, CAMERA_FOLLOW * dt);
    // Keep bank gentle — large euler rolls are how +Z chase cams flip upside-down.
    const targetRoll = THREE.MathUtils.clamp(
      -curv * 18 * CAMERA_ROLL_GAIN - laneBody.vx * 0.015,
      -0.2,
      0.2,
    );
    camRoll += (targetRoll - camRoll) * Math.min(1, 8 * dt);

    const camZ = z - CAMERA_BACK;
    const camY = CAMERA_HEIGHT + Math.abs(laneBody.vx) * 0.02;
    const shakeX = (Math.random() - 0.5) * shake;
    const shakeY = (Math.random() - 0.5) * shake * 0.5;

    camera.position.set(camX + shakeX, camY + shakeY, camZ);
    camera.up.set(0, 1, 0);
    const lookX = trackOffset(z + CAMERA_LOOK_AHEAD) + laneBody.x * 0.2;
    // Never assign camera.rotation.z after lookAt — that Euler rewrite flips +Z chase cams.
    camera.lookAt(lookX, CAMERA_LOOK_Y, z + CAMERA_LOOK_AHEAD);
    // Safety net: if local up points down, force upright before applying bank.
    _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (_camUp.y < 0) {
      camera.rotateZ(Math.PI);
    }
    camera.rotateZ(camRoll);

    rim.position.set(ox + laneBody.x, 2.5, z + 2);
    ground.position.set(ox, -0.05, z);
  }

  function updateCar(dt: number): void {
    stepLaneBody(laneBody, dt);
    const ox = trackOffset(z);
    const heading = trackHeading(z);
    const lx = Math.cos(heading);
    car.position.set(ox + lx * laneBody.x, 0.02, z);
    car.rotation.set(0, -heading, laneBodyRoll(laneBody));
    car.position.y = 0.02 + Math.sin(performance.now() * 0.01) * 0.03;
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
        if (Math.abs(carX - obsX) < 1.15) {
          triggerCrash();
          return;
        }
      }
      if (!obs.scored && dz < -0.5) {
        obs.scored = true;
        const lateral = Math.abs(laneBody.x - laneToX(obs.lane));
        if (lateral < NEAR_MISS_WINDOW) {
          registerNearMiss(score);
        }
      }
    }
    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (obstacles[i].z < z - OBSTACLE_DESPAWN_BEHIND) {
        scene.remove(obstacles[i].mesh);
        disposeObject(obstacles[i].mesh);
        obstacles.splice(i, 1);
      }
    }
  }

  function triggerCrash(): void {
    if (phase !== 'running') return;
    phase = 'over';
    shake = 0.45;
    breakCombo(score);
    result = finalizeRun(score);
    overCb?.(result);
    emitHud(true);
  }

  function emitHud(force = false): void {
    const now = performance.now();
    if (!force && now - lastHudEmit < 50) return;
    lastHudEmit = now;
    if (score.nearMissFlash > 0) score.nearMissFlash = Math.max(0, score.nearMissFlash - 0.08);
    hudCb?.(toHud(score, speed));
  }

  function tick(): void {
    raf = requestAnimationFrame(tick);
    try {
      const dt = Math.min(0.05, clock.getDelta());
      if (phase === 'running') {
        speed = Math.min(MAX_SPEED, BASE_SPEED + z * SPEED_RAMP_PER_METER);
        const step = speed * dt;
        z += step;
        addDistanceScore(score, step);
        updateCar(dt);
        updateObstacles(dt);
        spawnObstacles();
        rebuildRoad();
        rebuildCity();
        if (shake > 0) shake = Math.max(0, shake - dt);
      } else {
        updateCar(0);
        if (shake > 0) shake = Math.max(0, shake - dt * 0.5);
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
      for (const obs of obstacles) {
        scene.remove(obs.mesh);
        disposeObject(obs.mesh);
      }
      obstacles.length = 0;
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
    getHud() {
      return toHud(score, speed);
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
