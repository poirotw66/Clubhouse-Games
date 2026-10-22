import * as THREE from 'three';
import {
  comboSpeedBonus,
  createBeatState,
  formatOnBeatPercent,
  onBeatRatio,
  registerPlant,
  stepBeat,
  type BeatState,
} from './beat';
import {
  FIXED_DT,
  GHOST_SAMPLE_DT,
  KEY_TO_LEG,
  MAX_FRAME_DT,
  PIXEL_RATIO_CAP,
  PIXEL_RATIO_REDUCED,
  TIME_LIMIT,
  TRACK_LENGTH,
  type LegId,
  type PlayMode,
} from './constants';
import {
  playDrumTap,
  playFall,
  playFinishFanfare,
  playMetronomeDrum,
  playPerfect,
  setMuted as setAudioMuted,
  unlockAudio,
} from './audio';
import { applyLegPose, buildGhostMarker, buildLion, buildStreet, type LionMeshes } from './meshes';
import {
  createSim,
  getUpInPlace,
  setLegHeld,
  snapshotHudBase,
  stepPhysics,
  type HudSnapshot,
  type RunResult,
  type SimState,
} from './physics';
import { loadGhost, type GhostSample } from './storage';

export type { HudSnapshot, RunResult };
export { formatOnBeatPercent };

export interface WorldConfig {
  mode: PlayMode;
  muted: boolean;
  reducedMotion?: boolean;
}

export interface LionWorld {
  mount(host: HTMLElement): void;
  unmount(): void;
  start(config: WorldConfig): void;
  setPaused(paused: boolean): void;
  setMuted(muted: boolean): void;
  setLeg(id: LegId, held: boolean): void;
  restart(): void;
  getUpOrRestart(): void;
  getGhostSamples(): GhostSample[];
  onHud(cb: (hud: HudSnapshot) => void): void;
  onRunEnd(cb: (result: RunResult) => void): void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ghostXAt(samples: GhostSample[], t: number): number | null {
  if (!samples.length) return null;
  if (t <= samples[0]!.t) return samples[0]!.x;
  const last = samples[samples.length - 1]!;
  if (t >= last.t) return last.x;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if (t <= b.t) {
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return a.x + (b.x - a.x) * u;
    }
  }
  return last.x;
}

