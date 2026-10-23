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
import {
  checkLionFramed,
  computeCameraFrame,
  projectObjectBounds,
  type FrameCheck,
} from './framing';
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
  /** Project lion AABB → screen; used by Playwright framing check. */
  checkFraming(): FrameCheck | null;
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
  let dustVel: Float32Array | null = null;
  let finishFxPlayed = false;
  let fallFxPlayed = false;
  let perfectFlash = 0;
  let maxCombo = 0;
  let ghostSamples: GhostSample[] = [];
  let liveGhost: GhostSample[] = [];
  let ghostSampleAcc = 0;
  let camX = 0;
  let frame = computeCameraFrame(16 / 9);
  let blinkT = 0;
  let idleT = 0;
  let visibilityPaused = false;
  let flowerWorld = new THREE.Vector3();
  let flowerVel = new THREE.Vector3();
  let flowerDetached = false;

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
    endCb?.(buildResult(reason));
  }

  function applyCameraRig(followX: number): void {
    if (!camera) return;
    // Stable horizon: fixed Y / lookY, only X follows — no roll/tilt.
    camera.fov = frame.fov;
    camera.updateProjectionMatrix();
    camera.position.set(followX, frame.camY, frame.distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(followX + frame.lookAhead, frame.lookY, 0);
  }

  function resize(): void {
    if (!renderer || !camera || !hostEl) return;
    const w = hostEl.clientWidth || window.innerWidth;
    const h = hostEl.clientHeight || window.innerHeight;
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    frame = computeCameraFrame(aspect);
    camera.fov = frame.fov;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    applyCameraRig(camX);
  }

  function triggerDust(): void {
    if (!lion?.dust || reduced) return;
    const dust = lion.dust;
    dust.visible = true;
    const mat = dust.material as THREE.PointsMaterial;
    mat.opacity = 0.85;
    const pos = dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    dustVel = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, (Math.random() - 0.5) * 0.4, Math.random() * 0.15, (Math.random() - 0.5) * 0.4);
      dustVel[i * 3] = (Math.random() - 0.5) * 2.5;
      dustVel[i * 3 + 1] = 1.5 + Math.random() * 2.5;
      dustVel[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
    }
    pos.needsUpdate = true;
    dust.position.set(sim.x, 0.1, 0);
  }

  function syncMeshes(dt: number): void {
    if (!lion || !camera || !envelope) return;
    const { root, head, legs, flower, flowerHome, shadow, leftEye, rightEye, leftEar, rightEar, tail, jaw, dust } =
      lion;

    idleT += dt;
    blinkT -= dt;
    if (blinkT < -2.5 - Math.random()) blinkT = 0.12;
    const eyeScale = blinkT > 0 ? 0.12 : 1;
    leftEye.scale.set(1, eyeScale, 1);
    rightEye.scale.set(1, eyeScale, 1);

    if (!reduced) {
      leftEar.rotation.z = Math.sin(idleT * 3.2) * 0.14;
      rightEar.rotation.z = Math.sin(idleT * 3.2 + 0.8) * 0.14;
      tail.rotation.y = Math.sin(idleT * 2.4) * 0.4;
      jaw.rotation.x = Math.sin(idleT * 1.6) * 0.08;
    }

    const hudSnap = snapshotHudBase(sim, TIME_LIMIT);

    if (attract) {
      root.position.set(2.5, sim.y, 0);
      root.rotation.set(0, 0, 0);
      root.scale.set(1, 1, 1);
      for (const id of ['FL', 'FR', 'BL', 'BR'] as LegId[]) {
        const phase = idleT * 2.2 + (id === 'FL' || id === 'BR' ? 0 : Math.PI);
        sim.legs[id].lift = 0.15 + Math.max(0, Math.sin(phase)) * 0.35;
        sim.legs[id].swing = Math.sin(phase) * 0.4;
      }
      applyLegPose(legs, hudSnap.legLift, hudSnap.legSwing);
      if (!flowerDetached) {
        flower.position.copy(flowerHome);
        flower.rotation.set(0, idleT * 1.1, 0);
        flower.scale.setScalar(1.05 + beat.pulse * 0.1);
      }
      shadow.position.set(root.position.x, 0.02, 0);
      camX += (2.5 - camX) * Math.min(1, dt * 3);
      applyCameraRig(camX);
      return;
    }

    if (sim.fallen) {
      const side = sim.fallSide || 1;
      const land = Math.min(1, sim.fallSpin * 0.7);
      // Squash on impact
      const squash = 1 - 0.14 * Math.sin(Math.min(1, sim.fallBounce) * Math.PI);
      root.scale.set(1 + (1 - squash) * 0.12, squash, 1 + (1 - squash) * 0.18);
      // Roll around X (track axis) so the long body stays horizontal on screen
      // while tipping onto its side toward/away from the camera.
      root.position.set(sim.x, Math.max(0.55, 0.55 + sim.y * 0.15 * (1 - land)), side * 0.35 * land);
      root.rotation.set(
        side * (Math.PI / 2) * land + Math.sin(sim.fallSpin * 1.5) * 0.08 * (1 - land),
        0,
        THREE.MathUtils.clamp(sim.pitch * 0.25, -0.35, 0.25),
      );
      // 花花 flung in an arc (world-ish local)
      if (!flowerDetached) {
        flowerDetached = true;
        flowerWorld.set(0.2, 1.2, 0);
        flowerVel.set(-side * 2.2, 5.5, side * 1.8);
      }
      flowerVel.y -= 14 * dt;
      flowerWorld.x += flowerVel.x * dt;
      flowerWorld.y += flowerVel.y * dt;
      flowerWorld.z += flowerVel.z * dt;
      if (flowerWorld.y < 0.15) {
        flowerWorld.y = 0.15;
        flowerVel.y *= -0.35;
        flowerVel.x *= 0.7;
      }
      flower.position.copy(flowerWorld);
      flower.rotation.set(sim.fallSpin * 2.1, sim.fallSpin * 1.7, sim.fallSpin);
      applyLegPose(legs, hudSnap.legLift, hudSnap.legSwing, sim.fallSpin, true);

      if (dust && dustVel && dust.visible) {
        const mat = dust.material as THREE.PointsMaterial;
        mat.opacity = Math.max(0, mat.opacity - dt * 0.7);
        const pos = dust.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          pos.setX(i, pos.getX(i) + dustVel[i * 3]! * dt);
          pos.setY(i, pos.getY(i) + dustVel[i * 3 + 1]! * dt);
          pos.setZ(i, pos.getZ(i) + dustVel[i * 3 + 2]! * dt);
          dustVel[i * 3 + 1]! -= 8 * dt;
        }
        pos.needsUpdate = true;
        if (mat.opacity <= 0.02) dust.visible = false;
      }
    } else if (sim.finished) {
      root.scale.set(1, 1, 1);
      flowerDetached = false;
      const t = sim.finishAnim;
      root.position.set(sim.x, sim.y + Math.sin(t * 10) * 0.08 * (1 - t), 0);
      root.rotation.set(-t * 0.55, 0, 0);
      head.rotation.x = -t * 0.95;
      head.position.y = 0.55 + t * 0.45;
      envelope.position.y = 4.0 - t * 2.0;
      envelope.rotation.z = t * 1.2;
      flower.position.copy(flowerHome);
      flower.rotation.set(0, 0, 0);
      applyLegPose(legs, hudSnap.legLift, hudSnap.legSwing);
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
      root.scale.set(1, 1, 1);
      flowerDetached = false;
      root.position.set(sim.x, sim.y, 0);
      // Subtle body lean only — camera horizon stays level
      root.rotation.set(sim.pitch * 0.75, 0, sim.roll * 0.8);
      head.rotation.x = THREE.MathUtils.clamp(-sim.pitch * 0.2, -0.18, 0.18);
      flower.position.copy(flowerHome);
      flower.rotation.set(0, reduced ? 0 : idleT * 1.2, 0);
      flower.scale.setScalar(1.05 + beat.pulse * 0.18);
      applyLegPose(legs, hudSnap.legLift, hudSnap.legSwing);
    }

    shadow.position.set(root.position.x, 0.02, root.position.z);
    shadow.scale.setScalar(sim.fallen ? 1.55 : 1 + Math.abs(sim.pitch) * 0.15);

    if (ghostMark) {
      const gx = ghostXAt(ghostSamples, sim.elapsed);
      if (gx != null && gx > 0.5) {
        ghostMark.visible = true;
        ghostMark.position.set(gx, 0, 2.4);
      } else ghostMark.visible = false;
    }

    // Smooth horizontal follow only
    const targetX = sim.x + (attract ? 0 : 0.55);
    const follow = reduced ? 1 : 1 - Math.pow(0.00005, dt);
    camX += (targetX - camX) * follow;
    applyCameraRig(camX);

    if (!reduced && lanterns.length) {
      const t = performance.now() * 0.001;
      for (let i = 0; i < lanterns.length; i++) {
        lanterns[i]!.rotation.z = Math.sin(t * 1.1 + i) * 0.08;
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
          if (!fallFxPlayed) {
            fallFxPlayed = true;
            playFall();
            triggerDust();
          }
        }
      }

      if (sim.finished) {
        stepPhysics(sim, Math.min(frameDt, 0.05), {
          speedBonus: 0,
          assist,
          onPlant: () => ({ leg: 'FL', perfect: false, combo: 0, bonusImpulse: 0 }),
        });
        if (sim.finishAnim >= 0.98) endRun('finish');
      }

      if (sim.fallen && fallEndTimer > 0) {
        fallEndTimer -= frameDt;
        if (fallEndTimer <= 0) endRun('fall');
      }

      emitHud();
    } else if (sim.finished && !ended) {
      stepPhysics(sim, Math.min(frameDt, 0.05), {
        speedBonus: 0,
        assist,
        onPlant: () => ({ leg: 'FL', perfect: false, combo: 0, bonusImpulse: 0 }),
      });
      if (sim.finishAnim >= 0.98) endRun('finish');
      emitHud();
    } else if (sim.fallen && !ended) {
      stepPhysics(sim, Math.min(frameDt, 0.05), {
        speedBonus: 0,
        assist,
        onPlant: () => ({ leg: 'FL', perfect: false, combo: 0, bonusImpulse: 0 }),
      });
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
      // Soft far fog only — no beige haze / vignette
      scene.fog = new THREE.Fog(0xd8eef8, 70, 110);
      scene.background = new THREE.Color(0xb8e4f8);

      frame = computeCameraFrame(16 / 9);
      camera = new THREE.PerspectiveCamera(frame.fov, 1, 0.1, 160);
      applyCameraRig(0);

      renderer = new THREE.WebGLRenderer({
        antialias: !reduced,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, reduced ? PIXEL_RATIO_REDUCED : PIXEL_RATIO_CAP),
      );
      // Blob shadow only — skip shadow maps for mobile/perf
      renderer.shadowMap.enabled = false;
      host.appendChild(renderer.domElement);
      Object.assign(renderer.domElement.style, {
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none',
      });

      scene.add(new THREE.HemisphereLight(0xfff6e8, 0xa8d0a0, 1.05));
      const sun = new THREE.DirectionalLight(0xfff4dc, 1.15);
      sun.position.set(-5, 18, 12);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xc8e4ff, 0.45);
      fill.position.set(8, 5, 6);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xfff0c8, 0.35);
      rim.position.set(-2, 3, -8);
      scene.add(rim);

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
      fallFxPlayed = false;
      flowerDetached = false;
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
      if (lion) {
        lion.flower.position.copy(lion.flowerHome);
        lion.flower.rotation.set(0, 0, 0);
        if (lion.dust) {
          lion.dust.visible = false;
          (lion.dust.material as THREE.PointsMaterial).opacity = 0;
        }
        lion.root.scale.set(1, 1, 1);
      }
      if (confetti) {
        confetti.visible = false;
        (confetti.material as THREE.PointsMaterial).opacity = 0;
      }
      if (sparkBurst) {
        sparkBurst.visible = false;
        (sparkBurst.material as THREE.PointsMaterial).opacity = 0;
      }
      if (envelope) {
        envelope.position.y = 4.0;
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
        fallFxPlayed = false;
        flowerDetached = false;
        if (lion) {
          lion.flower.position.copy(lion.flowerHome);
          lion.flower.rotation.set(0, 0, 0);
          lion.root.scale.set(1, 1, 1);
        }
        paused = false;
        emitHud();
        return;
      }
      this.start({ mode, muted, assist, reducedMotion: reduced });
    },

    getGhostSamples() {
      return liveGhost;
    },

    checkFraming() {
      if (!lion || !camera) return null;
      lion.root.updateWorldMatrix(true, true);
      camera.updateMatrixWorld(true);
      // Prefer a tight core box (body+head+feet) so mane outlines don't force
      // an overly long pull-back — still fail if that core is cropped.
      const core = lion.root.getObjectByName('frameCore') ?? lion.root;
      const bounds = projectObjectBounds(core, camera);
      return checkLionFramed(bounds);
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
