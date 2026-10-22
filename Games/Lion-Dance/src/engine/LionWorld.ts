import * as THREE from 'three';
import {
  FIXED_DT,
  KEY_TO_LEG,
  MAX_FRAME_DT,
  TIME_LIMIT,
  TRACK_LENGTH,
  type LegId,
} from './constants';
import { playDrum, playDrumTap, playFall, playFinishFanfare, unlockAudio } from './audio';
import { applyLegPose, buildLion, buildStreet, type LionMeshes } from './meshes';
import {
  createSim,
  getUpInPlace,
  setLegHeld,
  snapshotHud,
  stepPhysics,
  type HudSnapshot,
  type RunResult,
  type SimState,
} from './physics';

export type { HudSnapshot, RunResult };

export interface LionWorld {
  mount(host: HTMLElement): void;
  unmount(): void;
  start(): void;
  setPaused(paused: boolean): void;
  setLeg(id: LegId, held: boolean): void;
  restart(): void;
  getUpOrRestart(): void;
  onHud(cb: (hud: HudSnapshot) => void): void;
  onRunEnd(cb: (result: RunResult) => void): void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createLionWorld(): LionWorld {
  const reduced = prefersReducedMotion();
  let sim: SimState = createSim();
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let lion: LionMeshes | null = null;
  let envelope: THREE.Group | null = null;
  let confetti: THREE.Points | null = null;
  let lanterns: THREE.Object3D[] = [];
  let raf = 0;
  let paused = true;
  let running = false;
  let acc = 0;
  let lastT = 0;
  let hostEl: HTMLElement | null = null;
  let hudCb: ((hud: HudSnapshot) => void) | null = null;
  let endCb: ((result: RunResult) => void) | null = null;
  let ended = false;
  let fallEndTimer = 0;
  let prevHeld: Partial<Record<LegId, boolean>> = {};
  let confettiVel: Float32Array | null = null;
  let finishFxPlayed = false;

  function emitHud(): void {
    hudCb?.(snapshotHud(sim, TIME_LIMIT));
  }

  function endRun(result: RunResult): void {
    if (ended) return;
    ended = true;
    paused = true;
    if (result.reason === 'fall') playFall();
    if (result.reason === 'finish') {
      /* fanfare triggered in finish anim */
    }
    endCb?.(result);
  }

  function resize(): void {
    if (!renderer || !camera || !hostEl) return;
    const w = hostEl.clientWidth || window.innerWidth;
    const h = hostEl.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function syncMeshes(dt: number): void {
    if (!lion || !camera || !envelope) return;
    const { root, body, head, legs, flower } = lion;

    if (sim.fallen) {
      root.position.set(sim.x, sim.y, 0);
      root.rotation.set(sim.pitch + sim.fallSpin * 0.3, sim.fallSpin, sim.roll + Math.sin(sim.fallSpin) * 0.4);
    } else if (sim.finished) {
      const t = sim.finishAnim;
      root.position.set(sim.x, BODY_BOB(sim) + Math.sin(t * 8) * 0.05 * (1 - t), 0);
      root.rotation.set(sim.pitch - t * 0.55, 0, sim.roll);
      head.rotation.x = -t * 0.9;
      head.position.y = 0.15 + t * 0.35;
      // Reach for envelope
      envelope.position.y = 3.4 - t * 1.6;
      envelope.rotation.z = t * 0.8;
      if (t > 0.55 && confetti) {
        confetti.visible = true;
        const mat = confetti.material as THREE.PointsMaterial;
        mat.opacity = Math.min(1, (t - 0.55) * 3);
        if (!reduced && confettiVel) {
          const pos = confetti.geometry.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            pos.setY(i, pos.getY(i) + confettiVel[i]! * dt);
            confettiVel[i]! -= 9 * dt;
            pos.setX(i, pos.getX(i) + Math.sin(i + t * 10) * 0.4 * dt);
          }
          pos.needsUpdate = true;
        }
      }
      if (t > 0.2 && !finishFxPlayed) {
        finishFxPlayed = true;
        playFinishFanfare();
      }
    } else {
      root.position.set(sim.x, BODY_BOB(sim), 0);
      root.rotation.set(sim.pitch, 0, sim.roll);
      head.rotation.x = THREE.MathUtils.clamp(-sim.pitch * 0.3, -0.25, 0.25);
      flower.rotation.y += dt * 1.2;
    }

    applyLegPose(legs, snapshotHud(sim, TIME_LIMIT).legLift, snapshotHud(sim, TIME_LIMIT).legSwing);

    // Chase camera
    const target = new THREE.Vector3(sim.x - 0.2, 1.6 + (sim.fallen ? 0.4 : 0), 0);
    const camPos = new THREE.Vector3(
      sim.x - 5.2,
      3.4 + Math.abs(sim.pitch) * 0.4,
      5.8 + Math.abs(sim.roll) * 0.5,
    );
    if (reduced) {
      camera.position.copy(camPos);
    } else {
      camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));
    }
    camera.lookAt(target);