export function createLionWorld(): LionWorld {
  let reduced = prefersReducedMotion();
  let sim: SimState = createSim();
  let beat: BeatState = createBeatState();
  let mode: PlayMode = '1p';
  let muted = false;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let lion: LionMeshes | null = null;
  let envelope: THREE.Group | null = null;
  let confetti: THREE.Points | null = null;
  let sparkBurst: THREE.Points | null = null;
  let ghostMark: THREE.Group | null = null;
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
  let sparkVel: Float32Array | null = null;
  let finishFxPlayed = false;
  let perfectFlash = 0;
  let maxCombo = 0;
  let ghostSamples: GhostSample[] = [];
  let liveGhost: GhostSample[] = [];
  let ghostSampleAcc = 0;
  let camPos = new THREE.Vector3(-4.6, 3.1, 6.2);
  let camTarget = new THREE.Vector3(0.6, 1.35, 0);
  let visibilityPaused = false;

  function emitHud(): void {
    const base = snapshotHudBase(sim, TIME_LIMIT);
    hudCb?.({
      ...base,
      beatPulse: beat.pulse,
      combo: beat.combo,
      perfectFlash,
      onBeatRatio: onBeatRatio(beat.perfects, beat.plants),
      speedBonus: comboSpeedBonus(beat.combo),
    });
  }

  function buildResult(reason: RunResult['reason']): RunResult {
    return {
      reason,
      elapsed: reason === 'timeout' ? TIME_LIMIT : sim.elapsed,
      distance: Math.min(TRACK_LENGTH, sim.x),
      perfects: beat.perfects,
      plants: beat.plants,
      onBeatRatio: onBeatRatio(beat.perfects, beat.plants),
      maxCombo,
      mode,
    };
  }

  function endRun(reason: RunResult['reason']): void {
    if (ended) return;
    ended = true;
    paused = true;
    if (reason === 'fall') playFall();
    endCb?.(buildResult(reason));
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
    const { root, head, legs, flower } = lion;

    if (sim.fallen) {
      const wobble = Math.sin(sim.fallSpin * 2.2) * 0.25;
      root.position.set(sim.x, sim.y, wobble * 0.15);
      root.rotation.set(
        sim.pitch * 0.85,
        sim.fallSpin * (0.55 + sim.fallStyle * 0.35),
        sim.roll + Math.sin(sim.fallSpin * 1.6) * 0.55,
      );
    } else if (sim.finished) {
      const t = sim.finishAnim;
      root.position.set(sim.x, sim.y + Math.sin(t * 10) * 0.06 * (1 - t), 0);
      root.rotation.set(sim.pitch - t * 0.6, Math.sin(t * 6) * 0.08, sim.roll);
      head.rotation.x = -t * 1.05;
      head.position.y = 0.15 + t * 0.42;
      envelope.position.y = 3.4 - t * 1.75;
      envelope.rotation.z = t * 1.1;
      envelope.rotation.y = t * 2.2;
      if (t > 0.4 && confetti) {
        confetti.visible = true;
        const mat = confetti.material as THREE.PointsMaterial;
        mat.opacity = Math.min(1, (t - 0.4) * 2.5);
        if (!reduced && confettiVel) {
          const pos = confetti.geometry.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            pos.setY(i, pos.getY(i) + confettiVel[i]! * dt);
            confettiVel[i]! -= 10 * dt;
            pos.setX(i, pos.getX(i) + Math.sin(i + t * 12) * 0.55 * dt);
            pos.setZ(i, pos.getZ(i) + Math.cos(i * 0.7 + t * 9) * 0.4 * dt);
          }
          pos.needsUpdate = true;
        }
      }
      if (t > 0.35 && sparkBurst && sparkVel) {
        sparkBurst.visible = true;
        const mat = sparkBurst.material as THREE.PointsMaterial;
        mat.opacity = Math.min(1, (t - 0.35) * 3) * (1 - Math.max(0, t - 0.75) * 3);
        const pos = sparkBurst.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const ix = i * 3;
          // radial burst stored in vel as dx,dy,dz packed: we use 3 floats per particle in sparkVel
          pos.setX(i, pos.getX(i) + sparkVel[ix]! * dt);
          pos.setY(i, pos.getY(i) + sparkVel[ix + 1]! * dt);
          pos.setZ(i, pos.getZ(i) + sparkVel[ix + 2]! * dt);
          sparkVel[ix + 1]! -= 14 * dt;
        }
        pos.needsUpdate = true;
      }
      if (t > 0.15 && !finishFxPlayed) {
        finishFxPlayed = true;
        playFinishFanfare();
      }
    } else {
      root.position.set(sim.x, sim.y, 0);
      root.rotation.set(sim.pitch, 0, sim.roll);
      head.rotation.x = THREE.MathUtils.clamp(-sim.pitch * 0.3, -0.25, 0.25);
      // Drum pulse on flower
      const pulse = 1 + beat.pulse * 0.18;
      flower.scale.setScalar(pulse);
      if (!reduced) flower.rotation.y += dt * 1.4;
    }

    applyLegPose(legs, snapshotHudBase(sim, TIME_LIMIT).legLift, snapshotHudBase(sim, TIME_LIMIT).legSwing);

    // Ghost marker follows best-run distance at current elapsed
    if (ghostMark) {
      const gx = ghostXAt(ghostSamples, sim.elapsed);
      if (gx != null && gx > 0.5) {
        ghostMark.visible = true;
        ghostMark.position.set(gx, 0, 1.65);
        if (!reduced) ghostMark.rotation.y = Math.sin(performance.now() * 0.002) * 0.15;
      } else {
        ghostMark.visible = false;
      }
    }

    const wantPos = new THREE.Vector3(
      sim.x - 4.6,
      3.05 + Math.abs(sim.pitch) * 0.3 + (sim.fallen ? 0.35 : 0),
      6.15 + Math.abs(sim.roll) * 0.4,
    );
    const wantTarget = new THREE.Vector3(
      sim.x + 0.7,
      1.3 + (sim.fallen ? 0.45 : 0) + beat.pulse * 0.05,
      0,
    );
    if (reduced) {
      camPos.copy(wantPos);
      camTarget.copy(wantTarget);
    } else {
      const k = 1 - Math.pow(0.00012, dt);
      camPos.lerp(wantPos, k);
      camTarget.lerp(wantTarget, k);
    }
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    if (!reduced) {
      const t = performance.now() * 0.001;
      for (let i = 0; i < lanterns.length; i++) {
        lanterns[i]!.rotation.z = Math.sin(t * 1.4 + i) * 0.08;
      }
    }
  }

  function tick(now: number): void {
    raf = requestAnimationFrame(tick);
    if (!renderer || !scene || !camera) return;
    const frameDt = Math.min(MAX_FRAME_DT, (now - lastT) / 1000 || FIXED_DT);
    lastT = now;
    perfectFlash = Math.max(0, perfectFlash - frameDt * 2.8);

    if (!paused && running && !ended) {
      acc += frameDt;
      let guard = 0;
      while (acc >= FIXED_DT && guard++ < 12) {
        if (sim.elapsed + FIXED_DT >= TIME_LIMIT && !sim.finished && !sim.fallen) {
          sim.elapsed = TIME_LIMIT;
          endRun('timeout');
          break;
        }

        for (const id of ['FL', 'FR', 'BL', 'BR'] as LegId[]) {
          const held = sim.legs[id].held;
          if (held && !prevHeld[id]) playDrumTap();
          prevHeld[id] = held;
        }

        const fired = stepBeat(beat, sim.elapsed + FIXED_DT, FIXED_DT);
        if (fired && !sim.fallen && !sim.finished) playMetronomeDrum();

        const speedBonus = comboSpeedBonus(beat.combo);
        const { end, plantEvents } = stepPhysics(sim, FIXED_DT, {
          speedBonus,
          onPlant: (_leg, elapsed) => {
            const r = registerPlant(beat, elapsed);
            if (r.perfect) {
              perfectFlash = 1;
              maxCombo = Math.max(maxCombo, r.combo);
              playPerfect();
            }
            return { leg: _leg, ...r };
          },
        });
        void plantEvents;
        acc -= FIXED_DT;

        ghostSampleAcc += FIXED_DT;
        if (ghostSampleAcc >= GHOST_SAMPLE_DT) {
          ghostSampleAcc = 0;
          liveGhost.push({ t: sim.elapsed, x: sim.x });
        }

        if (end === 'finish') {
          fallEndTimer = 0;
        } else if (end === 'fall') {
          fallEndTimer = 1.4;
        }
      }

      if (sim.finished) {
        stepPhysics(sim, Math.min(frameDt, 0.05));
        if (sim.finishAnim >= 0.98) endRun('finish');
      }

      if (sim.fallen && fallEndTimer > 0) {
        fallEndTimer -= frameDt;
        if (fallEndTimer <= 0) endRun('fall');
      }

      emitHud();
    } else if (sim.finished && !ended) {
      stepPhysics(sim, Math.min(frameDt, 0.05));
      if (sim.finishAnim >= 0.98) endRun('finish');
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

  const onVisibility = (): void => {
    if (document.hidden) {
      visibilityPaused = true;
      paused = true;
    } else if (visibilityPaused && running && !ended) {
      visibilityPaused = false;
      paused = false;
      lastT = performance.now();
      acc = 0;
    }
  };

  const api: LionWorld = {
    mount(host: HTMLElement) {
      hostEl = host;
      reduced = prefersReducedMotion();
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0xf3e6c8, 0.018);
      scene.background = new THREE.Color(0xf7d9a8);

      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
      camera.position.copy(camPos);

      renderer = new THREE.WebGLRenderer({
        antialias: !reduced,
        alpha: false,
        powerPreference: 'high-performance',
      });
      const pr = Math.min(window.devicePixelRatio || 1, reduced ? PIXEL_RATIO_REDUCED : PIXEL_RATIO_CAP);
      renderer.setPixelRatio(pr);
      renderer.shadowMap.enabled = !reduced;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.appendChild(renderer.domElement);
      Object.assign(renderer.domElement.style, {
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none',
      });

      scene.add(new THREE.HemisphereLight(0xffe6c8, 0x6b3e26, 0.85));
      const sun = new THREE.DirectionalLight(0xffd6a0, 1.15);
      sun.position.set(-4, 12, 6);
      sun.castShadow = !reduced;
      if (!reduced) {
        sun.shadow.mapSize.set(512, 512);
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
      sparkBurst = street.sparkBurst;
      if (confetti) {
        const pos = confetti.geometry.getAttribute('position') as THREE.BufferAttribute;
        confettiVel = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) confettiVel[i] = 1.2 + Math.random() * 3.5;
      }
      if (sparkBurst) {
        const pos = sparkBurst.geometry.getAttribute('position') as THREE.BufferAttribute;
        sparkVel = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 2 + Math.random() * 5;
          sparkVel[i * 3] = Math.cos(a) * s;
          sparkVel[i * 3 + 1] = 3 + Math.random() * 5;
          sparkVel[i * 3 + 2] = Math.sin(a) * s;
        }
      }

      ghostMark = buildGhostMarker();
      scene.add(ghostMark);

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
      document.addEventListener('visibilitychange', onVisibility);
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
      emitHud();
    },

    unmount() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibility);
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

    start(config: WorldConfig) {
      mode = config.mode;
      muted = config.muted;
      setAudioMuted(muted);
      if (config.reducedMotion != null) reduced = config.reducedMotion;
      unlockAudio();
      sim = createSim();
      beat = createBeatState();
      ended = false;
      fallEndTimer = 0;
      finishFxPlayed = false;
      prevHeld = {};
      perfectFlash = 0;
      maxCombo = 0;
      liveGhost = [{ t: 0, x: 0 }];
      ghostSampleAcc = 0;
      ghostSamples = loadGhost(mode) ?? [];
      paused = false;
      running = true;
      visibilityPaused = false;
      acc = 0;
      if (confetti) {
        confetti.visible = false;
        (confetti.material as THREE.PointsMaterial).opacity = 0;
      }
      if (sparkBurst) {
        sparkBurst.visible = false;
        (sparkBurst.material as THREE.PointsMaterial).opacity = 0;
        // reset spark origins
        const pos = sparkBurst.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          pos.setXYZ(i, TRACK_LENGTH, 2.5, 0);
        }
        pos.needsUpdate = true;
      }
      if (envelope) {
        envelope.position.y = 3.4;
        envelope.rotation.set(0, 0, 0);
      }
      emitHud();
    },

    setPaused(p: boolean) {
      paused = p || visibilityPaused;
    },

    setMuted(m: boolean) {
      muted = m;
      setAudioMuted(m);
    },

    setLeg(id, held) {
      unlockAudio();
      setLegHeld(sim, id, held);
    },

    restart() {
      this.start({ mode, muted, reducedMotion: reduced });
    },

    getUpOrRestart() {
      if (ended || (sim.fallen && fallEndTimer <= 0)) {
        this.start({ mode, muted, reducedMotion: reduced });
        return;
      }
      if (sim.fallen) {
        getUpInPlace(sim);
        fallEndTimer = 0;
        emitHud();
        return;
      }
      this.start({ mode, muted, reducedMotion: reduced });
    },

    getGhostSamples() {
      return liveGhost;
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
