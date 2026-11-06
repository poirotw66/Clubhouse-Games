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
  playBlessingBell,
  playDrum,
  playDrumTap,
  playFall,
  playFinishFanfare,
  playGoldFever,
  playLeapHop,
  playMetronomeDrum,
  playPerfect,
  playRibbonSpurt,
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
  /**
   * Fast-forward a diagonal gait race (no RAF). Used by Playwright pace asserts.
   * periodSec = time holding each diagonal pair before swapping (Q+P ↔ W+O).
   */
  runDiagonalRace(periodSec: number): {
    elapsed: number;
    falls: number;
    finished: boolean;
    x: number;
    vmax: number;
    steps: number;
  };
  /** Same-side L↔R alternate until tip (no RAF). */
  runSameSideTip(periodSec?: number): { fallen: boolean; elapsed: number };
  onHud(cb: (hud: HudSnapshot) => void): void;
  onRunEnd(cb: (result: RunResult) => void): void;
  spitRibbon(): void;
  microTrim(direction: -1 | 1): void;
  leapHop(): void;
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
  let manuallyPaused = false;
  let flowerWorld = new THREE.Vector3();
  let flowerVel = new THREE.Vector3();
  let flowerDetached = false;
  let goldFeverActive = false;
  let goldFeverTimer = 0;
  let auspiciousSpirit = 0;
  let ribbonActiveTimer = 0;
  let recentBlessing = '';
  let blessingTimer = 0;
  let spiritMilestone = 0;
  let ribbonBurst: THREE.Points | null = null;
  let ribbonVel: Float32Array | null = null;
  let goldAura: THREE.Points | null = null;

  function triggerRibbonBurst(originX: number): void {
    if (!ribbonBurst || !ribbonVel) return;
    const pos = ribbonBurst.geometry.getAttribute('position') as THREE.BufferAttribute;
    const count = pos.count;
    for (let i = 0; i < count; i++) {
      pos.setX(i, originX + 0.8 + (Math.random() - 0.5) * 0.3);
      pos.setY(i, 1.2 + (Math.random() - 0.5) * 0.3);
      pos.setZ(i, (Math.random() - 0.5) * 0.6);
      const angle = (Math.random() - 0.2) * 0.8;
      const speed = 3.5 + Math.random() * 5.5;
      ribbonVel[i * 3] = Math.cos(angle) * speed;
      ribbonVel[i * 3 + 1] = 1.8 + Math.random() * 4.2;
      ribbonVel[i * 3 + 2] = (Math.random() - 0.5) * 3.5;
    }
    pos.needsUpdate = true;
    ribbonBurst.visible = true;
    (ribbonBurst.material as THREE.PointsMaterial).opacity = 1;
  }

  function checkSpiritMilestones(): void {
    const current = Math.floor(auspiciousSpirit / 25);
    if (current > spiritMilestone && current <= 4) {
      spiritMilestone = current;
      playBlessingBell();
      if (current === 1) recentBlessing = '吉星高照';
      else if (current === 2) recentBlessing = '步步高升';
      else if (current === 3) recentBlessing = '金玉滿堂';
      else if (current >= 4) {
        recentBlessing = '祥獅獻瑞';
        triggerRibbonBurst(sim.x);
      }
      blessingTimer = 2.8;
    }
  }

  function emitHud(): void {
    const base = snapshotHudBase(sim, TIME_LIMIT);
    hudCb?.({
      ...base,
      beatPulse: beat.pulse,
      combo: beat.combo,
      perfectFlash,
      onBeatRatio: onBeatRatio(beat.perfects, beat.plants),
      speedBonus: comboSpeedBonus(beat.combo),
      goldFever: goldFeverActive,
      goldFeverTimer: Math.max(0, goldFeverTimer),
      auspiciousSpirit: Math.min(100, Math.round(auspiciousSpirit)),
      fortuneTitle: recentBlessing || null,
      ribbonActive: Math.max(0, ribbonActiveTimer),
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
    // Modest pad: shift content up just enough to clear QWOP, not into the top crop.
    const padPx = padViewOffset || h * frame.padFrac;
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
    padViewOffset = Math.min(200, Math.max(0, h * frame.padFrac));
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
      hem.visible = true;
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
      head.rotation.z = 0;
      if (!flowerDetached) {
        flower.position.copy(flowerHome);
        flower.rotation.set(0, idleT * 1.1, 0);
        flower.scale.setScalar(1.05 + beat.pulse * 0.1);
      }
      shadow.position.set(root.position.x, 0.018, root.position.z);
      shadow.rotation.set(-Math.PI / 2, 0, 0);
      camX += (1.2 - camX) * Math.min(1, dt * 3);
      applyCameraRig(camX);
      return;
    }

    if (sim.fallen) {
      const side = sim.fallSide || 1;
      // Tip belly+legs toward the camera (+Z). At roll −1.45, local −Y → +Z.
      const land = sim.fallLanded ? 1 : Math.min(1, Math.max(0.65, sim.fallSpin * 1.5));
      const towardCam = -1.45;
      const showRoll = sim.roll * (1 - land) + towardCam * land;
      root.scale.setScalar(LION_SCALE);
      // Low on the ground; slight camera nudge so legs read without diving into HUD
      root.position.set(sim.x, 0.28 + (1 - land) * 0.3, 0.28);
      root.rotation.set(showRoll, 0.28, sim.pitch * 0.08);
      cloth.rotation.set(0, 0, 0);
      cloth.position.set(0, 0, 0);
      // Hide skirt/hem — when rolled it becomes the dark standing arch
      hem.visible = false;
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
      head.rotation.x = 0.25;
      head.rotation.z = 0.15;

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
      hem.visible = true;
      cloth.rotation.set(0, 0, 0);
      cloth.position.set(0, 0, 0);
      const t = sim.finishAnim;
      root.position.set(sim.x, sim.y + Math.sin(t * 10) * 0.08 * (1 - t), 0);
      root.rotation.set(-t * 0.55, 0, 0);
      head.rotation.x = -t * 0.95;
      head.rotation.z = 0;
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
      hem.visible = true;
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
      head.rotation.z = 0;
      head.position.y = headBobY;
      flower.position.copy(flowerHome);
      flower.rotation.set(0, reduced ? 0 : idleT * 1.2, 0);
      flower.scale.setScalar(1.05 + beat.pulse * 0.18);
      applyLegPose(legs, hudSnap.legLift, hudSnap.legSwing);
    }

    // Pale flat oval on the ground — never inherits root fall roll
    const restY = restBodyHeight();
    const heightFrac = Math.max(0.35, Math.min(1.4, sim.y / Math.max(0.2, restY)));
    const sFall = sim.fallen ? 1.35 : 1;
    shadow.position.set(root.position.x, 0.018, root.position.z * 0.4);
    shadow.rotation.set(-Math.PI / 2, 0, 0);
    shadow.scale.set(
      2.2 * LION_SCALE * sFall * (0.8 + 0.15 * heightFrac),
      1,
      0.95 * LION_SCALE * sFall * (0.8 + 0.12 * heightFrac),
    );
    (shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(
      0.08,
      0.14 * (1.25 - 0.35 * heightFrac),
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

    if (ribbonBurst && ribbonVel && ribbonBurst.visible) {
      const pos = ribbonBurst.geometry.getAttribute('position') as THREE.BufferAttribute;
      const mat = ribbonBurst.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, mat.opacity - dt * 0.85);
      if (mat.opacity <= 0.02) {
        ribbonBurst.visible = false;
      } else {
        for (let i = 0; i < pos.count; i++) {
          pos.setX(i, pos.getX(i) + ribbonVel[i * 3]! * dt);
          pos.setY(i, pos.getY(i) + ribbonVel[i * 3 + 1]! * dt);
          pos.setZ(i, pos.getZ(i) + ribbonVel[i * 3 + 2]! * dt);
          ribbonVel[i * 3 + 1]! -= 9.8 * dt;
        }
        pos.needsUpdate = true;
      }
    }

    if (goldAura) {
      if (goldFeverActive && !sim.fallen && !reduced) {
        goldAura.visible = true;
        const mat = goldAura.material as THREE.PointsMaterial;
        mat.opacity = 0.85;
        const pos = goldAura.geometry.getAttribute('position') as THREE.BufferAttribute;
        const t = performance.now() * 0.004;
        for (let i = 0; i < pos.count; i++) {
          const angle = t + (i * Math.PI * 2) / pos.count;
          const radius = 0.9 + 0.3 * Math.sin(t * 2 + i);
          pos.setX(i, sim.x + Math.cos(angle) * radius);
          pos.setY(i, sim.y + 0.3 + Math.sin(angle * 2) * 0.4);
          pos.setZ(i, Math.sin(angle) * 0.8);
        }
        pos.needsUpdate = true;
      } else {
        goldAura.visible = false;
        (goldAura.material as THREE.PointsMaterial).opacity = 0;
      }
    }
  }

  function tick(now: number): void {
    raf = requestAnimationFrame(tick);
    if (!renderer || !scene || !camera) return;
    const frameDt = Math.min(MAX_FRAME_DT, (now - lastT) / 1000 || FIXED_DT);
    lastT = now;
    perfectFlash = Math.max(0, perfectFlash - frameDt * 2.8);

    if (goldFeverTimer > 0) {
      goldFeverTimer -= frameDt;
      if (goldFeverTimer <= 0 && beat.combo < 4) {
        goldFeverActive = false;
      }
    }
    if (ribbonActiveTimer > 0) {
      ribbonActiveTimer -= frameDt;
    }
    if (blessingTimer > 0) {
      blessingTimer -= frameDt;
      if (blessingTimer <= 0) recentBlessing = '';
    }

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

        const feverBonus = goldFeverActive ? 0.25 : 0;
        const tractionMul = 1 + comboSpeedBonus(beat.combo) + feverBonus;
        const { end, plantEvents } = stepPhysics(sim, FIXED_DT, {
          tractionMul,
          assist,
          onPlant: (leg, elapsed, impact) => {
            const r = registerPlant(beat, elapsed);
            if (r.perfect) {
              perfectFlash = 1;
              maxCombo = Math.max(maxCombo, r.combo);
              playPerfect();
              auspiciousSpirit = Math.min(100, auspiciousSpirit + 6);
              checkSpiritMilestones();
              if (r.combo >= 4) {
                if (!goldFeverActive) {
                  goldFeverActive = true;
                  playGoldFever();
                }
                goldFeverTimer = 4.5;
              }
            } else {
              auspiciousSpirit = Math.min(100, auspiciousSpirit + 2);
              checkSpiritMilestones();
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
        if (!sim.fallen && !sim.finished && Math.abs(sim.roll) < 0.12 && Math.abs(sim.pitch) < 0.12) {
          auspiciousSpirit = Math.min(100, auspiciousSpirit + 1.2 * FIXED_DT);
          checkSpiritMilestones();
        }
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
    if (e.repeat || attract || paused) return;
    const key = e.key.toLowerCase();
    if (key === 'r') {
      e.preventDefault();
      unlockAudio();
      api.getUpOrRestart();
      return;
    }
    if (key === 'b') {
      e.preventDefault();
      api.spitRibbon();
      return;
    }
    if (e.code === 'Space' || e.key === 'ArrowUp') {
      if (!sim.fallen && !sim.finished && running) {
        e.preventDefault();
        api.leapHop();
        return;
      }
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      api.microTrim(-1);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      api.microTrim(1);
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

  const clearHeldLegs = (): void => {
    for (const id of LEG_IDS) setLegHeld(sim, id, false);
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      clearHeldLegs();
      visibilityPaused = true;
      paused = true;
    } else if (visibilityPaused && running && !ended) {
      visibilityPaused = false;
      paused = manuallyPaused;
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

      // Soft festival light — strong hemi + mild sun so body never paints a dark arch
      scene.add(new THREE.HemisphereLight(0xfff8ef, 0xc8bba8, 2.15));
      sun = new THREE.DirectionalLight(0xfff2e0, 0.95);
      sun.position.set(4, 10, 7);
      sun.castShadow = false;
      scene.add(sun);
      scene.add(sun.target);
      const fill = new THREE.DirectionalLight(0xffffff, 0.55);
      fill.position.set(-2, 5, 8);
      fill.castShadow = false;
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
      scene.add(lion.root);
      // Ground oval lives on the scene (not under root) so fall roll can't stand it up
      lion.shadow.scale.set(2.6 * LION_SCALE, 1, 1.15 * LION_SCALE);
      scene.add(lion.shadow);

      // Ribbon streamer particles for spitRibbon()
      const ribbonN = 64;
      const rPos = new Float32Array(ribbonN * 3);
      const rCol = new Float32Array(ribbonN * 3);
      ribbonVel = new Float32Array(ribbonN * 3);
      const palette = [0xe23a2e, 0xf0c14b, 0xff5c8a, 0x00b04d, 0x2e91ff];
      const tmpCol = new THREE.Color();
      for (let i = 0; i < ribbonN; i++) {
        rPos[i * 3] = 0;
        rPos[i * 3 + 1] = -10;
        rPos[i * 3 + 2] = 0;
        tmpCol.setHex(palette[i % palette.length]!);
        rCol[i * 3] = tmpCol.r;
        rCol[i * 3 + 1] = tmpCol.g;
        rCol[i * 3 + 2] = tmpCol.b;
      }
      const rGeo = new THREE.BufferGeometry();
      rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
      rGeo.setAttribute('color', new THREE.BufferAttribute(rCol, 3));
      ribbonBurst = new THREE.Points(
        rGeo,
        new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0 }),
      );
      scene.add(ribbonBurst);

      // Gold aura particles for Gold Fever mode
      const auraN = 36;
      const aPos = new Float32Array(auraN * 3);
      const aCol = new Float32Array(auraN * 3);
      for (let i = 0; i < auraN; i++) {
        aPos[i * 3] = 0;
        aPos[i * 3 + 1] = -10;
        aPos[i * 3 + 2] = 0;
        aCol[i * 3] = 1;
        aCol[i * 3 + 1] = 0.88;
        aCol[i * 3 + 2] = 0.25;
      }
      const aGeo = new THREE.BufferGeometry();
      aGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
      aGeo.setAttribute('color', new THREE.BufferAttribute(aCol, 3));
      goldAura = new THREE.Points(
        aGeo,
        new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0 }),
      );
      scene.add(goldAura);

      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', clearHeldLegs);
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
      window.removeEventListener('blur', clearHeldLegs);
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
      goldFeverActive = false;
      goldFeverTimer = 0;
      auspiciousSpirit = 0;
      ribbonActiveTimer = 0;
      recentBlessing = '';
      blessingTimer = 0;
      spiritMilestone = 0;
      if (ribbonBurst) {
        ribbonBurst.visible = false;
        (ribbonBurst.material as THREE.PointsMaterial).opacity = 0;
      }
      if (goldAura) {
        goldAura.visible = false;
        (goldAura.material as THREE.PointsMaterial).opacity = 0;
      }
      manuallyPaused = false;
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
      manuallyPaused = p;
      paused = p || visibilityPaused;
      if (paused) clearHeldLegs();
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

    runDiagonalRace(periodSec: number) {
      // Fresh run so framing/screenshot state does not pollute pace probes
      this.start({ mode: '1p', muted: true, assist: false, reducedMotion: true });
      paused = true; // freeze RAF; we step physics ourselves
      attract = false;
      const pairs: LegId[][] = [
        ['FL', 'BR'],
        ['FR', 'BL'],
      ];
      let pairIdx = 0;
      let phaseT = 0;
      let falls = 0;
      const period = Math.max(0.08, periodSec);
      while (!sim.finished && sim.elapsed < TIME_LIMIT) {
        if (sim.fallen) {
          falls += 1;
          getUpInPlace(sim);
          phaseT = 0;
          continue;
        }
        phaseT += FIXED_DT;
        const hold = pairs[pairIdx % 2]!;
        for (const id of LEG_IDS) setLegHeld(sim, id, hold.includes(id));
        if (phaseT >= period) {
          phaseT = 0;
          pairIdx += 1;
        }
        stepPhysics(sim, FIXED_DT, {
          tractionMul: 1,
          assist: false,
          onPlant: (_leg, _e, impact) => ({
            leg: _leg,
            perfect: false,
            combo: 0,
            impact,
          }),
        });
      }
      return {
        elapsed: sim.elapsed,
        falls,
        finished: sim.finished,
        x: sim.x,
        vmax: sim.maxSpeed,
        steps: sim.stepCount,
      };
    },

    /** Same-side L↔R alternate until tip (playtest). Measured ≈0.92 s. */
    runSameSideTip(periodSec = 0.12) {
      this.start({ mode: '1p', muted: true, assist: false, reducedMotion: true });
      paused = true;
      attract = false;
      let phase = 0;
      let phaseT = 0;
      const period = Math.max(0.05, periodSec);
      while (!sim.fallen && sim.elapsed < 2.0) {
        phaseT += FIXED_DT;
        const left = phase === 0;
        for (const id of LEG_IDS) {
          const onLeft = id === 'FL' || id === 'BL';
          setLegHeld(sim, id, left ? onLeft : !onLeft);
        }
        if (phaseT >= period) {
          phaseT = 0;
          phase = 1 - phase;
        }
        stepPhysics(sim, FIXED_DT, {
          tractionMul: 1,
          assist: false,
          onPlant: (_leg, _e, impact) => ({
            leg: _leg,
            perfect: false,
            combo: 0,
            impact,
          }),
        });
      }
      return { fallen: sim.fallen, elapsed: sim.elapsed };
    },

    onHud(cb) {
      hudCb = cb;
    },

    onRunEnd(cb) {
      endCb = cb;
    },

    spitRibbon() {
      if (attract || ended || sim.fallen || sim.finished) return;
      unlockAudio();
      playRibbonSpurt();
      ribbonActiveTimer = 1.2;
      auspiciousSpirit = Math.min(100, auspiciousSpirit + 15);
      checkSpiritMilestones();
      sim.rollVel *= 0.55;
      sim.pitchVel *= 0.55;
      triggerRibbonBurst(sim.x);
      emitHud();
    },

    microTrim(direction) {
      if (attract || ended || sim.fallen || sim.finished) return;
      unlockAudio();
      playDrumTap();
      sim.rollVel -= direction * 1.6;
      sim.rollVel *= 0.88;
      emitHud();
    },

    leapHop() {
      if (attract || ended || sim.fallen || sim.finished) return;
      let groundedCount = 0;
      for (const id of LEG_IDS) {
        if (sim.legs[id].grounded) groundedCount++;
      }
      if (groundedCount >= 1) {
        unlockAudio();
        playLeapHop();
        sim.vy = Math.max(sim.vy, 1.25);
        sim.vx = Math.min(3.8, sim.vx + 0.35);
        sim.pitchVel += 0.15;
        triggerDust(sim.x, 1.2);
        emitHud();
      }
    },
  };

  return api;
}