    // Lantern sway
    if (!reduced) {
      const t = performance.now() * 0.001;
      for (let i = 0; i < lanterns.length; i++) {
        const L = lanterns[i]!;
        L.rotation.z = Math.sin(t * 1.4 + i) * 0.08;
      }
    }
  }

  function BODY_BOB(s: SimState): number {
    return s.y;
  }

  function tick(now: number): void {
    raf = requestAnimationFrame(tick);
    if (!renderer || !scene || !camera) return;
    const frameDt = Math.min(MAX_FRAME_DT, (now - lastT) / 1000 || FIXED_DT);
    lastT = now;

    if (!paused && running && !ended) {
      acc += frameDt;
      let guard = 0;
      while (acc >= FIXED_DT && guard++ < 12) {
        // Timeout
        if (sim.elapsed + FIXED_DT >= TIME_LIMIT && !sim.finished && !sim.fallen) {
          sim.elapsed = TIME_LIMIT;
          endRun({ reason: 'timeout', elapsed: TIME_LIMIT, distance: sim.x });
          break;
        }

        // Drum on plant edges
        for (const id of ['FL', 'FR', 'BL', 'BR'] as LegId[]) {
          const held = sim.legs[id].held;
          if (held && !prevHeld[id]) playDrumTap();
          if (!held && prevHeld[id] && sim.legs[id].lift > 0.15) playDrum();
          prevHeld[id] = held;
        }

        const result = stepPhysics(sim, FIXED_DT);
        acc -= FIXED_DT;

        if (result?.reason === 'finish') {
          // Keep simulating finish anim; end after anim settles
          ended = false;
          fallEndTimer = 0;
        } else if (result?.reason === 'fall') {
          fallEndTimer = 1.35;
        }
      }

      if (sim.finished) {
        stepPhysics(sim, Math.min(frameDt, 0.05));
        if (sim.finishAnim >= 0.98) {
          endRun({ reason: 'finish', elapsed: sim.elapsed, distance: TRACK_LENGTH });
        }
      }

      if (sim.fallen && fallEndTimer > 0) {
        fallEndTimer -= frameDt;
        if (fallEndTimer <= 0) {
          endRun({ reason: 'fall', elapsed: sim.elapsed, distance: sim.x });
        }
      }

      emitHud();
    } else if (sim.finished && !ended) {
      stepPhysics(sim, Math.min(frameDt, 0.05));
      syncMeshes(frameDt);
      if (sim.finishAnim >= 0.98) {
        endRun({ reason: 'finish', elapsed: sim.elapsed, distance: TRACK_LENGTH });
      }
      emitHud();
    }

    syncMeshes(frameDt);
    renderer.render(scene, camera);
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (key === 'r') {
      e.preventDefault();
      unlockAudio();
      api.getUpOrRestart();
      return;
    }
    const leg = KEY_TO_LEG[key];
    if (leg) {
      e.preventDefault();
      unlockAudio();
      setLegHeld(sim, leg, true);
    }
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    const leg = KEY_TO_LEG[e.key.toLowerCase()];
    if (leg) {
      e.preventDefault();
      setLegHeld(sim, leg, false);
    }
  };

  const api: LionWorld = {
    mount(host: HTMLElement) {
      hostEl = host;
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0xf3e6c8, 0.018);
      scene.background = new THREE.Color(0xf7d9a8);

      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
      camera.position.set(-5, 3.4, 5.8);

      renderer = new THREE.WebGLRenderer({ antialias: !reduced, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, reduced ? 1.25 : 1.75));
      renderer.shadowMap.enabled = !reduced;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.appendChild(renderer.domElement);
      Object.assign(renderer.domElement.style, {
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none',
      });

      const hemi = new THREE.HemisphereLight(0xffe6c8, 0x6b3e26, 0.85);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffd6a0, 1.15);
      sun.position.set(-4, 12, 6);
      sun.castShadow = !reduced;
      if (!reduced) {
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 40;
        sun.shadow.camera.left = -12;
        sun.shadow.camera.right = 12;
        sun.shadow.camera.top = 12;
        sun.shadow.camera.bottom = -12;
      }
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xff8866, 0.35);
      fill.position.set(6, 4, -4);
      scene.add(fill);

      const street = buildStreet(scene, reduced);
      lanterns = street.lanterns;
      envelope = street.envelope;
      confetti = street.confetti;
      if (confetti) {
        const pos = confetti.geometry.getAttribute('position') as THREE.BufferAttribute;
        confettiVel = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) confettiVel[i] = 1 + Math.random() * 3;
      }

      lion = buildLion();
      lion.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = !reduced;
          o.receiveShadow = !reduced;
        }
      });
      scene.add(lion.root);

      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
      emitHud();
    },

    unmount() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      renderer = null;
      scene = null;
      camera = null;
      lion = null;
      hostEl = null;
      running = false;
    },

    start() {
      unlockAudio();
      sim = createSim();
      ended = false;
      fallEndTimer = 0;
      finishFxPlayed = false;
      prevHeld = {};
      paused = false;
      running = true;
      acc = 0;
      if (confetti) {
        confetti.visible = false;
        (confetti.material as THREE.PointsMaterial).opacity = 0;
      }
      if (envelope) {
        envelope.position.y = 3.4;
        envelope.rotation.z = 0;
      }
      emitHud();
    },

    setPaused(p: boolean) {
      paused = p;
    },

    setLeg(id, held) {
      unlockAudio();
      setLegHeld(sim, id, held);
    },

    restart() {
      this.start();
    },

    getUpOrRestart() {
      if (ended || (sim.fallen && fallEndTimer <= 0)) {
        this.restart();
        return;
      }
      if (sim.fallen) {
        getUpInPlace(sim);
        fallEndTimer = 0;
        emitHud();
        return;
      }
      this.restart();
    },

    onHud(cb) {
      hudCb = cb;
    },

    onRunEnd(cb) {
      endCb = cb;
    },
  };

  return api;
}
