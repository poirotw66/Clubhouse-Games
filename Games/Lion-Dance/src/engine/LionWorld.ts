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
  FALL_GRACE,
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
  assist: boolean;
  /** Attract / title idle — no sim ticking, just animate. */
  attract?: boolean;
  reducedMotion?: boolean;
}

export interface LionWorld {
  mount(host: HTMLElement): void;
  unmount(): void;
  start(config: WorldConfig): void;
  setPaused(paused: boolean): void;
  setMuted(muted: boolean): void;
  setAssist(assist: boolean): void;
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
  let assist = false;
  let attract = false;
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
  let camX = 0;
  let blinkT = 0;
  let idleT = 0;
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
      fallCount: sim.fallCount,
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
    const { root, body, head, legs, flower, shadow, leftEye, rightEye, leftEar, rightEar, tail, jaw } =
      lion;

    idleT += dt;
    blinkT -= dt;
    if (blinkT < -2.5 - Math.random()) blinkT = 0.12;
    const eyeScale = blinkT > 0 ? 0.15 : 1;
    leftEye.scale.set(1, eyeScale, 1);
    rightEye.scale.set(1, eyeScale, 1);

    if (!reduced) {
      leftEar.rotation.z = Math.sin(idleT * 3.2) * 0.12;
      rightEar.rotation.z = Math.sin(idleT * 3.2 + 0.8) * 0.12;
      tail.rotation.y = Math.sin(idleT * 2.4) * 0.35;
      jaw.rotation.x = Math.sin(idleT * 1.6) * 0.06;
    }

    if (attract) {
      root.position.set(2.5, sim.y, 0);
      root.rotation.set(0, 0, Math.sin(idleT * 0.8) * 0.04);
      // Gentle marching idle
      for (const id of ['FL', 'FR', 'BL', 'BR'] as LegId[]) {
        const phase = idleT * 2.2 + (id === 'FL' || id === 'BR' ? 0 : Math.PI);
        sim.legs[id].lift = 0.15 + Math.max(0, Math.sin(phase)) * 0.35;
        sim.legs[id].swing = Math.sin(phase) * 0.4;
      }
      applyLegPose(legs, snapshotHudBase(sim, TIME_LIMIT).legLift, snapshotHudBase(sim, TIME_LIMIT).legSwing);
      flower.scale.setScalar(1 + beat.pulse * 0.1);
      shadow.position.set(root.position.x, 0.02, 0);
      camX += (2.5 - camX) * Math.min(1, dt * 3);
      camera.position.set(camX + 0.4, 3.6, 11.5);
      camera.lookAt(camX + 1.2, 2.0, 0);
      return;
    }

