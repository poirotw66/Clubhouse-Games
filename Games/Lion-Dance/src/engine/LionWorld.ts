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
  LEG_IDS,
  LION_SCALE,
  MAX_FRAME_DT,
  PIXEL_RATIO_CAP,
  PIXEL_RATIO_REDUCED,
  TIME_LIMIT,
  TRACK_LENGTH,
  restBodyHeight,
  type LegId,
  type PlayMode,
} from './constants';
import {
  playDrum,
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
  DIST_FOLLOW_RATE,
  FOLLOW_RATE,
  projectObjectBounds,
  projectWorldToUv,
  type CameraFrame,
  type FrameCheck,
} from './framing';
import { applyLegPose, buildGhostMarker, buildLion, buildStreet, type LionMeshes } from './meshes';
import {
  beginGetUp,
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
  /** Foot sole UV [0,1] for HUD overlap asserts (top-left Y). */
  projectFeet(): Record<LegId, { x: number; y: number }> | null;
  /** Playtest helper — FK angles / world hip-knee-foot. */
  debugLegs(): Record<string, unknown> | null;
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
  let camDist = 7.5;
  let frame: CameraFrame = computeCameraFrame(16 / 9);
  let sun: THREE.DirectionalLight | null = null;
  let padViewOffset = 0;
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
      maxSpeed: sim.maxSpeed,
      steps: sim.stepCount,
    };
  }

  function endRun(reason: RunResult['reason']): void {
    if (ended) return;
    ended = true;
    paused = true;
    endCb?.(buildResult(reason));
  }

  function applyCameraRig(followX: number): void {
    if (!camera || !hostEl) return;
    camera.fov = frame.fov;
    const w = hostEl.clientWidth || window.innerWidth;
    const h = hostEl.clientHeight || window.innerHeight;
    // Taller virtual canvas; viewport is the LOWER band (offsetY = pad) so
    // world content shifts UP on screen and clears the touch pad.
    const padPx = Math.max(padViewOffset || h * frame.padFrac, h * frame.padFrac);
    camera.setViewOffset(w, h + padPx, 0, padPx, w, h);
    camera.updateProjectionMatrix();
    const d = camDist;
    const ahead = followX + frame.aheadFrac * d;
    camera.position.set(ahead, frame.camY, d);
    camera.up.set(0, 1, 0);
    camera.lookAt(followX, frame.lookY, 0);
    if (sun) {
      sun.position.set(ahead + 3, frame.lookY + 8, d * 0.15 + 6);
      sun.target.position.set(followX, frame.lookY, 0);
      sun.target.updateMatrixWorld();
    }
  }

  function resize(): void {
    if (!renderer || !camera || !hostEl) return;
    const w = hostEl.clientWidth || window.innerWidth;
    const h = hostEl.clientHeight || window.innerHeight;
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    frame = computeCameraFrame(aspect);
    camDist = frame.distance;
    padViewOffset = Math.min(300, Math.max(160, h * frame.padFrac));
    camera.fov = frame.fov;
    renderer.setSize(w, h, false);
    applyCameraRig(camX);
  }

  function triggerDust(atX: number, impact = 1): void {
    if (!lion?.dust || reduced) return;
    const dust = lion.dust;
    dust.visible = true;
    const mat = dust.material as THREE.PointsMaterial;
    const power = Math.max(0.35, Math.min(1.2, 0.5 + impact / 1.2));
    mat.opacity = 0.7 * power;
    mat.size = 0.12 + 0.2 * power;
    const pos = dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    dustVel = new Float32Array(pos.count * 3);
    const n = Math.min(pos.count, 12);
    for (let i = 0; i < pos.count; i++) {
      if (i < n) {
        pos.setXYZ(i, (Math.random() - 0.5) * 0.35, Math.random() * 0.12, (Math.random() - 0.5) * 0.3);
        dustVel[i * 3] = -0.8 - Math.random() * 1.2;
        dustVel[i * 3 + 1] = 0.4 + Math.random() * 0.8;
        dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
      } else {
        pos.setXYZ(i, 0, -10, 0);
        dustVel[i * 3] = 0;
        dustVel[i * 3 + 1] = 0;
        dustVel[i * 3 + 2] = 0;
      }
    }
    pos.needsUpdate = true;
    dust.position.set(atX, 0.08, 0);
  }

  function syncMeshes(dt: number): void {
    if (!lion || !camera || !envelope) return;
    const {
      root,
      cloth,
      frontHump,
      rearHump,
      frontHumpHomeY,
      rearHumpHomeY,
      hem,
      head,
      headHomeY,
      legs,
      flower,
      flowerHome,
      shadow,
      leftEye,
      rightEye,
      leftEar,
      rightEar,
      tail,
      jaw,
      mouthSmile,
      mouthO,
      dust,
    } = lion;

    idleT += dt;
    blinkT -= dt;
    if (blinkT < -2.5 - Math.random()) blinkT = 0.1;
    // Blink: squash eye groups on Y (kawaii ovals close)
    // Fall: slightly bigger DARK ovals (keep oval ratio — never round “googly” spheres)
    const blinking = blinkT > 0 && !sim.fallen;
    const eyeY = blinking ? 0.12 : sim.fallen ? 1.35 : 1;
    const eyeXZ = sim.fallen ? 1.05 : 1;
    leftEye.scale.set(eyeXZ, eyeY, eyeXZ);
    rightEye.scale.set(eyeXZ, eyeY, eyeXZ);
    // Surprised 'O' mouth while fallen; soft smile otherwise
    mouthSmile.visible = !sim.fallen;
    mouthO.visible = sim.fallen;

    const hudSnap = snapshotHudBase(sim, TIME_LIMIT);
    const frontLift = (hudSnap.legLift.FL + hudSnap.legLift.FR) * 0.5;
    const rearLift = (hudSnap.legLift.BL + hudSnap.legLift.BR) * 0.5;
    const avgLift = (frontLift + rearLift) * 0.5;
    const gaitBob =
      Math.sin(sim.elapsed * 10 + sim.stepCount * 0.7) *
      0.04 *
      Math.min(1, Math.abs(sim.vx) * 1.8 + (attract ? 0.4 : 0));
    const headBobY = headHomeY + avgLift * 0.06 + gaitBob;

    if (!reduced) {
      leftEar.rotation.z = Math.sin(idleT * 3.2) * 0.14;
      rightEar.rotation.z = Math.sin(idleT * 3.2 + 0.8) * 0.14;
      tail.rotation.y = Math.sin(idleT * 2.4) * 0.4;
      // Hem sway + two-hump undulation (out of phase with front/rear steps)
      hem.rotation.z = Math.sin(idleT * 2.8) * 0.04 + (frontLift - rearLift) * 0.03;
      hem.position.y = 0.02 + Math.sin(idleT * 3.1) * 0.03;
      frontHump.position.y =
        frontHumpHomeY + frontLift * 0.12 + Math.sin(idleT * 3.4 + 0.4) * 0.03;
      rearHump.position.y =
        rearHumpHomeY + rearLift * 0.12 + Math.sin(idleT * 3.4 + 2.2) * 0.03;
      // Hinged mouth opens slightly on front steps
      jaw.rotation.x = sim.fallen
        ? 0.25
        : 0.04 + frontLift * 0.22 + Math.sin(idleT * 1.6) * 0.03;
    } else {
      frontHump.position.y = frontHumpHomeY;
      rearHump.position.y = rearHumpHomeY;
      hem.rotation.z = 0;
      hem.position.y = 0.02;
      jaw.rotation.x = sim.fallen ? 0.2 : 0.05;
    }

    if (attract) {
      root.position.set(1.2, sim.y, 0);
      root.rotation.set(0, 0, 0);
      root.scale.setScalar(LION_SCALE);
      cloth.rotation.set(0, 0, 0);
      cloth.position.set(0, 0, 0);
      for (const id of ['FL', 'FR', 'BL', 'BR'] as LegId[]) {
        const phase = idleT * 2.2 + (id === 'FL' || id === 'BR' ? 0 : Math.PI);
        sim.legs[id].lift = 0.2 + Math.max(0, Math.sin(phase)) * 0.55;
        sim.legs[id].swing = Math.sin(phase) * 0.45;
      }
      const attractHud = snapshotHudBase(sim, TIME_LIMIT);
      applyLegPose(legs, attractHud.legLift, attractHud.legSwing);
      const aFront = (attractHud.legLift.FL + attractHud.legLift.FR) * 0.5;
      head.position.y = headHomeY + aFront * 0.04 + Math.sin(idleT * 4) * 0.03;
      head.rotation.x = Math.sin(idleT * 2.2) * 0.04 - aFront * 0.06;
      if (!flowerDetached) {
        flower.position.copy(flowerHome);
        flower.rotation.set(0, idleT * 1.1, 0);
        flower.scale.setScalar(1.05 + beat.pulse * 0.1);
      }
      shadow.position.set(root.position.x, 0.02, 0);
      camX += (1.2 - camX) * Math.min(1, dt * 3);
      applyCameraRig(camX);
      return;
    }

    if (sim.fallen) {
      const side = sim.fallSide || 1;
      const land = Math.min(1, Math.max(0.55, sim.fallSpin * 1.4));
      // Force a clear side-lie toward the camera (~±1.45 rad on X), not a belly flop
      const sideRoll = side * -1.45;
      const showRoll = sim.roll * (1 - land) + sideRoll * land;
      root.scale.setScalar(LION_SCALE);
      root.position.set(sim.x, Math.max(0.48, sim.y * 0.85 + 0.2), sim.lateral * 0.25);
      root.rotation.set(showRoll, sim.yaw * 0.2, sim.pitch * 0.35);
      cloth.rotation.set(0, 0, 0);
      cloth.position.set(0, 0, 0);
      hem.position.y = 0.02;
      hem.rotation.z = 0;
      frontHump.position.y = frontHumpHomeY;
      rearHump.position.y = rearHumpHomeY;
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
      applyLegPose(legs, hudSnap.legLift, hudSnap.legSwing, sim.fallSpin, true, side);
      head.position.y = headHomeY;
      head.rotation.x = -0.08;

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
      root.scale.setScalar(LION_SCALE);
      flowerDetached = false;
      cloth.rotation.set(0, 0, 0);
      cloth.position.set(0, 0, 0);
      const t = sim.finishAnim;
      root.position.set(sim.x, sim.y + Math.sin(t * 10) * 0.08 * (1 - t), 0);
      root.rotation.set(-t * 0.55, 0, 0);
      head.rotation.x = -t * 0.95;
      head.position.y = headHomeY + t * 0.45;
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
      root.scale.setScalar(LION_SCALE);
      flowerDetached = false;
      root.position.set(sim.x, sim.y, sim.lateral * 0.2);
      // Pitch / roll match physics 1:1 (camera horizon stays level)
      root.rotation.set(sim.roll, sim.yaw * 0.25, sim.pitch);
      cloth.rotation.set(0, 0, 0);
      cloth.position.set(0, 0, 0);
      head.rotation.x = THREE.MathUtils.clamp(
        -sim.pitch * 0.15 - frontLift * 0.08,
        -0.28,
        0.18,
      );
      head.position.y = headBobY;
      flower.position.copy(flowerHome);
      flower.rotation.set(0, reduced ? 0 : idleT * 1.2, 0);
      flower.scale.setScalar(1.05 + beat.pulse * 0.18);
      applyLegPose(legs, hudSnap.legLift, hudSnap.legSwing);
    }

    // Blob shadow grows / fades with body height
    const restY = restBodyHeight();
    const heightFrac = Math.max(0.35, Math.min(1.4, sim.y / Math.max(0.2, restY)));
    shadow.position.set(root.position.x, 0.02, root.position.z);
    shadow.scale.setScalar((sim.fallen ? 1.55 : 1) * (0.7 + 0.3 * heightFrac));
    (shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(
      0.12,
      0.45 * (1.6 - 0.6 * heightFrac),
    );

    if (ghostMark) {
      const gx = ghostXAt(ghostSamples, sim.elapsed);
      if (gx != null && gx > 0.5) {
        ghostMark.visible = true;
        ghostMark.position.set(gx, 0, 2.4);
      } else ghostMark.visible = false;
    }

    // Follow: x + 0.4·s + 0.25·vx, exponential 5/s; distance 4/s
    const scaleLead = LION_SCALE;
    const targetX = attract ? 1.2 : sim.x + 0.4 * scaleLead + 0.25 * sim.vx;
    const follow = reduced ? 1 : 1 - Math.exp(-FOLLOW_RATE * dt);
    camX += (targetX - camX) * follow;
    const distFollow = reduced ? 1 : 1 - Math.exp(-DIST_FOLLOW_RATE * dt);
    camDist += (frame.distance - camDist) * distFollow;
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
      const wasFallen = sim.fallen;
      while (acc >= FIXED_DT && guard++ < 24) {
        if (sim.elapsed + FIXED_DT >= TIME_LIMIT && !sim.finished) {
          sim.elapsed = TIME_LIMIT;
          endRun('timeout');
          break;
        }

        const fired = stepBeat(beat, sim.elapsed + FIXED_DT, FIXED_DT);
        if (fired && !sim.fallen && !sim.finished) playMetronomeDrum();

        const tractionMul = 1 + comboSpeedBonus(beat.combo);
        const { end, plantEvents } = stepPhysics(sim, FIXED_DT, {
          tractionMul,
          assist,
          onPlant: (leg, elapsed, impact) => {
            const r = registerPlant(beat, elapsed);
            if (r.perfect) {
              perfectFlash = 1;
              maxCombo = Math.max(maxCombo, r.combo);
              playPerfect();
            }
            // Drum + dust on footfall (impact scales loudness)
            const power = Math.max(0.35, Math.min(1.4, 0.5 + impact / 1.2));
            playDrum();
            if (power > 0.85) playDrum();
            triggerDust(sim.x + (sim.legs[leg]?.plantX ?? 0) * 0.15, impact);
            return { leg, perfect: r.perfect, combo: r.combo, impact };
          },
        });
        void plantEvents;
        acc -= FIXED_DT;

        ghostSampleAcc += FIXED_DT;
        if (ghostSampleAcc >= GHOST_SAMPLE_DT) {
          ghostSampleAcc = 0;
          liveGhost.push({ t: sim.elapsed, x: sim.x });
        }

        if (!wasFallen && sim.fallen && !fallFxPlayed) {
          fallFxPlayed = true;
          playFall();
          triggerDust(sim.x, 1.5);
        }
        if (end === 'finish') {
          /* celebration continues until finishAnim */
        }
      }

      if (sim.finished) {
        stepPhysics(sim, Math.min(frameDt, 0.05), {
          tractionMul: 1,
          assist,
          onPlant: (leg, _e, impact) => ({ leg, perfect: false, combo: 0, impact }),
        });
        if (sim.finishAnim >= 0.98) endRun('finish');
      }

      emitHud();
    } else if (sim.finished && !ended) {
      stepPhysics(sim, Math.min(frameDt, 0.05), {
        tractionMul: 1,
        assist,
        onPlant: (leg, _e, impact) => ({ leg, perfect: false, combo: 0, impact }),
      });
      if (sim.finishAnim >= 0.98) endRun('finish');
      emitHud();
    } else if (sim.fallen && !ended && !paused) {
      stepPhysics(sim, Math.min(frameDt, 0.05), {
        tractionMul: 1,
        assist,
        onPlant: (leg, _e, impact) => ({ leg, perfect: false, combo: 0, impact }),
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
      // No fog — matte bright festival look
      scene.fog = null;
      scene.background = new THREE.Color(0xf7f1e6);

      frame = computeCameraFrame(16 / 9);
      camDist = frame.distance;
      camera = new THREE.PerspectiveCamera(frame.fov, 1, 0.1, 400);
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

      // One hemi sky + one sun (follows camera target) — keep vermilion readable
      scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a70, 1.6));
      sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(3, 8, 6);
      scene.add(sun);
      scene.add(sun.target);

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
      finishFxPlayed = false;
      fallFxPlayed = false;
      flowerDetached = false;
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
        lion.root.scale.setScalar(LION_SCALE);
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
        if (beginGetUp(sim)) {
          fallFxPlayed = false;
          flowerDetached = false;
          if (lion) {
            lion.flower.position.copy(lion.flowerHome);
            lion.flower.rotation.set(0, 0, 0);
            lion.root.scale.setScalar(LION_SCALE);
            lion.cloth.rotation.set(0, 0, 0);
            lion.cloth.position.set(0, 0, 0);
            lion.hem.rotation.z = 0;
            lion.hem.position.y = 0.02;
            lion.frontHump.position.y = lion.frontHumpHomeY;
            lion.rearHump.position.y = lion.rearHumpHomeY;
          }
          paused = false;
          emitHud();
        }
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

    projectFeet() {
      if (!lion || !camera) return null;
      lion.root.updateWorldMatrix(true, true);
      camera.updateMatrixWorld(true);
      const tmp = new THREE.Vector3();
      const out = {} as Record<LegId, { x: number; y: number }>;
      for (const id of LEG_IDS) {
        lion.legs[id].foot.getWorldPosition(tmp);
        // Sole is slightly below the foot mesh origin
        tmp.y = Math.min(tmp.y, 0.05);
        const uv = projectWorldToUv(tmp, camera);
        out[id] = { x: uv.x, y: uv.y };
      }
      return out;
    },

    /** Debug helper for playtests — leg FK angles + lifts. */
    debugLegs() {
      if (!lion) return null;
      const out: Record<string, unknown> = {};
      const tmp = new THREE.Vector3();
      for (const id of ['FL', 'FR', 'BL', 'BR'] as LegId[]) {
        const L = lion.legs[id];
        L.knee.getWorldPosition(tmp);
        const knee = tmp.clone();
        L.foot.getWorldPosition(tmp);
        const foot = tmp.clone();
        L.root.getWorldPosition(tmp);
        const hip = tmp.clone();
        out[id] = {
          lift: +sim.legs[id].lift.toFixed(3),
          swing: +sim.legs[id].swing.toFixed(3),
          held: sim.legs[id].held,
          thighZ: +L.thigh.rotation.z.toFixed(3),
          shinZ: +L.shin.rotation.z.toFixed(3),
          hip: [+hip.x.toFixed(2), +hip.y.toFixed(2), +hip.z.toFixed(2)],
          knee: [+knee.x.toFixed(2), +knee.y.toFixed(2), +knee.z.toFixed(2)],
          foot: [+foot.x.toFixed(2), +foot.y.toFixed(2), +foot.z.toFixed(2)],
        };
      }
      return out;
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
