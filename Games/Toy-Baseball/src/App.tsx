/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { ScoreFlash, type ScoreFlashTone } from '@clubhouse/shared/ScoreFlash';
import {
  playCapture,
  playError,
  playGoal,
  playLose,
  playMove,
  playPaddleHit,
  playScore,
  playWin,
} from '@clubhouse/shared/synthAudio';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { Trophy, Play, Target, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CONTACT_LABELS,
  DERBY_SWINGS,
  DIFFICULTY,
  DIFFICULTY_BLURBS,
  DIFFICULTY_LABELS,
  INNINGS_LABELS,
  INNINGS_OPTIONS,
  PLAY_MODE_LABELS,
  cpuSwingTargetY,
  gradeContact,
  pickDefenseAlignment,
  type ContactGrade,
  type Difficulty,
  type InningsLength,
  type PlayMode,
} from './difficulty';
import {
  loadBests,
  loadBestsMap,
  saveBests,
  updateDerbyBests,
  updateMatchBests,
  type BaseballBests,
  type BestsMap,
} from './stats';
import {
  fieldDirtImage,
  fieldGrassImage,
  fieldSkyImage,
  drawBatterSprite,
  drawPitcherSprite,
} from './fieldArt';
import {
  FirstRunGuide,
  hasSeenFirstRunGuide,
} from './components/FirstRunGuide';
import {
  MOUND,
  PITCH_DEFS,
  PITCH_TYPES,
  STEER_WINDOW_SEC,
  applyPitchFlight,
  chooseCpuPitch,
  cpuReadsPitch,
  initialPitchVelocity,
  type PitchLoc,
  type PitchType,
} from './pitching';
import {
  estimateFlightTime,
  FENCE_DIST,
  getFielders,
  isFoulTerritory,
  resolveFairBall,
  type DefenseAlignment,
  type FielderId,
} from './fielding';
import { computeHitLaunch, type SwingDir } from './hitting';
import { createRng, freshSeed, type Rng } from './rng';

function resultFlashTone(text: string): ScoreFlashTone {
  if (text.includes('全壘打') || text.includes('安打') || text.includes('保送') || text.includes('完美')) {
    return 'good';
  }
  if (
    text.includes('OUT')
    || text.includes('三振')
    || text.includes('軟弱')
    || text.includes('太早')
    || text.includes('太晚')
    || text.includes('落空')
  ) {
    return 'bad';
  }
  return 'neutral';
}

function BaseDiamond({ bases }: { bases: [boolean, boolean, boolean] }): React.ReactElement {
  const baseClass = (active: boolean) =>
    `w-2.5 h-2.5 rotate-45 border transition-colors ${
      active
        ? 'bg-amber-400 border-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.7)]'
        : 'bg-zinc-800/80 border-zinc-600'
    }`;

  return (
    <div className="relative w-10 h-10 shrink-0" aria-label="壘包">
      <div className={`absolute left-1/2 top-0 -translate-x-1/2 ${baseClass(bases[1])}`} />
      <div className={`absolute left-0 bottom-1 ${baseClass(bases[2])}`} />
      <div className={`absolute right-0 bottom-1 ${baseClass(bases[0])}`} />
    </div>
  );
}