    if (sim.fallen) {
      const side = Math.sign(sim.roll) || 1;
      root.position.set(sim.x, Math.max(0.55, sim.y * 0.45), side * 0.15);
      root.rotation.set(
        THREE.MathUtils.clamp(sim.pitch, -0.6, 0.4),
        0,
        side * (Math.PI / 2) * Math.min(1, sim.fallSpin * 0.55) + Math.sin(sim.fallSpin * 2) * 0.15,
      );
      // 花花 flung
      flower.position.set(
        -0.05 + Math.sin(sim.fallSpin * 2) * 0.8,
        0.78 + Math.abs(Math.sin(sim.fallSpin)) * 0.9,
        Math.cos(sim.fallSpin * 1.5) * 0.6,
      );
      flower.rotation.set(sim.fallSpin, sim.fallSpin * 1.3, sim.fallSpin * 0.7);
    } else if (sim.finished) {
      const t = sim.finishAnim;
      root.position.set(sim.x, sim.y + Math.sin(t * 10) * 0.08 * (1 - t), 0);
      root.rotation.set(-t * 0.55, 0, Math.sin(t * 5) * 0.05);
      head.rotation.x = -t * 0.95;
      head.position.y = 0.35 + t * 0.55;
      envelope.position.y = 4.2 - t * 2.1;
      envelope.rotation.z = t * 1.2;
      flower.position.set(-0.05, 0.78, 0);
      flower.rotation.set(0, 0, 0);
      if (t > 0.35 && confetti) {
        confetti.visible = true;
        (confetti.material as THREE.PointsMaterial).opacity = Math.min(1, (t - 0.35) * 2.5);
        if (!reduced && confettiVel) {
          const pos = confetti.geometry.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            pos.setY(i, pos.getY(i) + confettiVel[i]! * dt);
            confettiVel[i]! -= 11 * dt;
            pos.setX(i, pos.getX(i) + Math.sin(i + t * 10) * 0.5 * dt);
          }
          pos.needsUpdate = true;
        }
      }
      if (t > 0.3 && sparkBurst && sparkVel) {
        sparkBurst.visible = true;
        const mat = sparkBurst.material as THREE.PointsMaterial;
        mat.opacity = Math.min(1, (t - 0.3) * 3) * (1 - Math.max(0, t - 0.75) * 3);
        const pos = sparkBurst.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          pos.setX(i, pos.getX(i) + sparkVel[i * 3]! * dt);
          pos.setY(i, pos.getY(i) + sparkVel[i * 3 + 1]! * dt);
          pos.setZ(i, pos.getZ(i) + sparkVel[i * 3 + 2]! * dt);
          sparkVel[i * 3 + 1]! -= 14 * dt;
        }
        pos.needsUpdate = true;
      }
      if (t > 0.12 && !finishFxPlayed) {
        finishFxPlayed = true;
        playFinishFanfare();
      }
    } else {
      root.position.set(sim.x, sim.y, 0);
      root.rotation.set(sim.pitch * 0.85, 0, sim.roll * 0.9);
      head.rotation.x = THREE.MathUtils.clamp(-sim.pitch * 0.25, -0.2, 0.2);
      flower.position.set(-0.05, 0.78, 0);
      flower.rotation.set(0, reduced ? 0 : idleT * 1.2, 0);
      flower.scale.setScalar(1 + beat.pulse * 0.2);
    }

    applyLegPose(legs, snapshotHudBase(sim, TIME_LIMIT).legLift, snapshotHudBase(sim, TIME_LIMIT).legSwing);
    shadow.position.set(root.position.x, 0.02, 0);
    shadow.scale.setScalar(sim.fallen ? 1.4 : 1 + Math.abs(sim.pitch) * 0.2);

    if (ghostMark) {
      const gx = ghostXAt(ghostSamples, sim.elapsed);
      if (gx != null && gx > 0.5) {
        ghostMark.visible = true;
        ghostMark.position.set(gx, 0, 2.2);
      } else ghostMark.visible = false;
    }

    // Side-on chase: camera on +Z looking at origin Z, follow X
    const targetX = sim.x + 0.8;
    const follow = reduced ? 1 : 1 - Math.pow(0.00008, dt);
    camX += (targetX - camX) * follow;
    camera.position.set(camX, 3.55, 11.8);
    camera.lookAt(camX + 0.6, 2.05, 0);

    if (!reduced) {
      const t = performance.now() * 0.001;
      for (let i = 0; i < lanterns.length; i++) {
        lanterns[i]!.rotation.z = Math.sin(t * 1.3 + i) * 0.1;
      }
    }
  }

  function tick(now: number): void {
    raf = requestAnimationFrame(tick);
    if (!renderer || !scene || !camera) return;
    const frameDt = Math.min(MAX_FRAME_DT, (now - lastT) / 1000 || FIXED_DT);
    lastT = now;
    perfectFlash = Math.max(0, perfectFlash - frameDt * 2.8);

    if (attract) {
      stepBeat(beat, idleT, frameDt);
      syncMeshes(frameDt);
      renderer.render(scene, camera);
      return;
    }

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
        const { end } = stepPhysics(sim, FIXED_DT, {
          speedBonus,
          assist,
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
        acc -= FIXED_DT;

        ghostSampleAcc += FIXED_DT;
        if (ghostSampleAcc >= GHOST_SAMPLE_DT) {
          ghostSampleAcc = 0;
          liveGhost.push({ t: sim.elapsed, x: sim.x });
        }

        if (end === 'finish') fallEndTimer = 0;
        else if (end === 'fall') {
          fallEndTimer = FALL_GRACE;
          playFall();
        }
      }

      if (sim.finished) {
        stepPhysics(sim, Math.min(frameDt, 0.05), { speedBonus: 0, assist, onPlant: () => ({ leg: 'FL', perfect: false, combo: 0, bonusImpulse: 0 }) });
        if (sim.finishAnim >= 0.98) endRun('finish');
      }

      if (sim.fallen && fallEndTimer > 0) {
        fallEndTimer -= frameDt;
        if (fallEndTimer <= 0) endRun('fall');
      }

      emitHud();
    } else if (sim.finished && !ended) {
      stepPhysics(sim, Math.min(frameDt, 0.05), { speedBonus: 0, assist, onPlant: () => ({ leg: 'FL', perfect: false, combo: 0, bonusImpulse: 0 }) });
      if (sim.finishAnim >= 0.98) endRun('finish');
      emitHud();
    } else if (sim.fallen && !ended) {
      // Keep flop anim ticking while waiting for get-up / grace
      stepPhysics(sim, Math.min(frameDt, 0.05), { speedBonus: 0, assist, onPlant: () => ({ leg: 'FL', perfect: false, combo: 0, bonusImpulse: 0 }) });
      emitHud();
    }

    syncMeshes(frameDt);
    renderer.render(scene, camera);
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat || attract) return;
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
    if (attract) return;
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
    mount(host) {
      hostEl = host;
      reduced = prefersReducedMotion();
      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0xc8e4f0, 55, 95);
      scene.background = new THREE.Color(0x9ed4ef);

      // Narrow FOV ≈ orthographic side view
      camera = new THREE.PerspectiveCamera(32, 1, 0.1, 140);
      camera.position.set(0, 3.55, 11.8);

      renderer = new THREE.WebGLRenderer({
        antialias: !reduced,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, reduced ? PIXEL_RATIO_REDUCED : PIXEL_RATIO_CAP));
      renderer.shadowMap.enabled = !reduced;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.appendChild(renderer.domElement);
      Object.assign(renderer.domElement.style, {
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none',
      });

      scene.add(new THREE.HemisphereLight(0xfff0d8, 0x5a8a4a, 0.95));
      const sun = new THREE.DirectionalLight(0xfff2d0, 1.25);
      sun.position.set(-6, 16, 10);
      sun.castShadow = !reduced;
      if (!reduced) {
        sun.shadow.mapSize.set(512, 512);
        sun.shadow.camera.near = 2;
        sun.shadow.camera.far = 50;
        sun.shadow.camera.left = -16;
        sun.shadow.camera.right = 16;
        sun.shadow.camera.top = 12;
        sun.shadow.camera.bottom = -8;
      }
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xa8d4ff, 0.4);
      fill.position.set(8, 4, 6);
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

    start(config) {
      mode = config.mode;
      muted = config.muted;
      assist = config.assist;
      attract = !!config.attract;
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
      ghostSamples = attract ? [] : loadGhost(mode) ?? [];
      paused = attract ? true : false;
      running = !attract;
      visibilityPaused = false;
      acc = 0;
      idleT = 0;
      if (confetti) {
        confetti.visible = false;
        (confetti.material as THREE.PointsMaterial).opacity = 0;
      }
      if (sparkBurst) {
        sparkBurst.visible = false;
        (sparkBurst.material as THREE.PointsMaterial).opacity = 0;
      }
      if (envelope) {
        envelope.position.y = 4.2;
        envelope.rotation.set(0, 0, 0);
      }
      emitHud();
    },

    setPaused(p) {
      if (attract) return;
      paused = p || visibilityPaused;
    },

    setMuted(m) {
      muted = m;
      setAudioMuted(m);
    },

    setAssist(a) {
      assist = a;
    },

    setLeg(id, held) {
      if (attract) return;
      unlockAudio();
      setLegHeld(sim, id, held);
    },

    restart() {
      this.start({ mode, muted, assist, reducedMotion: reduced });
    },

    getUpOrRestart() {
      if (ended) {
        this.start({ mode, muted, assist, reducedMotion: reduced });
        return;
      }
      if (sim.fallen) {
        getUpInPlace(sim);
        fallEndTimer = 0;
        paused = false;
        emitHud();
        return;
      }
      this.start({ mode, muted, assist, reducedMotion: reduced });
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
