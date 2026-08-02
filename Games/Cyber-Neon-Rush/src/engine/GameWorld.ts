import * as THREE from 'three';
import {
  BASE_SPEED,
  CAMERA_BACK,
  CAMERA_FOLLOW,
  CAMERA_HEIGHT,
  CAMERA_LOOK_AHEAD,
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
  createLaneStripes,
  createObstacleMesh,
  createTrackRibbon,
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
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050816, 0.012);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  const clock = new THREE.Clock();

  const hemi = new THREE.HemisphereLight(0x67e8f9, 0x1e1b4b, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xf0abfc, 1.1);
  key.position.set(8, 18, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const rim = new THREE.PointLight(0x22d3ee, 1.4, 40);
  scene.add(rim);

  const car = createCarMesh();
  scene.add(car);

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

  const resizeObserver = new ResizeObserver(() => resize());

  function resize(): void {
    if (!mountedEl) return;
    const w = Math.max(1, mountedEl.clientWidth);
    const h = Math.max(1, mountedEl.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function rebuildRoad(): void {
    while (roadCursor < z + TRACK_AHEAD) {
      const from = roadCursor;
      const to = roadCursor + TRACK_SEGMENT_LENGTH;
      roadGroup.add(createTrackRibbon(from, to));
      roadGroup.add(createLaneStripes(from, to));
      // Soft shoulder rails
      for (const side of [-1, 1] as const) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.35, TRACK_SEGMENT_LENGTH),
          new THREE.MeshStandardMaterial({
            color: 0x22d3ee,
            emissive: 0x22d3ee,
            emissiveIntensity: 0.9,
          }),
        );
        const mid = (from + to) / 2;
        const ox = trackOffset(mid);
        const heading = trackHeading(mid);
        const lx = Math.cos(heading);
        const half = 3.7;
        rail.position.set(ox + lx * side * half, 0.2, mid);
        rail.rotation.y = -heading;
        roadGroup.add(rail);
      }
      roadCursor = to;
    }
    // Cull far-behind chunks (ponytail: O(n) child scan; n stays bounded by window size).
    const cullZ = z - TRACK_BEHIND - 20;
    for (let i = roadGroup.children.length - 1; i >= 0; i--) {
      const child = roadGroup.children[i];
      const maxZ = objectMaxZ(child);
      if (maxZ < cullZ) {
        roadGroup.remove(child);
        disposeObject(child);
      }
    }
  }

  function objectMaxZ(obj: THREE.Object3D): number {
    let maxZ = -Infinity;
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      const geo = mesh.geometry as THREE.BufferGeometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      if (geo.boundingBox) {
        maxZ = Math.max(maxZ, geo.boundingBox.max.z + mesh.position.z);
      }
    }
    obj.traverse((o) => {
      if (o !== obj) maxZ = Math.max(maxZ, o.position.z);
    });
    if (maxZ === -Infinity) maxZ = obj.position.z;
    return maxZ;
  }

  function rebuildCity(): void {
    while (cityCursor < z + TRACK_AHEAD) {
      cityGroup.add(createCityBlocks(cityCursor));
      cityCursor += 80;
    }
    const cullZ = z - TRACK_BEHIND - 40;
    for (let i = cityGroup.children.length - 1; i >= 0; i--) {
      const chunk = cityGroup.children[i] as THREE.Group;
      let maxZ = -Infinity;
      chunk.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) maxZ = Math.max(maxZ, o.position.z);
      });
      if (maxZ < cullZ) {
        cityGroup.remove(chunk);
        chunk.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.geometry.dispose();
            const mat = m.material;
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else mat.dispose();
          }
        });
      }
    }
  }

  function acquireObstacle(kind: ObstacleKind): THREE.Group {
    const mesh = createObstacleMesh(kind);
    scene.add(mesh);
    return mesh;
  }

  function spawnObstacles(): void {
    while (nextObstacleZ < z + OBSTACLE_SPAWN_AHEAD) {
      const kindRoll = Math.random();
      const kind: ObstacleKind =
        kindRoll < 0.4 ? 'barrier' : kindRoll < 0.75 ? 'cone' : 'drone';
      const lane = Math.floor(Math.random() * 3);
      // Occasionally twin obstacles on two lanes.
      const lanes = Math.random() < 0.28 ? [lane, (lane + 1 + Math.floor(Math.random() * 2)) % 3] : [lane];
      const unique = [...new Set(lanes)];
      for (const L of unique) {
        const mesh = acquireObstacle(kind);
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
    const lz = Math.sin(heading);
    const lateral = laneToX(obs.lane);
    obs.mesh.position.set(ox + lx * lateral, 0, obs.z + lz * lateral * 0.01);
    obs.mesh.rotation.y = -heading;
    obs.mesh.visible = true;
  }

  function resetRun(): void {
    z = 0;
    speed = BASE_SPEED;
    laneBody = createLaneBody(1);
    score = createScoreState();
    result = null;
    phase = 'running';
    nextObstacleZ = 36;
    roadCursor = -TRACK_BEHIND;
    cityCursor = -TRACK_BEHIND;
    shake = 0;
    camX = trackOffset(0);
    camRoll = 0;

    for (const obs of obstacles) {
      scene.remove(obs.mesh);
      disposeObject(obs.mesh);
    }
    obstacles.length = 0;
    while (roadGroup.children.length) {
      const c = roadGroup.children[0];
      roadGroup.remove(c);
      disposeObject(c);
    }
    while (cityGroup.children.length) {
      const c = cityGroup.children[0];
      cityGroup.remove(c);
      disposeObject(c);
    }
    rebuildRoad();
    rebuildCity();
    spawnObstacles();
    clock.start();
    emitHud(true);
  }

  function disposeObject(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      }
    });
  }

  function updateCamera(dt: number): void {
    const ox = trackOffset(z);
    const slope = trackSlope(z);
    const curv = trackCurvature(z);
    const heading = trackHeading(z);

    const targetCamX = ox + laneBody.x * 0.35 - slope * 4 * CAMERA_SWAY_GAIN;
    camX += (targetCamX - camX) * Math.min(1, CAMERA_FOLLOW * dt);
    const targetRoll = -curv * 18 * CAMERA_ROLL_GAIN - laneBody.vx * 0.02;
    camRoll += (targetRoll - camRoll) * Math.min(1, 8 * dt);

    const back = CAMERA_BACK;
    const camZ = z - back;
    const camY = CAMERA_HEIGHT + Math.abs(laneBody.vx) * 0.02;
    const shakeX = (Math.random() - 0.5) * shake;
    const shakeY = (Math.random() - 0.5) * shake * 0.5;

    camera.position.set(camX + shakeX, camY + shakeY, camZ);
    const lookX = trackOffset(z + CAMERA_LOOK_AHEAD) + laneBody.x * 0.2;
    camera.lookAt(lookX, 1.2, z + CAMERA_LOOK_AHEAD);
    camera.rotation.z = camRoll;

    rim.position.set(ox + laneBody.x, 2.5, z + 2);
    void heading;
  }

  function updateCar(dt: number): void {
    stepLaneBody(laneBody, dt);
    const ox = trackOffset(z);
    const heading = trackHeading(z);
    const lx = Math.cos(heading);
    const lz = Math.sin(heading);
    car.position.set(ox + lx * laneBody.x, 0, z);
    car.rotation.y = -heading;
    car.rotation.z = laneBodyRoll(laneBody);
    // Subtle bob
    car.position.y = Math.sin(performance.now() * 0.01) * 0.03;
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
    } else if (phase === 'over') {
      if (shake > 0) shake = Math.max(0, shake - dt * 0.5);
      updateCar(0);
    } else {
      // paused — still ease camera slightly
      updateCar(0);
    }
    updateCamera(dt);
    renderer.render(scene, camera);
    emitHud();
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