function CountRow({
  count,
  max,
  activeClass,
  label,
}: {
  count: number;
  max: number;
  activeClass: string;
  label: string;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-1">
      {[...Array(max)].map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${i < count ? activeClass : 'bg-zinc-800'}`}
        />
      ))}
      <span className="text-[10px] text-zinc-500 ml-0.5 font-bold">{label}</span>
    </div>
  );
}

function LineScoreTable({
  away,
  home,
  currentInning,
  halfInning,
}: {
  away: number[];
  home: number[];
  currentInning: number;
  halfInning: number;
}): React.ReactElement {
  const cols = Math.max(away.length, home.length, 1);
  return (
    <div className="overflow-x-auto max-w-[220px] sm:max-w-none">
      <table className="text-[10px] font-mono border-collapse">
        <thead>
          <tr className="text-zinc-500">
            <th className="px-1 text-left font-bold"> </th>
            {Array.from({ length: cols }, (_, i) => (
              <th
                key={i}
                className={`px-1 font-bold ${
                  i + 1 === currentInning ? 'text-amber-300' : ''
                }`}
              >
                {i + 1}
              </th>
            ))}
            <th className="px-1 font-bold text-zinc-300">R</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-1 text-blue-300 font-bold">客</td>
            {Array.from({ length: cols }, (_, i) => (
              <td
                key={i}
                className={`px-1 text-center tabular-nums ${
                  i + 1 === currentInning && halfInning === 0
                    ? 'text-white'
                    : 'text-zinc-300'
                }`}
              >
                {away[i] ?? 0}
              </td>
            ))}
            <td className="px-1 text-center font-bold text-blue-300 tabular-nums">
              {away.reduce((a, b) => a + b, 0)}
            </td>
          </tr>
          <tr>
            <td className="px-1 text-red-300 font-bold">主</td>
            {Array.from({ length: cols }, (_, i) => (
              <td
                key={i}
                className={`px-1 text-center tabular-nums ${
                  i + 1 === currentInning && halfInning === 1
                    ? 'text-white'
                    : 'text-zinc-300'
                }`}
              >
                {home[i] ?? 0}
              </td>
            ))}
            <td className="px-1 text-center font-bold text-red-300 tabular-nums">
              {home.reduce((a, b) => a + b, 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// --- Constants & Types ---

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRAVITY = 600;
const AIR_RESISTANCE = 0.2;

type GameMode = 'menu' | 'playing' | 'gameOver';
type BallState = 'idle' | 'pitching' | 'flying';

interface GameState {
  mode: GameMode;
  playMode: PlayMode;
  difficulty: Difficulty;
  inningsLength: InningsLength;
  seed: number;
  inning: number;
  halfInning: number;
  score: { away: number; home: number };
  lineScore: { away: number[]; home: number[] };
  outs: number;
  strikes: number;
  balls: number;
  bases: [boolean, boolean, boolean];
  ballPos: { x: number; y: number; z: number } | null;
  ballVel: { x: number; y: number; z: number } | null;
  ballTrail: { x: number; y: number; z: number; alpha: number }[];
  ballState: BallState;
  hitEffect: number;
  isPitching: boolean;
  pitchType: PitchType | null;
  pitchLoc: PitchLoc | null;
  pitchAge: number;
  steerDir: -1 | 0 | 1;
  selectedPitchType: PitchType;
  swingTime: number | null;
  swingDir: SwingDir;
  handedness: 'left' | 'right';
  resultText: string;
  resultTimer: number;
  lastHitType: 'foul' | 'fair' | null;
  contactQuality: number;
  contactGrade: ContactGrade | null;
  contactFlash: number;
  cpuPitchTimer: number | null;
  cpuSwingLocked: boolean;
  cpuSwingTargetY: number | null;
  cpuWillSwing: boolean;
  derbySwingsLeft: number;
  derbyHrs: number;
  derbyBestDist: number;
  atBatOver: boolean;
  defenseAlignment: DefenseAlignment;
  lastLanding: { x: number; y: number } | null;
  lastFielderId: FielderId | null;
  peakZ: number;
  crowdPulse: number;
}

// --- Game Engine ---

class GameEngine {
  state: GameState;
  onStateChange: (state: GameState) => void;
  private rng: Rng;
  private pitchIndex = 0;
  private hitIndex = 0;

  constructor(onStateChange: (state: GameState) => void) {
    this.onStateChange = onStateChange;
    this.state = this.getInitialState();
    this.rng = createRng(this.state.seed);
  }

  getInitialState(): GameState {
    const seed = freshSeed();
    const inningsLength: InningsLength = 3;
    return {
      mode: 'menu',
      playMode: 'match',
      difficulty: 'normal',
      inningsLength,
      seed,
      inning: 1,
      halfInning: 0,
      score: { away: 0, home: 0 },
      lineScore: {
        away: Array(inningsLength).fill(0),
        home: Array(inningsLength).fill(0),
      },
      outs: 0,
      strikes: 0,
      balls: 0,
      bases: [false, false, false],
      ballPos: null,
      ballVel: null,
      ballTrail: [],
      ballState: 'idle',
      hitEffect: 0,
      isPitching: false,
      pitchType: null,
      pitchLoc: null,
      pitchAge: 0,
      steerDir: 0,
      selectedPitchType: 'fastball',
      swingTime: null,
      swingDir: 'center',
      handedness: 'right',
      resultText: '',
      resultTimer: 0,
      lastHitType: null,
      contactQuality: 0.5,
      contactGrade: null,
      contactFlash: 0,
      cpuPitchTimer: null,
      cpuSwingLocked: false,
      cpuSwingTargetY: null,
      cpuWillSwing: false,
      derbySwingsLeft: DERBY_SWINGS,
      derbyHrs: 0,
      derbyBestDist: 0,
      atBatOver: false,
      defenseAlignment: 'normal',
      lastLanding: null,
      lastFielderId: null,
      peakZ: 0,
      crowdPulse: 0,
    };
  }

  get cfg() {
    return DIFFICULTY[this.state.difficulty];
  }

  private nextRoll(label: string): number {
    // Advance shared stream; label kept for readability in checks / debugging.
    void label;
    return this.rng();
  }

  reset() {
    const handedness = this.state.handedness;
    const difficulty = this.state.difficulty;
    const playMode = this.state.playMode;
    const inningsLength = this.state.inningsLength;
    const selectedPitchType = this.state.selectedPitchType;
    this.state = this.getInitialState();
    this.state.handedness = handedness;
    this.state.difficulty = difficulty;
    this.state.playMode = playMode;
    this.state.inningsLength = inningsLength;
    this.state.selectedPitchType = selectedPitchType;
    this.state.lineScore = {
      away: Array(inningsLength).fill(0),
      home: Array(inningsLength).fill(0),
    };
    this.rng = createRng(this.state.seed);
    this.pitchIndex = 0;
    this.hitIndex = 0;
    this.onStateChange(this.state);
  }

  start(playMode?: PlayMode, difficulty?: Difficulty, inningsLength?: InningsLength) {
    if (playMode) this.state.playMode = playMode;
    if (difficulty) this.state.difficulty = difficulty;
    if (inningsLength) this.state.inningsLength = inningsLength;
    this.state.seed = freshSeed();
    this.rng = createRng(this.state.seed);
    this.pitchIndex = 0;
    this.hitIndex = 0;
    this.state.mode = 'playing';
    this.state.inning = 1;
    this.state.halfInning = 0;
    this.state.score = { away: 0, home: 0 };
    this.state.lineScore = {
      away: Array(this.state.inningsLength).fill(0),
      home: Array(this.state.inningsLength).fill(0),
    };
    this.state.outs = 0;
    this.state.bases = [false, false, false];
    this.state.derbySwingsLeft = DERBY_SWINGS;
    this.state.derbyHrs = 0;
    this.state.derbyBestDist = 0;
    this.state.lastLanding = null;
    this.state.lastFielderId = null;
    this.state.crowdPulse = 0;
    if (this.state.playMode === 'derby') this.state.halfInning = 0;
    this.refreshDefense();
    this.nextBatter();
    this.onStateChange(this.state);
  }

  /** Test helper: pin seed before start for deterministic checks. */
  startWithSeed(
    seed: number,
    playMode: PlayMode = 'match',
    difficulty: Difficulty = 'normal',
    inningsLength: InningsLength = 3,
  ) {
    this.state.playMode = playMode;
    this.state.difficulty = difficulty;
    this.state.inningsLength = inningsLength;
    this.state.seed = seed >>> 0;
    this.rng = createRng(this.state.seed);
    this.pitchIndex = 0;
    this.hitIndex = 0;
    this.state.mode = 'playing';
    this.state.inning = 1;
    this.state.halfInning = 0;
    this.state.score = { away: 0, home: 0 };
    this.state.lineScore = {
      away: Array(inningsLength).fill(0),
      home: Array(inningsLength).fill(0),
    };
    this.state.outs = 0;
    this.state.bases = [false, false, false];
    this.refreshDefense();
    this.nextBatter();
    this.onStateChange(this.state);
  }

  refreshDefense() {
    this.state.defenseAlignment = pickDefenseAlignment(this.cfg, () => this.nextRoll('defense'));
  }

  nextBatter() {
    this.state.strikes = 0;
    this.state.balls = 0;
    this.state.atBatOver = false;
    this.refreshDefense();
    this.readyNextPitch();
  }

  readyNextPitch() {
    this.state.ballPos = null;
    this.state.ballVel = null;
    this.state.ballState = 'idle';
    this.state.isPitching = false;
    this.state.pitchType = null;
    this.state.pitchLoc = null;
    this.state.pitchAge = 0;
    this.state.steerDir = 0;
    this.state.swingTime = null;
    this.state.cpuPitchTimer = null;
    this.state.cpuSwingLocked = false;
    this.state.cpuSwingTargetY = null;
    this.state.cpuWillSwing = false;
    this.state.contactQuality = 0.5;
    this.state.peakZ = 0;
  }

  get isPlayerBatting() {
    if (this.state.playMode === 'derby') return true;
    return this.state.halfInning === 0;
  }

  setSelectedPitchType(type: PitchType) {
    this.state.selectedPitchType = type;
    this.onStateChange(this.state);
  }

  setSteerDir(dir: -1 | 0 | 1) {
    this.state.steerDir = dir;
  }

  handlePitch(type: PitchType, loc: PitchLoc) {
    if (this.state.ballState !== 'idle' || this.state.ballPos) return;
    if (this.state.resultTimer > 0) return;

    this.state.isPitching = true;
    this.state.ballState = 'pitching';
    this.state.pitchType = type;
    this.state.pitchLoc = loc;
    this.state.selectedPitchType = type;
    this.state.pitchAge = 0;
    this.state.steerDir = 0;
    this.state.ballPos = { ...MOUND };
    this.state.ballVel = initialPitchVelocity(type, loc);
    this.state.cpuPitchTimer = null;
    this.state.cpuSwingLocked = false;
    this.state.cpuSwingTargetY = null;
    this.state.cpuWillSwing = false;
    this.state.ballTrail = [];

    this.onStateChange(this.state);
  }

  handleSwing() {
    if (this.state.ballState !== 'pitching' || this.state.swingTime !== null) return;
    // Bat animation countdown (visual only). Contact quality uses plate-relative timing.
    this.state.swingTime = 0.18;
    this.onStateChange(this.state);
  }

  update(dt: number) {
    if (this.state.mode !== 'playing') return;

    if (this.state.crowdPulse > 0) {
      this.state.crowdPulse = Math.max(0, this.state.crowdPulse - dt);
    }
    if (this.state.contactFlash > 0) {
      this.state.contactFlash = Math.max(0, this.state.contactFlash - dt);
    }

    if (this.state.resultTimer > 0) {
      this.state.resultTimer -= dt;
      if (this.state.resultTimer <= 0) {
        this.state.resultText = '';
        this.state.lastLanding = null;
        this.state.lastFielderId = null;
        if (this.state.atBatOver || this.state.playMode === 'derby') {
          this.nextBatter();
        } else {
          this.readyNextPitch();
        }
      }
      this.onStateChange(this.state);
      return;
    }

    // CPU Pitching — sequenced arsenal.
    if (this.isPlayerBatting && this.state.ballState === 'idle' && this.state.resultTimer <= 0) {
      if (this.state.cpuPitchTimer === null) {
        const { cpuPitchDelayMin, cpuPitchDelayMax } = this.cfg;
        this.state.cpuPitchTimer =
          cpuPitchDelayMin
          + this.nextRoll(`pitchDelay:${this.pitchIndex}`)
            * (cpuPitchDelayMax - cpuPitchDelayMin);
      } else {
        this.state.cpuPitchTimer -= dt;
        if (this.state.cpuPitchTimer <= 0) {
          this.state.cpuPitchTimer = null;
          const choice = chooseCpuPitch(
            { balls: this.state.balls, strikes: this.state.strikes },
            this.state.difficulty,
            () => this.nextRoll(`cpuPitch:${this.pitchIndex++}`),
          );
          this.handlePitch(choice.type, choice.loc);
        }
      }
    }

    // CPU Batting — read pitch type on hard, aim accordingly.
    if (!this.isPlayerBatting && this.state.ballState === 'pitching' && this.state.swingTime === null) {
      const ball = this.state.ballPos;
      if (ball) {
        if (!this.state.cpuSwingLocked && ball.y > 360) {
          this.state.cpuSwingLocked = true;
          const takeBall =
            this.state.pitchLoc !== 'center'
            && this.nextRoll(`take:${this.pitchIndex}`) < this.cfg.cpuTakeBall;
          this.state.cpuWillSwing =
            !takeBall && this.nextRoll(`swing:${this.pitchIndex}`) < this.cfg.cpuSwingRate;
          const read = this.state.pitchType
            ? cpuReadsPitch(
              this.state.difficulty,
              this.state.pitchType,
              () => this.nextRoll(`read:${this.pitchIndex}`),
            )
            : false;
          const aimSkill = read ? Math.min(1, this.cfg.cpuAimSkill + 0.12) : this.cfg.cpuAimSkill * 0.85;
          this.state.cpuSwingTargetY = cpuSwingTargetY(
            aimSkill,
            () => this.nextRoll(`aimY:${this.pitchIndex}`),
          );
          if (this.state.cpuWillSwing) {
            if (
              this.nextRoll(`aimDir:${this.pitchIndex}`) < this.cfg.cpuAimDir
              && this.state.pitchLoc
            ) {
              this.state.swingDir = this.state.pitchLoc;
            } else {
              this.state.swingDir = (['left', 'center', 'right'] as SwingDir[])[
                Math.floor(this.nextRoll(`swingDir:${this.pitchIndex}`) * 3)
              ];
            }
          }
        }
        if (
          this.state.cpuWillSwing
          && this.state.cpuSwingTargetY !== null
          && ball.y >= this.state.cpuSwingTargetY
        ) {
          this.handleSwing();
        }
      }
    }

    if (this.state.ballPos && this.state.ballVel) {
      this.state.ballTrail.push({ ...this.state.ballPos, alpha: 1.0 });
      if (this.state.ballTrail.length > 28) this.state.ballTrail.shift();
      this.state.ballTrail.forEach((t) => {
        t.alpha *= 0.9;
      });

      const speed = Math.sqrt(
        this.state.ballVel.x ** 2 + this.state.ballVel.y ** 2 + this.state.ballVel.z ** 2,
      );
      if (speed > 0) {
        const drag = AIR_RESISTANCE * speed * dt;
        this.state.ballVel.x -= (this.state.ballVel.x / speed) * drag;
        this.state.ballVel.y -= (this.state.ballVel.y / speed) * drag;
        this.state.ballVel.z -= (this.state.ballVel.z / speed) * drag;
      }

      if (this.state.ballState === 'pitching' && this.state.pitchType) {
        this.state.pitchAge += dt;
        const steer = this.isPlayerBatting ? 0 : this.state.steerDir;
        applyPitchFlight(
          this.state.ballVel,
          this.state.pitchType,
          this.state.pitchAge,
          dt,
          steer,
        );
      }

      this.state.ballPos.x += this.state.ballVel.x * dt;
      this.state.ballPos.y += this.state.ballVel.y * dt;
      this.state.ballPos.z += this.state.ballVel.z * dt;

      if (this.state.ballState === 'pitching') {
        if (this.state.swingTime !== null && this.state.swingTime > -0.14) {
          const dist = Math.sqrt(
            (this.state.ballPos.x - 400) ** 2 + (this.state.ballPos.y - 450) ** 2,
          );
          if (dist < this.cfg.hitRadius) {
            this.processHitPhysics();
            return;
          }
        }
        if (this.state.ballPos.y > 520) {
          this.processMiss();
        }
      } else if (this.state.ballState === 'flying') {
        this.state.ballVel.z -= GRAVITY * dt;
        this.state.peakZ = Math.max(this.state.peakZ, this.state.ballPos.z);
        if (this.state.ballPos.y < 50) {
          this.determineResult('HR');
        } else if (this.state.ballPos.z <= 0) {
          this.determineResult('LANDED');
        }
      }
    } else {
      this.state.ballTrail = [];
    }

    if (this.state.swingTime !== null) {
      this.state.swingTime -= dt;
      if (this.state.swingTime < -0.2) this.state.swingTime = null;
    }

    if (this.state.hitEffect > 0) {
      this.state.hitEffect -= dt * 2;
      if (this.state.hitEffect < 0) this.state.hitEffect = 0;
    }

    this.onStateChange(this.state);
  }

  processHitPhysics() {
    this.state.ballState = 'flying';
    this.state.strikes = 0;
    this.state.balls = 0;
    this.state.hitEffect = 1.0;

    // Plate-relative timing: 0 at the plate, early < 0, late > 0.
    // (Bat swingTime countdown is only for the bat animation.)
    const ballY = this.state.ballPos?.y ?? 450;
    const timingError = (ballY - 450) / 90;

    const launch = computeHitLaunch({
      swingTime: timingError,
      swingDir: this.state.swingDir,
      pitchLoc: this.state.pitchLoc,
      rng: () => this.nextRoll(`hit:${this.hitIndex++}`),
    });

    this.state.ballVel = launch.vel;
    this.state.contactQuality = launch.contactQuality;
    this.state.contactGrade = gradeContact(launch.contactQuality);
    this.state.contactFlash = 1.2;
    this.state.peakZ = launch.peakZ;
    this.state.crowdPulse = launch.contactQuality >= 0.85 ? 1.4 : launch.contactQuality >= 0.65 ? 0.8 : 0.35;

    this.onStateChange(this.state);
  }

  determineResult(type: 'HR' | 'LANDED') {
    let result = 'OUT';
    let bases = 0;
    let hitType: 'foul' | 'fair' | null = null;

    const x = this.state.ballPos?.x || 400;
    const y = this.state.ballPos?.y || 450;
    const dist = Math.sqrt((x - 400) ** 2 + (y - 450) ** 2);
    const quality = this.state.contactQuality;
    const foul = isFoulTerritory(x, y);
    const clearedFence =
      !foul
      && (
        (type === 'HR' && quality >= 0.58 && this.state.peakZ > 95)
        || (dist >= FENCE_DIST && quality >= 0.58 && this.state.peakZ > 95)
      );

    if (clearedFence) {
      result = '全壘打！';
      bases = 4;
      hitType = 'fair';
      this.state.lastLanding = { x, y: Math.min(y, 40) };
      this.state.lastFielderId = null;
      if (this.state.playMode === 'derby') {
        this.state.derbyHrs += 1;
        this.state.derbyBestDist = Math.max(this.state.derbyBestDist, dist);
      }
    } else if (type === 'HR' || (!foul && dist >= FENCE_DIST * 0.92 && this.state.peakZ > 70)) {
      if (foul) {
        result = '界外球 (FOUL)';
        hitType = 'foul';
        this.state.strikes = Math.min(2, this.state.strikes + 1);
        this.state.lastLanding = { x, y };
        this.state.lastFielderId = null;
      } else {
        const graded = resolveFairBall({
          landingX: x,
          landingY: Math.min(y, 55),
          peakZ: this.state.peakZ,
          quality,
          flightTime: estimateFlightTime(this.state.ballVel?.z ?? 0, this.state.peakZ),
          alignment: this.state.defenseAlignment,
          cfg: this.cfg,
        });
        result = graded.result;
        bases = graded.bases;
        hitType = 'fair';
        this.state.lastLanding = { x: graded.landingX, y: graded.landingY };
        this.state.lastFielderId = graded.fielderId;
        if (bases === 0) this.state.outs++;
        if (bases === 4 && this.state.playMode === 'derby') {
          this.state.derbyHrs += 1;
          this.state.derbyBestDist = Math.max(this.state.derbyBestDist, dist);
        }
        if (this.state.playMode === 'derby') {
          this.state.derbyBestDist = Math.max(this.state.derbyBestDist, dist);
        }
      }
    } else if (foul) {
      result = '界外球 (FOUL)';
      hitType = 'foul';
      this.state.strikes = Math.min(2, this.state.strikes + 1);
      this.state.lastLanding = { x, y };
      this.state.lastFielderId = null;
    } else {
      hitType = 'fair';
      const flightTime = estimateFlightTime(
        Math.abs(this.state.ballVel?.z ?? 120),
        this.state.peakZ,
      );
      const graded = resolveFairBall({
        landingX: x,
        landingY: y,
        peakZ: this.state.peakZ,
        quality,
        flightTime,
        alignment: this.state.defenseAlignment,
        cfg: this.cfg,
      });
      result = graded.result;
      bases = graded.bases;
      this.state.lastLanding = { x: graded.landingX, y: graded.landingY };
      this.state.lastFielderId = graded.fielderId;
      if (bases === 0) this.state.outs++;
      if (this.state.playMode === 'derby') {
        this.state.derbyBestDist = Math.max(this.state.derbyBestDist, dist);
      }
    }

    if (bases > 0) this.advanceRunners(bases);

    this.state.ballPos = null;
    this.state.ballVel = null;
    this.state.ballState = 'idle';
    this.state.resultText = result;
    this.state.resultTimer = 2.5;
    this.state.lastHitType = hitType;
    this.state.atBatOver = hitType === 'fair' || bases > 0 || result.includes('OUT');

    if (this.state.playMode === 'derby') {
      if (hitType === 'foul' || hitType === 'fair') {
        this.state.derbySwingsLeft = Math.max(0, this.state.derbySwingsLeft - 1);
      }
      this.state.atBatOver = true;
      if (this.state.derbySwingsLeft <= 0) {
        this.state.mode = 'gameOver';
      }
    } else {
      this.checkWalkOff();
      this.checkInningEnd();
    }
  }

  processMiss() {
    const loc = this.state.pitchLoc;
    const isStrike =
      loc === 'center' || (loc !== null && this.nextRoll('strikeZone') > 0.55);

    if (this.state.swingTime !== null) {
      this.state.strikes++;
      // Swing started but never met the ball in the hit radius — usually early/late.
      const remaining = this.state.swingTime;
      if (remaining > 0.06) {
        this.state.resultText = '太早揮棒 (STRIKE)';
      } else if (remaining < -0.04) {
        this.state.resultText = '太晚揮棒 (STRIKE)';
      } else {
        this.state.resultText = '揮棒落空 (STRIKE)';
      }
    } else if (isStrike) {
      this.state.strikes++;
      this.state.resultText = '好球 (STRIKE)';
    } else {
      this.state.balls++;
      this.state.resultText = '壞球 (BALL)';
    }

    if (this.state.playMode === 'derby') {
      this.state.derbySwingsLeft = Math.max(0, this.state.derbySwingsLeft - 1);
      this.state.strikes = 0;
      this.state.balls = 0;
      this.state.resultTimer = 1.2;
      this.state.ballPos = null;
      this.state.ballVel = null;
      this.state.ballState = 'idle';
      this.state.isPitching = false;
      this.state.atBatOver = true;
      if (this.state.derbySwingsLeft <= 0) this.state.mode = 'gameOver';
      return;
    }

    this.state.atBatOver = false;
    if (this.state.strikes >= 3) {
      this.state.outs++;
      this.state.resultText = '三振出局 (STRIKEOUT)';
      this.state.strikes = 0;
      this.state.balls = 0;
      this.state.atBatOver = true;
    } else if (this.state.balls >= 4) {
      this.advanceRunners(1);
      this.state.resultText = '四壞保送 (WALK)';
      this.state.strikes = 0;
      this.state.balls = 0;
      this.state.atBatOver = true;
    }

    this.state.resultTimer = 1.5;
    this.state.ballPos = null;
    this.state.ballVel = null;
    this.state.ballState = 'idle';
    this.state.isPitching = false;
    this.checkWalkOff();
    this.checkInningEnd();
  }

  advanceRunners(num: number) {
    const newBases = [false, false, false];
    let runs = 0;
    const currentRunners = [...this.state.bases];

    if (num === 4) {
      runs = currentRunners.filter((b) => b).length + 1;
    } else {
      let runners = currentRunners.map((b, i) => (b ? i + 1 : 0)).filter((r) => r > 0);
      runners = runners.map((r) => r + num);
      runs += runners.filter((r) => r > 3).length;
      runners
        .filter((r) => r <= 3)
        .forEach((r) => {
          newBases[r - 1] = true;
        });
      newBases[num - 1] = true;
    }

    if (runs > 0) {
      const idx = Math.min(this.state.inning, this.state.inningsLength) - 1;
      if (this.state.halfInning === 0) {
        this.state.score.away += runs;
        this.state.lineScore.away[idx] = (this.state.lineScore.away[idx] ?? 0) + runs;
      } else {
        this.state.score.home += runs;
        this.state.lineScore.home[idx] = (this.state.lineScore.home[idx] ?? 0) + runs;
      }
      this.state.crowdPulse = Math.max(this.state.crowdPulse, 1.2);
    }
    this.state.bases = newBases as [boolean, boolean, boolean];
  }

  checkWalkOff() {
    if (this.state.playMode !== 'match') return;
    if (
      this.state.inning >= this.state.inningsLength
      && this.state.halfInning === 1
      && this.state.score.home > this.state.score.away
    ) {
      this.state.mode = 'gameOver';
    }
  }

  checkInningEnd() {
    if (this.state.mode === 'gameOver') return;
    if (this.state.outs >= 3) {
      this.state.outs = 0;
      this.state.strikes = 0;
      this.state.balls = 0;
      this.state.bases = [false, false, false];
      this.state.halfInning++;

      if (this.state.halfInning > 1) {
        this.state.halfInning = 0;
        this.state.inning++;
      }

      // Skip bottom of last if home already ahead after top.
      if (
        this.state.inning === this.state.inningsLength
        && this.state.halfInning === 1
        && this.state.score.home > this.state.score.away
      ) {
        this.state.mode = 'gameOver';
        return;
      }

      if (this.state.inning > this.state.inningsLength) {
        this.state.mode = 'gameOver';
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const sky = fieldSkyImage();
    if (sky.complete && sky.naturalWidth > 0) {
      ctx.drawImage(sky, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(400, 550);
    ctx.lineTo(-400, 100);
    ctx.lineTo(400, -600);
    ctx.lineTo(1200, 100);
    ctx.closePath();
    ctx.clip();
    const grass = fieldGrassImage();
    if (grass.complete && grass.naturalWidth > 0) {
      const pattern = ctx.createPattern(grass, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(-400, -600, 1600, 1200);
      }
      ctx.fillStyle = 'rgba(46, 125, 50, 0.28)';
      ctx.fillRect(-400, -600, 1600, 1200);
    } else {
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(-400, -600, 1600, 1200);
    }
    ctx.restore();

    const dirt = fieldDirtImage();
    const fillDirt = () => {
      if (dirt.complete && dirt.naturalWidth > 0) {
        const pattern = ctx.createPattern(dirt, 'repeat');
        if (pattern) ctx.fillStyle = pattern;
        else ctx.fillStyle = '#c19a6b';
      } else {
        ctx.fillStyle = '#c19a6b';
      }
    };

    fillDirt();
    ctx.beginPath();
    ctx.arc(400, 450, 650, Math.PI * 1.25, Math.PI * 1.75);
    ctx.lineTo(400, 450);
    ctx.fill();

    ctx.strokeStyle = '#0277bd';
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.arc(400, 450, 655, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();

    fillDirt();
    ctx.beginPath();
    ctx.moveTo(400, 490);
    ctx.lineTo(550, 300);
    ctx.lineTo(400, 150);
    ctx.lineTo(250, 300);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(400, 450, 45, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(400, 420);
    ctx.lineTo(500, 300);
    ctx.lineTo(400, 200);
    ctx.lineTo(300, 300);
    ctx.closePath();
    ctx.clip();
    if (grass.complete && grass.naturalWidth > 0) {
      const pattern = ctx.createPattern(grass, 'repeat');
      if (pattern) ctx.fillStyle = pattern;
      ctx.fillRect(250, 150, 300, 300);
      ctx.fillStyle = 'rgba(56, 142, 60, 0.35)';
      ctx.fillRect(250, 150, 300, 300);
    } else {
      ctx.fillStyle = '#388e3c';
      ctx.fillRect(250, 150, 300, 300);
    }
    ctx.restore();

    fillDirt();
    ctx.beginPath();
    ctx.arc(400, 250, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(385, 248, 30, 4);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(360, 420, 80, 60);
    ctx.fillRect(360, 420, 80, 60);
    ctx.setLineDash([]);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 450);
    const leftFoulX = 400 + 655 * Math.cos(Math.PI * 1.25);
    const leftFoulY = 450 + 655 * Math.sin(Math.PI * 1.25);
    const rightFoulX = 400 + 655 * Math.cos(Math.PI * 1.75);
    const rightFoulY = 450 + 655 * Math.sin(Math.PI * 1.75);
    ctx.lineTo(leftFoulX, leftFoulY);
    ctx.moveTo(400, 450);
    ctx.lineTo(rightFoulX, rightFoulY);
    ctx.stroke();

    ctx.fillStyle = '#fdd835';
    ctx.fillRect(leftFoulX - 2, leftFoulY - 100, 4, 100);
    ctx.fillRect(rightFoulX - 2, rightFoulY - 100, 4, 100);

    ctx.strokeStyle = '#0277bd';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(400, 450, 80, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(365, 435, 25, 40);
    ctx.strokeRect(410, 435, 25, 40);

    // Fielders (9)
    const fielders = getFielders(this.state.defenseAlignment);
    for (const f of fielders) {
      const isHighlight = this.state.lastFielderId === f.id;
      ctx.beginPath();
      ctx.fillStyle = isHighlight ? '#fbbf24' : '#1e293b';
      ctx.strokeStyle = isHighlight ? '#fde68a' : '#94a3b8';
      ctx.lineWidth = 2;
      ctx.arc(f.x, f.y, isHighlight ? 9 : 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.id, f.x, f.y - 12);
    }

    // Landing marker / heat hint
    if (this.state.lastLanding && this.state.resultTimer > 0) {
      const { x, y } = this.state.lastLanding;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 18, y);
      ctx.lineTo(x + 18, y);
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x, y + 18);
      ctx.stroke();
    }

    const drawBase = (bx: number, by: number, active: boolean) => {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = active ? '#fbbf24' : '#ffffff';
      ctx.shadowBlur = active ? 15 : 2;
      ctx.shadowColor = active ? '#fbbf24' : 'rgba(0,0,0,0.3)';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.restore();
    };

    drawBase(400, 450, false);
    drawBase(550, 300, this.state.bases[0]);
    drawBase(400, 150, this.state.bases[1]);
    drawBase(250, 300, this.state.bases[2]);

    if (!drawPitcherSprite(ctx, 400, 250, 32)) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(400, 250, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    const batterX = this.state.handedness === 'right' ? 365 : 435;
    const batterY = 485;

    if (!drawBatterSprite(ctx, batterX, batterY - 2, 38)) {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(batterX, batterY, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    const batPivotX = this.state.handedness === 'right' ? batterX + 12 : batterX - 12;
    const batPivotY = batterY - 5;
    const batLen = 65;
    const batWidth = 9;

    ctx.save();
    ctx.translate(batPivotX, batPivotY);
    let batAngle = this.state.handedness === 'right' ? -Math.PI / 8 : -Math.PI * 7 / 8;
    if (this.state.swingTime !== null) {
      const progress = (0.18 - this.state.swingTime) / 0.36;
      if (this.state.handedness === 'right') {
        batAngle = -Math.PI / 8 - progress * Math.PI * 1.1;
      } else {
        batAngle = -Math.PI * 7 / 8 + progress * Math.PI * 1.1;
      }
    }
    ctx.rotate(batAngle);
    const gradient = ctx.createLinearGradient(0, 0, batLen, 0);
    gradient.addColorStop(0, '#8b4513');
    gradient.addColorStop(0.3, '#d2b48c');
    gradient.addColorStop(1, '#8b4513');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(0, -batWidth / 2, batLen, batWidth, 4);
    ctx.fill();
    ctx.restore();

    // Colored pitch trail — brighter while batting so pitch reads are learnable without a name label.
    if (this.state.ballTrail.length > 1) {
      const rgb = this.state.pitchType
        ? PITCH_DEFS[this.state.pitchType].trailRgb
        : ([255, 255, 255] as [number, number, number]);
      const battingRead = this.isPlayerBatting && this.state.ballState === 'pitching';
      const alphaMul = battingRead ? 0.85 : 0.55;
      const widthMul = battingRead ? 1.35 : 1;
      ctx.lineCap = 'round';
      for (let i = 1; i < this.state.ballTrail.length; i++) {
        const p1 = this.state.ballTrail[i - 1];
        const p2 = this.state.ballTrail[i];
        const ratio = i / this.state.ballTrail.length;
        ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${p2.alpha * alphaMul * ratio})`;
        ctx.lineWidth = (2.5 + (p2.z / 100) * 3) * ratio * widthMul;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y - p1.z);
        ctx.lineTo(p2.x, p2.y - p2.z);
        ctx.stroke();
      }
    }

    if (this.state.ballPos) {
      const { x, y, z } = this.state.ballPos;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      const shadowSize = Math.max(2, 6 - z / 100);
      ctx.beginPath();
      ctx.ellipse(x, y, shadowSize * 1.5, shadowSize, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      const ballSize = 6 + (z / 100) * 4;
      ctx.beginPath();
      ctx.arc(x, y - z, ballSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1 + z / 200;
      ctx.beginPath();
      ctx.arc(x, y - z, ballSize * 0.7, 0.2, 1.2);
      ctx.stroke();

      // Steer window ring while pitcher can still nudge.
      if (
        this.state.ballState === 'pitching'
        && !this.isPlayerBatting
        && this.state.pitchAge < STEER_WINDOW_SEC
      ) {
        const t = 1 - this.state.pitchAge / STEER_WINDOW_SEC;
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.35 + t * 0.45})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - z, ballSize + 6 + t * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (this.state.hitEffect > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.state.hitEffect * 0.4})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Contact quality banner
    if (this.state.contactFlash > 0 && this.state.contactGrade) {
      const alpha = Math.min(1, this.state.contactFlash);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle =
        this.state.contactGrade === 'perfect'
          ? '#fbbf24'
          : this.state.contactGrade === 'good'
            ? '#4ade80'
            : this.state.contactGrade === 'ok'
              ? '#e2e8f0'
              : '#fb7185';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(CONTACT_LABELS[this.state.contactGrade], 400, 120);
      ctx.restore();
    }

    // Crowd pulse vignette
    if (this.state.crowdPulse > 0) {
      const a = Math.min(0.25, this.state.crowdPulse * 0.18);
      ctx.fillStyle = `rgba(251, 191, 36, ${a})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, 40);
      ctx.fillRect(0, CANVAS_HEIGHT - 40, CANVAS_WIDTH, 40);
    }
  }
}

// --- React Component ---

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>(() => {
    const tempEngine = new GameEngine(() => {});
    return tempEngine.getInitialState();
  });
  const prevModeRef = useRef<GameMode>('menu');
  const prevScoreRef = useRef({ away: 0, home: 0 });
  const prevResultRef = useRef('');
  const prevContactFlashRef = useRef(0);
  const flashKeyRef = useRef(0);
  const [flash, setFlash] = useState<{ text: string; tone: ScoreFlashTone; key: number } | null>(
    null,
  );
  const [bestsMap, setBestsMap] = useState<BestsMap>(() => loadBestsMap());
  const [showFirstRun, setShowFirstRun] = useState(() => !hasSeenFirstRunGuide());
  const bests: BaseballBests = bestsMap[gameState.difficulty] ?? bestsMap.normal;

  const isPlayerBatting =
    gameState.playMode === 'derby' || gameState.halfInning === 0;
  const canPitch =
    gameState.mode === 'playing'
    && !isPlayerBatting
    && gameState.ballState === 'idle'
    && gameState.resultTimer <= 0;
  const canSteer =
    gameState.mode === 'playing'
    && !isPlayerBatting
    && gameState.ballState === 'pitching'
    && gameState.pitchAge < STEER_WINDOW_SEC;
  const waitingForCpuPitch =
    gameState.mode === 'playing'
    && isPlayerBatting
    && gameState.ballState === 'idle'
    && gameState.resultTimer <= 0
    && gameState.cpuPitchTimer !== null;

  useEffect(() => {
    const engine = new GameEngine((state) => {
      if (state.score.away > prevScoreRef.current.away) playScore();
      if (state.score.home > prevScoreRef.current.home) playError();
      if (state.contactFlash > 0.9 && prevContactFlashRef.current <= 0.9) {
        playPaddleHit();
        if (state.contactGrade === 'perfect') playGoal();
        else if (state.contactGrade === 'good') playMove();
      }
      if (state.resultText && state.resultText !== prevResultRef.current) {
        flashKeyRef.current += 1;
        setFlash({
          text: state.resultText,
          tone: resultFlashTone(state.resultText),
          key: flashKeyRef.current,
        });
        if (state.resultText.includes('全壘打')) playGoal();
        else if (state.resultText.includes('安打')) playScore();
        else if (
          state.resultText.includes('接殺')
          || state.resultText.includes('滾地球')
        ) {
          playCapture();
        } else if (
          state.resultText.includes('OUT')
          || state.resultText.includes('STRIKEOUT')
        ) {
          playError();
        }
      }
      if (state.mode === 'gameOver' && prevModeRef.current !== 'gameOver') {
        const diff = state.difficulty;
        if (state.playMode === 'derby') {
          if (state.derbyHrs > 0) playWin();
          else playLose();
          const next = updateDerbyBests(loadBests(diff), state.derbyHrs, state.derbyBestDist);
          saveBests(diff, next);
          setBestsMap(loadBestsMap());
        } else {
          if (state.score.away > state.score.home) playWin();
          else if (state.score.away < state.score.home) playLose();
          const next = updateMatchBests(
            loadBests(diff),
            state.score.away,
            state.score.home,
            state.inningsLength,
          );
          saveBests(diff, next);
          setBestsMap(loadBestsMap());
        }
      }
      prevModeRef.current = state.mode;
      prevScoreRef.current = { ...state.score };
      prevResultRef.current = state.resultText || '';
      prevContactFlashRef.current = state.contactFlash;
      setGameState({ ...state });
    });
    engineRef.current = engine;
    setGameState({ ...engine.state });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      engine.update(dt);
      engine.draw(ctx);
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (engine.state.mode === 'playing' && engine.isPlayerBatting) {
          engine.handleSwing();
        }
      } else if (e.code === 'ArrowLeft') {
        if (engine.state.mode !== 'playing') return;
        if (engine.isPlayerBatting) {
          engine.state.swingDir = 'left';
          engine.onStateChange(engine.state);
        } else if (engine.state.ballState === 'pitching') {
          engine.setSteerDir(-1);
        }
      } else if (e.code === 'ArrowRight') {
        if (engine.state.mode !== 'playing') return;
        if (engine.isPlayerBatting) {
          engine.state.swingDir = 'right';
          engine.onStateChange(engine.state);
        } else if (engine.state.ballState === 'pitching') {
          engine.setSteerDir(1);
        }
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        if (engine.state.mode === 'playing' && engine.isPlayerBatting) {
          engine.state.swingDir = 'center';
          engine.onStateChange(engine.state);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        if (!engine.isPlayerBatting && engine.state.ballState === 'pitching') {
          engine.setSteerDir(0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleStart = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.start(eng.state.playMode, eng.state.difficulty, eng.state.inningsLength);
  };

  const handleRematch = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.start(eng.state.playMode, eng.state.difficulty, eng.state.inningsLength);
  };

  const handleReset = () => {
    engineRef.current?.reset();
  };

  const setMenuPlayMode = (playMode: PlayMode) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.state.playMode = playMode;
    eng.onStateChange(eng.state);
  };

  const setMenuDifficulty = (difficulty: Difficulty) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.state.difficulty = difficulty;
    eng.onStateChange(eng.state);
  };

  const setMenuInnings = (inningsLength: InningsLength) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.state.inningsLength = inningsLength;
    eng.onStateChange(eng.state);
  };

  const throwSelected = (loc: PitchLoc) => {
    engineRef.current?.handlePitch(gameState.selectedPitchType, loc);
  };

  const setSwingDirection = (dir: SwingDir) => {
    const engine = engineRef.current;
    if (!engine || engine.state.mode !== 'playing' || !engine.isPlayerBatting) return;
    engine.state.swingDir = dir;
    engine.onStateChange(engine.state);
  };

  const handleBattingSwing = () => {
    const engine = engineRef.current;
    if (engine?.state.mode === 'playing' && engine.isPlayerBatting) {
      engine.handleSwing();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-zinc-950 overflow-x-hidden w-full">
      <BackToMenu />
      {showFirstRun && <FirstRunGuide onClose={() => setShowFirstRun(false)} />}
      <div className="w-full max-w-[800px] flex flex-col gap-3">
        <div className="relative w-full bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10">
          <div className="absolute top-0 left-0 right-0 p-3 sm:p-5 bg-gradient-to-b from-black/85 via-black/50 to-transparent z-10 flex justify-between items-start gap-2 pointer-events-none">
            {gameState.playMode === 'derby' ? (
              <div className="flex gap-4 sm:gap-6 min-w-0">
                <div className="flex flex-col">
                  <span className="text-[10px] tracking-widest text-zinc-500 font-bold">全壘打</span>
                  <span className="text-2xl sm:text-4xl font-mono font-bold text-yellow-400 tabular-nums">
                    {gameState.derbyHrs}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] tracking-widest text-zinc-500 font-bold">剩餘揮棒</span>
                  <span className="text-2xl sm:text-4xl font-mono font-bold text-blue-400 tabular-nums">
                    {gameState.derbySwingsLeft}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2">
                    <img
                      src={`${import.meta.env.BASE_URL}portraits/batter.jpg`}
                      alt=""
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-blue-400/40"
                      draggable={false}
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] tracking-widest text-zinc-500 font-bold">客場（你）</span>
                      <span className="text-2xl sm:text-4xl font-mono font-bold text-blue-400 tabular-nums">
                        {gameState.score.away}
                      </span>
                    </div>
                  </div>
                  <BaseDiamond bases={gameState.bases} />
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] tracking-widest text-zinc-500 font-bold">主場（電腦）</span>
                      <span className="text-2xl sm:text-4xl font-mono font-bold text-red-400 tabular-nums">
                        {gameState.score.home}
                      </span>
                    </div>
                    <img
                      src={`${import.meta.env.BASE_URL}portraits/pitcher.jpg`}
                      alt=""
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-red-400/40"
                      draggable={false}
                    />
                  </div>
                </div>
                {gameState.mode === 'playing' && (
                  <LineScoreTable
                    away={gameState.lineScore.away}
                    home={gameState.lineScore.home}
                    currentInning={gameState.inning}
                    halfInning={gameState.halfInning}
                  />
                )}
              </div>
            )}

            <div className="flex flex-col items-end gap-1.5">
              {gameState.mode === 'playing' && (
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    isPlayerBatting
                      ? 'bg-blue-500/20 border-blue-400/40 text-blue-200'
                      : 'bg-red-500/20 border-red-400/40 text-red-200'
                  }`}
                >
                  {isPlayerBatting ? '你的回合：打擊' : '你的回合：投球'}
                </span>
              )}
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                <span className="text-[11px] sm:text-xs font-bold text-zinc-300">
                  {gameState.playMode === 'derby'
                    ? `全壘打大賽 · ${DIFFICULTY_LABELS[gameState.difficulty]}`
                    : `${gameState.inning}/${gameState.inningsLength} 局 ${
                      gameState.halfInning === 0 ? '上' : '下'
                    } · ${DIFFICULTY_LABELS[gameState.difficulty]}`}
                </span>
              </div>
              {gameState.playMode !== 'derby' && (
                <div className="flex flex-col items-end gap-0.5">
                  <CountRow
                    count={gameState.outs}
                    max={3}
                    activeClass="bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                    label="出局"
                  />
                  <CountRow
                    count={gameState.strikes}
                    max={3}
                    activeClass="bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]"
                    label="好球"
                  />
                  <CountRow
                    count={gameState.balls}
                    max={4}
                    activeClass="bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                    label="壞球"
                  />
                </div>
              )}
              {/* Only reveal pitch type while the player is pitching — never spoil reads when batting. */}
              {gameState.mode === 'playing'
                && !isPlayerBatting
                && gameState.pitchType && (
                <span className="text-[10px] font-bold text-sky-200/90">
                  {PITCH_DEFS[gameState.pitchType].label}
                  {canSteer ? ' · 控球中' : ''}
                </span>
              )}
              {gameState.mode === 'playing' && isPlayerBatting && gameState.ballState === 'pitching' && (
                <span className="text-[10px] font-bold text-amber-200/80">
                  讀尾跡判斷球種
                </span>
              )}
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block w-full max-w-full h-auto"
          />

          {flash && gameState.mode === 'playing' && (
            <ScoreFlash
              text={flash.text}
              tone={flash.tone}
              flashKey={flash.key}
              onDone={() => setFlash(null)}
            />
          )}

          <AnimatePresence>
            {gameState.mode === 'menu' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 backdrop-blur-sm flex flex-col items-center justify-start sm:justify-center z-20 p-4 overflow-y-auto bg-cover bg-center"
                style={{
                  backgroundColor: '#09090b',
                  backgroundImage: [
                    'linear-gradient(rgba(9,9,11,0.82), rgba(9,9,11,0.92))',
                    `url(${import.meta.env.BASE_URL}menu-hero.jpg)`,
                  ].join(', '),
                }}
              >
                <div className="flex items-center gap-3 mb-3 sm:mb-6">
                  <img
                    src={`${import.meta.env.BASE_URL}portraits/batter.jpg`}
                    alt=""
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-white/15 shadow-lg"
                    draggable={false}
                  />
                  <Trophy className="w-10 h-10 sm:w-14 sm:h-14 text-yellow-500" />
                  <img
                    src={`${import.meta.env.BASE_URL}portraits/pitcher.jpg`}
                    alt=""
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-white/15 shadow-lg"
                    draggable={false}
                  />
                </div>
                <h1 className="text-4xl sm:text-6xl font-bold tracking-tighter mb-1 italic text-center">
                  玩具棒球
                </h1>
                <p className="text-zinc-400 mb-5 text-sm tracking-widest">
                  讀球 · 控球 · 打向空檔
                </p>

                <div className="w-full max-w-md mb-4 grid grid-cols-2 gap-2">
                  {(['match', 'derby'] as PlayMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMenuPlayMode(m)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border font-bold text-sm transition-all ${
                        gameState.playMode === m
                          ? 'bg-yellow-500/15 border-yellow-400/50 text-yellow-200 shadow-[0_0_20px_rgba(234,179,8,0.15)]'
                          : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:border-white/20'
                      }`}
                    >
                      {m === 'match' ? <Target className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
                      {PLAY_MODE_LABELS[m]}
                    </button>
                  ))}
                </div>

                {gameState.playMode === 'match' && (
                  <div className="w-full max-w-md mb-4">
                    <p className="text-[10px] tracking-widest text-zinc-500 font-bold text-center mb-2">
                      局數
                    </p>
                    <div className="flex gap-2 justify-center">
                      {INNINGS_OPTIONS.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setMenuInnings(n)}
                          className={`flex-1 px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
                            gameState.inningsLength === n
                              ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.45)]'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {INNINGS_LABELS[n]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="w-full max-w-md mb-4">
                  <p className="text-[10px] tracking-widest text-zinc-500 font-bold text-center mb-2">
                    難度
                  </p>
                  <div className="flex gap-2 justify-center">
                    {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setMenuDifficulty(d)}
                        className={`flex-1 px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
                          gameState.difficulty === d
                            ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {DIFFICULTY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-sm text-amber-300/90 font-medium">
                    {DIFFICULTY_BLURBS[gameState.difficulty]}
                  </p>
                </div>

                <div className="flex gap-2 mb-5 w-full max-w-md">
                  {(['right', 'left'] as const).map((hand) => (
                    <button
                      key={hand}
                      type="button"
                      onClick={() => {
                        engineRef.current!.state.handedness = hand;
                        setGameState({ ...engineRef.current!.state });
                      }}
                      className={`flex-1 py-2.5 rounded-xl font-bold transition-all ${
                        gameState.handedness === hand
                          ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                          : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                      }`}
                    >
                      {hand === 'right' ? '右打' : '左打'}
                    </button>
                  ))}
                </div>

                <p className="text-zinc-500 text-xs mb-3 text-center max-w-sm leading-relaxed">
                  {gameState.playMode === 'derby'
                    ? `限 ${DERBY_SWINGS} 次揮擊，拚全壘打數。時機與方向決定落點。`
                    : `${INNINGS_LABELS[gameState.inningsLength]}正規賽。六種球路出手後可微調；往野手間的空檔打。`}
                </p>

                <p className="text-zinc-400 text-xs mb-5 text-center font-medium">
                  {gameState.playMode === 'derby'
                    ? `${DIFFICULTY_LABELS[gameState.difficulty]}最佳：全壘打 ${bests.derbyBestHrs} · 最遠 ${Math.round(bests.derbyBestDist)}`
                    : `${DIFFICULTY_LABELS[gameState.difficulty]}最佳：勝場 ${bests.matchWins} · 連勝 ${bests.matchWinStreak} · 最佳連勝 ${bests.matchBestWinStreak}${
                      bests.matchBestRuns > 0 ? ` · 勝場最高得分 ${bests.matchBestRuns}` : ''
                    }${
                      bests.matchBestInnings > 0
                        ? ` · 最長勝場 ${bests.matchBestInnings} 局`
                        : ''
                    }`}
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={handleStart}
                    className="group relative flex items-center gap-3 bg-white text-black px-10 py-4 rounded-full font-bold text-xl hover:scale-105 transition-all active:scale-95 min-h-[52px]"
                  >
                    <Play className="fill-current" />
                    {gameState.playMode === 'derby' ? '開始大賽' : '開始比賽'}
                    <div className="absolute -inset-1 bg-white/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFirstRun(true)}
                    className="px-4 py-3 rounded-2xl text-sm font-bold tracking-wider border border-white/15 text-zinc-300 hover:border-amber-400/50 hover:text-amber-200 transition-all min-h-[44px]"
                  >
                    操作教學
                  </button>
                </div>
              </motion.div>
            )}

            {gameState.mode === 'gameOver' && (
              <ResultOverlay
                title={
                  gameState.playMode === 'derby'
                    ? gameState.derbyHrs > 0
                      ? `轟出 ${gameState.derbyHrs} 支全壘打！`
                      : '沒有全壘打…再來一次！'
                    : gameState.score.away > gameState.score.home
                      ? '你贏了！'
                      : gameState.score.away < gameState.score.home
                        ? '電腦獲勝'
                        : '平手'
                }
                variant={
                  gameState.playMode === 'derby'
                    ? gameState.derbyHrs > 0
                      ? 'win'
                      : 'neutral'
                    : gameState.score.away > gameState.score.home
                      ? 'win'
                      : gameState.score.away < gameState.score.home
                        ? 'lose'
                        : 'neutral'
                }
                stats={
                  gameState.playMode === 'derby'
                    ? [
                        { label: '全壘打', value: gameState.derbyHrs },
                        { label: '最遠距離', value: Math.round(gameState.derbyBestDist) },
                        { label: '最佳全壘打', value: bests.derbyBestHrs },
                        { label: '最佳最遠', value: Math.round(bests.derbyBestDist) },
                        { label: '難度', value: DIFFICULTY_LABELS[gameState.difficulty] },
                      ]
                    : [
                        { label: '客隊（你）', value: gameState.score.away },
                        { label: '主隊（電腦）', value: gameState.score.home },
                        { label: '局數', value: gameState.inningsLength },
                        { label: '勝場', value: bests.matchWins },
                        { label: '連勝', value: bests.matchWinStreak },
                        { label: '難度', value: DIFFICULTY_LABELS[gameState.difficulty] },
                      ]
                }
                onPrimary={handleRematch}
                primaryLabel="再玩一局"
                onSecondary={handleReset}
                secondaryLabel="回選單"
              />
            )}
          </AnimatePresence>
        </div>

        {gameState.mode === 'playing' && (
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full flex flex-col gap-2"
          >
            {waitingForCpuPitch && (
              <p className="text-center text-xs text-zinc-400 animate-pulse">投手準備中…讀球種！</p>
            )}

            {isPlayerBatting ? (
              <>
                <div className="hidden md:flex items-center justify-center gap-3 bg-zinc-900/80 border border-white/10 rounded-2xl px-4 py-2">
                  <div className="flex items-center gap-2">
                    <kbd className="bg-zinc-800 px-2.5 py-1 rounded-md font-mono text-xs border border-white/10">
                      空白鍵
                    </kbd>
                    <span className="text-sm font-bold text-zinc-300">揮棒（球近本壘）</span>
                  </div>
                  <div className="w-px h-4 bg-white/10" />
                  <div className="flex items-center gap-2">
                    <kbd className="bg-zinc-800 px-2.5 py-1 rounded-md font-mono text-xs border border-white/10">
                      ← →
                    </kbd>
                    <span className="text-sm font-bold text-zinc-300">打向空檔</span>
                  </div>
                </div>

                {/* Direction + swing on one row so 揮棒 stays above the fold on phones. */}
                <div className="flex justify-center items-stretch gap-2 w-full max-w-md mx-auto">
                  {(['left', 'center', 'right'] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => setSwingDirection(dir)}
                      className={`flex-1 min-h-[48px] rounded-xl font-bold text-sm transition-all touch-manipulation ${
                        gameState.swingDir === dir
                          ? 'bg-blue-500/25 border border-blue-400/50 text-blue-200'
                          : 'bg-zinc-800 border border-white/10 text-zinc-400'
                      }`}
                    >
                      {dir === 'left' ? '← 拉' : dir === 'center' ? '中' : '推 →'}
                    </button>
                  ))}
                  <TouchButton label="揮棒" ariaLabel="揮棒" accent onClick={handleBattingSwing} />
                </div>
              </>
            ) : (
              <>
                {canSteer ? (
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onPointerDown={() => engineRef.current?.setSteerDir(-1)}
                      onPointerUp={() => engineRef.current?.setSteerDir(0)}
                      onPointerLeave={() => engineRef.current?.setSteerDir(0)}
                      className="flex-1 max-w-[160px] min-h-[48px] rounded-xl font-bold bg-sky-600/30 border border-sky-400/50 text-sky-100 touch-manipulation"
                    >
                      <ChevronLeft className="inline w-5 h-5" /> 控球左
                    </button>
                    <button
                      type="button"
                      onPointerDown={() => engineRef.current?.setSteerDir(1)}
                      onPointerUp={() => engineRef.current?.setSteerDir(0)}
                      onPointerLeave={() => engineRef.current?.setSteerDir(0)}
                      className="flex-1 max-w-[160px] min-h-[48px] rounded-xl font-bold bg-sky-600/30 border border-sky-400/50 text-sky-100 touch-manipulation"
                    >
                      控球右 <ChevronRight className="inline w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-center text-xs text-zinc-500">
                      {canPitch
                        ? '選球種，再選進壘點出手；出手後可左右微調'
                        : '球進行中…'}
                    </p>
                    <div className="grid grid-cols-3 gap-2 w-full max-w-md mx-auto">
                      {PITCH_TYPES.map((type) => {
                        const def = PITCH_DEFS[type];
                        const selected = gameState.selectedPitchType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            disabled={!canPitch}
                            onClick={() => engineRef.current?.setSelectedPitchType(type)}
                            className={`flex flex-col items-center justify-center gap-0.5 min-h-[48px] p-2 rounded-xl border transition-all touch-manipulation ${
                              !canPitch
                                ? 'bg-zinc-900/60 border-white/5 opacity-40 cursor-not-allowed'
                                : selected
                                  ? 'bg-sky-600/30 border-sky-400/50 text-sky-100'
                                  : 'bg-zinc-800 border-white/10 hover:border-white/25 text-zinc-300'
                            }`}
                          >
                            <span className="text-sm font-bold">{def.shortLabel}</span>
                            <span className="text-[10px] font-bold opacity-80">{def.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-3 gap-2 w-full max-w-md mx-auto">
                      {(
                        [
                          { loc: 'left' as PitchLoc, label: '投左' },
                          { loc: 'center' as PitchLoc, label: '投中' },
                          { loc: 'right' as PitchLoc, label: '投右' },
                        ] as const
                      ).map(({ loc, label }) => (
                        <button
                          key={loc}
                          type="button"
                          disabled={!canPitch}
                          onClick={() => throwSelected(loc)}
                          className={`min-h-[48px] rounded-xl font-bold text-sm border transition-all touch-manipulation ${
                            canPitch
                              ? 'bg-emerald-700/40 border-emerald-400/40 text-emerald-100 hover:bg-emerald-600/50 active:scale-95'
                              : 'bg-zinc-900/60 border-white/5 opacity-40 cursor-not-allowed'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        )}

        {gameState.mode !== 'playing' && (
          <div className="text-zinc-500 text-xs flex flex-wrap gap-4 sm:gap-8 font-medium justify-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>打擊方（客場）</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>投球方（主場）</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
