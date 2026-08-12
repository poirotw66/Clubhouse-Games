/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playError, playGoal, playLose, playScore, playWin } from '@clubhouse/shared/synthAudio';
import { TouchButton, touchControlsWrapClass } from '@clubhouse/shared/TouchButton';
import { Trophy, Play, Target, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DERBY_SWINGS,
  DIFFICULTY,
  DIFFICULTY_LABELS,
  PLAY_MODE_LABELS,
  cpuSwingTargetY,
  gradeFairLanding,
  type Difficulty,
  type PlayMode,
} from './difficulty';
import {
  loadBests,
  saveBests,
  updateDerbyBests,
  updateMatchBests,
  type BaseballBests,
} from './stats';
import { fieldDirtImage, fieldGrassImage, fieldSkyImage } from './fieldArt';

// --- Constants & Types ---

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRAVITY = 600;
const AIR_RESISTANCE = 0.2; // Linear drag coefficient

type GameMode = 'menu' | 'playing' | 'gameOver';
type PitchType = 'fast' | 'slow';
type PitchLoc = 'left' | 'center' | 'right';
type SwingDir = 'left' | 'center' | 'right';

type BallState = 'idle' | 'pitching' | 'flying';

interface GameState {
  mode: GameMode;
  playMode: PlayMode;
  difficulty: Difficulty;
  inning: number;
  halfInning: number; // 0: Top, 1: Bottom
  score: { away: number; home: number };
  outs: number;
  strikes: number;
  balls: number;
  bases: [boolean, boolean, boolean]; // 1st, 2nd, 3rd
  ballPos: { x: number; y: number; z: number } | null;
  ballVel: { x: number; y: number; z: number } | null;
  ballTrail: { x: number; y: number; z: number; alpha: number }[];
  ballState: BallState;
  hitEffect: number; // 0 to 1
  isPitching: boolean;
  pitchType: PitchType | null;
  pitchLoc: PitchLoc | null;
  swingTime: number | null;
  swingDir: SwingDir;
  handedness: 'left' | 'right';
  resultText: string;
  resultTimer: number;
  lastHitType: 'foul' | 'fair' | null;
  contactQuality: number;
  /** Countdown before the next CPU pitch (avoids stacking setTimeouts). */
  cpuPitchTimer: number | null;
  /** CPU has locked a swing decision for this pitch. */
  cpuSwingLocked: boolean;
  cpuSwingTargetY: number | null;
  cpuWillSwing: boolean;
  derbySwingsLeft: number;
  derbyHrs: number;
  derbyBestDist: number;
  /** True when the current plate appearance is finished. */
  atBatOver: boolean;
}

// --- Game Engine ---

class GameEngine {
  state: GameState;
  onStateChange: (state: GameState) => void;

  constructor(onStateChange: (state: GameState) => void) {
    this.onStateChange = onStateChange;
    this.state = this.getInitialState();
  }

  getInitialState(): GameState {
    return {
      mode: 'menu',
      playMode: 'match',
      difficulty: 'normal',
      inning: 1,
      halfInning: 0,
      score: { away: 0, home: 0 },
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
      swingTime: null,
      swingDir: 'center',
      handedness: 'right',
      resultText: '',
      resultTimer: 0,
      lastHitType: null,
      contactQuality: 0.5,
      cpuPitchTimer: null,
      cpuSwingLocked: false,
      cpuSwingTargetY: null,
      cpuWillSwing: false,
      derbySwingsLeft: DERBY_SWINGS,
      derbyHrs: 0,
      derbyBestDist: 0,
      atBatOver: false,
    };
  }

  get cfg() {
    return DIFFICULTY[this.state.difficulty];
  }

  reset() {
    const handedness = this.state.handedness;
    const difficulty = this.state.difficulty;
    const playMode = this.state.playMode;
    this.state = this.getInitialState();
    this.state.handedness = handedness;
    this.state.difficulty = difficulty;
    this.state.playMode = playMode;
    this.onStateChange(this.state);
  }

  start(playMode?: PlayMode, difficulty?: Difficulty) {
    if (playMode) this.state.playMode = playMode;
    if (difficulty) this.state.difficulty = difficulty;
    this.state.mode = 'playing';
    this.state.inning = 1;
    this.state.halfInning = 0;
    this.state.score = { away: 0, home: 0 };
    this.state.outs = 0;
    this.state.bases = [false, false, false];
    this.state.derbySwingsLeft = DERBY_SWINGS;
    this.state.derbyHrs = 0;
    this.state.derbyBestDist = 0;
    if (this.state.playMode === 'derby') this.state.halfInning = 0;
    this.nextBatter();
    this.onStateChange(this.state);
  }

  nextBatter() {
    this.state.strikes = 0;
    this.state.balls = 0;
    this.state.atBatOver = false;
    this.readyNextPitch();
  }

  /** Same batter, next pitch — keeps the count. */
  readyNextPitch() {
    this.state.ballPos = null;
    this.state.ballVel = null;
    this.state.ballState = 'idle';
    this.state.isPitching = false;
    this.state.pitchType = null;
    this.state.pitchLoc = null;
    this.state.swingTime = null;
    this.state.cpuPitchTimer = null;
    this.state.cpuSwingLocked = false;
    this.state.cpuSwingTargetY = null;
    this.state.cpuWillSwing = false;
    this.state.contactQuality = 0.5;
  }

  get isPlayerBatting() {
    if (this.state.playMode === 'derby') return true;
    return this.state.halfInning === 0;
  }

  handlePitch(type: PitchType, loc: PitchLoc) {
    if (this.state.ballState !== 'idle' || this.state.ballPos) return;
    if (this.state.resultTimer > 0) return;

    this.state.isPitching = true;
    this.state.ballState = 'pitching';
    this.state.pitchType = type;
    this.state.pitchLoc = loc;
    this.state.ballPos = { x: 400, y: 150, z: 20 };
    this.state.cpuPitchTimer = null;
    this.state.cpuSwingLocked = false;
    this.state.cpuSwingTargetY = null;
    this.state.cpuWillSwing = false;

    const speed = type === 'fast' ? 500 : 300;
    let targetX = 400;
    if (loc === 'left') targetX = 370;
    if (loc === 'right') targetX = 430;

    const dx = targetX - 400;
    const dy = 450 - 150;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.state.ballVel = {
      x: (dx / dist) * speed,
      y: (dy / dist) * speed,
      z: -5,
    };

    this.onStateChange(this.state);
  }

  handleSwing() {
    if (this.state.ballState !== 'pitching' || this.state.swingTime !== null) return;
    this.state.swingTime = 0.2; // Swing duration
    this.onStateChange(this.state);
  }

  update(dt: number) {
    if (this.state.mode !== 'playing') return;

    if (this.state.resultTimer > 0) {
      this.state.resultTimer -= dt;
      if (this.state.resultTimer <= 0) {
        this.state.resultText = '';
        if (this.state.atBatOver || this.state.playMode === 'derby') {
          this.nextBatter();
        } else {
          this.readyNextPitch();
        }
      }
      this.onStateChange(this.state);
      return;
    }

    // CPU Pitching — single countdown, never stacks timers.
    if (this.isPlayerBatting && this.state.ballState === 'idle' && this.state.resultTimer <= 0) {
      if (this.state.cpuPitchTimer === null) {
        const { cpuPitchDelayMin, cpuPitchDelayMax } = this.cfg;
        this.state.cpuPitchTimer =
          cpuPitchDelayMin + Math.random() * (cpuPitchDelayMax - cpuPitchDelayMin);
      } else {
        this.state.cpuPitchTimer -= dt;
        if (this.state.cpuPitchTimer <= 0) {
          this.state.cpuPitchTimer = null;
          const type: PitchType = Math.random() < this.cfg.cpuFastPitchChance ? 'fast' : 'slow';
          const locs: PitchLoc[] = ['left', 'center', 'right'];
          // Harder CPU throws more strikes into center / edges mix.
          const loc =
            this.state.difficulty === 'easy'
              ? locs[Math.floor(Math.random() * 3)]
              : Math.random() < 0.45
                ? 'center'
                : locs[Math.floor(Math.random() * 3)];
          this.handlePitch(type, loc);
        }
      }
    }

    // CPU Batting — lock aim once, swing at target Y (timing), match direction.
    if (!this.isPlayerBatting && this.state.ballState === 'pitching' && this.state.swingTime === null) {
      const ball = this.state.ballPos;
      if (ball) {
        if (!this.state.cpuSwingLocked && ball.y > 360) {
          this.state.cpuSwingLocked = true;
          const takeBall =
            this.state.pitchLoc !== 'center' && Math.random() < this.cfg.cpuTakeBall;
          this.state.cpuWillSwing = !takeBall && Math.random() < this.cfg.cpuSwingRate;
          this.state.cpuSwingTargetY = cpuSwingTargetY(this.cfg.cpuAimSkill, Math.random);
          if (this.state.cpuWillSwing) {
            if (Math.random() < this.cfg.cpuAimDir && this.state.pitchLoc) {
              this.state.swingDir = this.state.pitchLoc;
            } else {
              this.state.swingDir = (['left', 'center', 'right'] as SwingDir[])[
                Math.floor(Math.random() * 3)
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
      // Update Trail
      this.state.ballTrail.push({ ...this.state.ballPos, alpha: 1.0 });
      if (this.state.ballTrail.length > 25) this.state.ballTrail.shift();
      this.state.ballTrail.forEach(t => t.alpha *= 0.92);

      // Apply Air Resistance (Drag)
      const speed = Math.sqrt(
        this.state.ballVel.x ** 2 + 
        this.state.ballVel.y ** 2 + 
        this.state.ballVel.z ** 2
      );
      if (speed > 0) {
        const drag = AIR_RESISTANCE * speed * dt;
        this.state.ballVel.x -= (this.state.ballVel.x / speed) * drag;
        this.state.ballVel.y -= (this.state.ballVel.y / speed) * drag;
        this.state.ballVel.z -= (this.state.ballVel.z / speed) * drag;
      }

      this.state.ballPos.x += this.state.ballVel.x * dt;
      this.state.ballPos.y += this.state.ballVel.y * dt;
      this.state.ballPos.z += this.state.ballVel.z * dt;

      if (this.state.ballState === 'pitching') {
        // Check for hit - Increased detection radius for better experience
        if (this.state.swingTime !== null && this.state.swingTime > -0.1) {
          const dist = Math.sqrt(
            Math.pow(this.state.ballPos.x - 400, 2) + Math.pow(this.state.ballPos.y - 450, 2)
          );
          if (dist < this.cfg.hitRadius) {
            this.processHitPhysics();
            return;
          }
        }

        // Check for strike/ball when ball passes home plate
        if (this.state.ballPos.y > 520) {
          this.processMiss();
        }
      } else if (this.state.ballState === 'flying') {
        // Gravity
        this.state.ballVel.z -= GRAVITY * dt;

        // Check for landing or HR
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

    const timing = this.state.swingTime || 0;
    let dirBias = 0;
    if (this.state.swingDir === 'left') dirBias = -0.5;
    if (this.state.swingDir === 'right') dirBias = 0.5;

    // Reward matching swing direction to pitch location.
    const locMatch =
      this.state.pitchLoc && this.state.swingDir === this.state.pitchLoc ? 0.12 : 0;

    const angleOffset = timing * 5 + dirBias;
    const powerFactor = Math.max(0.15, 1 - Math.abs(timing) * 4);
    const rand = Math.random();
    const hitScore = Math.min(1, powerFactor * 0.75 + rand * 0.15 + locMatch);
    this.state.contactQuality = hitScore;

    const speed = 400 + hitScore * 400;
    const baseAngle = -Math.PI / 2;
    const finalAngle = baseAngle + angleOffset;

    this.state.ballVel = {
      x: Math.cos(finalAngle) * speed,
      y: Math.sin(finalAngle) * speed,
      z: 150 + hitScore * 250,
    };

    this.onStateChange(this.state);
  }

  determineResult(type: 'HR' | 'LANDED') {
    let result = 'OUT';
    let bases = 0;
    let hitType: 'foul' | 'fair' | null = null;

    const x = this.state.ballPos?.x || 400;
    const y = this.state.ballPos?.y || 450;
    const dist = Math.sqrt(Math.pow(x - 400, 2) + Math.pow(y - 450, 2));
    const quality = this.state.contactQuality;

    const isFoul = Math.abs(x - 400) > Math.abs(y - 450) + 5 || x < 0 || x > 800;

    if (type === 'HR') {
      if (isFoul) {
        result = '界外球 (FOUL)';
        hitType = 'foul';
        this.state.strikes = Math.min(2, this.state.strikes + 1);
      } else if (quality < 0.35) {
        // Weak loft that clears the wall visually still dies as a deep out in arcade.
        result = '牆前接殺 (OUT)';
        hitType = 'fair';
        this.state.outs++;
      } else {
        result = '全壘打 (HOME RUN!)';
        hitType = 'fair';
        bases = 4;
        if (this.state.playMode === 'derby') {
          this.state.derbyHrs += 1;
          this.state.derbyBestDist = Math.max(this.state.derbyBestDist, dist);
        }
      }
    } else if (isFoul) {
      result = '界外球 (FOUL)';
      hitType = 'foul';
      this.state.strikes = Math.min(2, this.state.strikes + 1);
    } else {
      hitType = 'fair';
      const graded = gradeFairLanding(dist, quality, this.cfg);
      result = graded.result;
      bases = graded.bases;
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

    // Fair balls and outs end the at-bat; fouls keep the same batter.
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
      this.checkInningEnd();
    }
  }

  processMiss() {
    const loc = this.state.pitchLoc;
    const isStrike =
      loc === 'center' || (loc !== null && Math.random() > 0.55);

    if (this.state.swingTime !== null) {
      this.state.strikes++;
      this.state.resultText = '揮棒落空 (STRIKE)';
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
    this.checkInningEnd();
  }

  advanceRunners(num: number) {
    const newBases = [false, false, false];
    let runs = 0;
    const currentRunners = [...this.state.bases];
    
    if (num === 4) {
      runs = currentRunners.filter(b => b).length + 1;
    } else {
      // Logic for advancing runners
      let runners = currentRunners.map((b, i) => b ? i + 1 : 0).filter(r => r > 0);
      runners = runners.map(r => r + num);
      
      runs += runners.filter(r => r > 3).length;
      runners.filter(r => r <= 3).forEach(r => {
        newBases[r - 1] = true;
      });
      newBases[num - 1] = true;
    }

    if (this.state.halfInning === 0) {
      this.state.score.away += runs;
    } else {
      this.state.score.home += runs;
    }
    this.state.bases = newBases as [boolean, boolean, boolean];
  }

  checkInningEnd() {
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

      if (this.state.inning > 3) {
        this.state.mode = 'gameOver';
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Sky plate behind the diamond
    const sky = fieldSkyImage();
    if (sky.complete && sky.naturalWidth > 0) {
      ctx.drawImage(sky, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // 1. Draw Field Base (textured grass)
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
      ctx.fillStyle = '#388e3c';
      const gridSize = 40;
      for (let x = -400; x < 1200; x += gridSize * 2) {
        for (let y = -600; y < 600; y += gridSize * 2) {
          ctx.fillRect(x, y, gridSize, gridSize);
          ctx.fillRect(x + gridSize, y + gridSize, gridSize, gridSize);
        }
      }
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

    // 3. Draw Warning Track (Tan Arc)
    fillDirt();
    ctx.beginPath();
    ctx.arc(400, 450, 650, Math.PI * 1.25, Math.PI * 1.75);
    ctx.lineTo(400, 450);
    ctx.fill();

    // 4. Draw Outfield Fence (Blue Arc)
    ctx.strokeStyle = '#0277bd';
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.arc(400, 450, 655, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();

    // 5. Draw Infield Dirt Diamond (Base Paths)
    fillDirt();
    ctx.beginPath();
    ctx.moveTo(400, 490); // Home area dirt
    ctx.lineTo(550, 300); // Path to 1st
    ctx.lineTo(400, 150); // Path to 2nd
    ctx.lineTo(250, 300); // Path to 3rd
    ctx.closePath();
    ctx.fill();

    // 5b. Home Plate Circular Dirt Area
    ctx.beginPath();
    ctx.arc(400, 450, 45, 0, Math.PI * 2);
    ctx.fill();

    // 6. Draw Infield Grass (The "Diamond" inside the paths)
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

    // 7. Draw Pitcher's Mound
    fillDirt();
    ctx.beginPath();
    ctx.arc(400, 250, 25, 0, Math.PI * 2);
    ctx.fill();
    // Pitcher's Plate (Rubber)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(385, 248, 30, 4);

    // 8. Draw Strike Zone Guide
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(360, 420, 80, 60);
    ctx.fillRect(360, 420, 80, 60);
    ctx.setLineDash([]);

    // 9. Draw Foul Lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 450); // Home
    const leftFoulX = 400 + 655 * Math.cos(Math.PI * 1.25);
    const leftFoulY = 450 + 655 * Math.sin(Math.PI * 1.25);
    const rightFoulX = 400 + 655 * Math.cos(Math.PI * 1.75);
    const rightFoulY = 450 + 655 * Math.sin(Math.PI * 1.75);
    
    ctx.lineTo(leftFoulX, leftFoulY);
    ctx.moveTo(400, 450);
    ctx.lineTo(rightFoulX, rightFoulY);
    ctx.stroke();

    // 10. Foul Poles
    ctx.fillStyle = '#fdd835';
    ctx.fillRect(leftFoulX - 2, leftFoulY - 100, 4, 100);
    ctx.fillRect(rightFoulX - 2, rightFoulY - 100, 4, 100);

    // 10b. Backstop (Blue arc behind home)
    ctx.strokeStyle = '#0277bd';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(400, 450, 80, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();

    // 10c. Batter's Boxes
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(365, 435, 25, 40); // Left box
    ctx.strokeRect(410, 435, 25, 40); // Right box

    // 10d. Coach's Boxes
    ctx.strokeRect(550, 330, 40, 20); // 1st base side
    ctx.strokeRect(210, 330, 40, 20); // 3rd base side

    // 10e. Dugouts
    ctx.fillStyle = '#455a64';
    ctx.fillRect(580, 400, 120, 30); // 1st base side dugout
    ctx.fillRect(100, 400, 120, 30); // 3rd base side dugout
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.fillText('DUGOUT', 620, 420);
    ctx.fillText('DUGOUT', 140, 420);

    // 11. Bases
    const drawBase = (x: number, y: number, active: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4); // Diamond shape
      ctx.fillStyle = active ? '#fbbf24' : '#ffffff';
      ctx.shadowBlur = active ? 15 : 2;
      ctx.shadowColor = active ? '#fbbf24' : 'rgba(0,0,0,0.3)';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.restore();
    };

    drawBase(400, 450, false); // Home
    drawBase(550, 300, this.state.bases[0]); // 1st
    drawBase(400, 150, this.state.bases[1]); // 2nd
    drawBase(250, 300, this.state.bases[2]); // 3rd

    // 12. Pitcher & Batter
    ctx.fillStyle = '#ef4444'; // Pitcher
    ctx.beginPath();
    ctx.arc(400, 250, 15, 0, Math.PI * 2);
    ctx.fill();

    // Batter
    const batterX = this.state.handedness === 'right' ? 365 : 435;
    const batterY = 485;
    
    // Draw Batter Body
    ctx.fillStyle = '#3b82f6'; 
    ctx.beginPath();
    ctx.arc(batterX, batterY, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Batter Head
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.arc(batterX, batterY - 5, 8, 0, Math.PI * 2);
    ctx.fill();

    // Bat Visual
    const batPivotX = this.state.handedness === 'right' ? batterX + 12 : batterX - 12;
    const batPivotY = batterY - 5;
    
    const batLen = 65;
    const batWidth = 9;
    
    ctx.save();
    ctx.translate(batPivotX, batPivotY);
    
    // Idle angles: Right-handed points back-right, Left-handed points back-left
    let batAngle = this.state.handedness === 'right' ? -Math.PI / 8 : -Math.PI * 7/8;
    
    if (this.state.swingTime !== null) {
      const progress = (0.2 - this.state.swingTime) / 0.4;
      if (this.state.handedness === 'right') {
        // Swing from back-right to front-left
        batAngle = -Math.PI / 8 - progress * Math.PI * 1.1;
      } else {
        // Swing from back-left to front-right
        batAngle = -Math.PI * 7/8 + progress * Math.PI * 1.1;
      }
    }
    
    ctx.rotate(batAngle);
    
    const gradient = ctx.createLinearGradient(0, 0, batLen, 0);
    gradient.addColorStop(0, '#8b4513'); // Handle
    gradient.addColorStop(0.3, '#d2b48c'); // Barrel start
    gradient.addColorStop(1, '#8b4513'); // Barrel end
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(0, -batWidth/2, batLen, batWidth, 4);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();

    // Ball Trail
    if (this.state.ballTrail.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < this.state.ballTrail.length; i++) {
        const p1 = this.state.ballTrail[i - 1];
        const p2 = this.state.ballTrail[i];
        const ratio = i / this.state.ballTrail.length;
        
        ctx.strokeStyle = `rgba(255, 255, 255, ${p2.alpha * 0.3 * ratio})`;
        ctx.lineWidth = (2 + (p2.z / 100) * 2) * ratio;
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y - p1.z);
        ctx.lineTo(p2.x, p2.y - p2.z);
        ctx.stroke();
      }
    }

    // Ball
    if (this.state.ballPos) {
      const { x, y, z } = this.state.ballPos;
      // Shadow on the ground
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      const shadowSize = Math.max(2, 6 - (z / 100));
      ctx.beginPath();
      ctx.ellipse(x, y, shadowSize * 1.5, shadowSize, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ball in the air
      ctx.fillStyle = '#ffffff';
      const ballSize = 6 + (z / 100) * 4;
      ctx.beginPath();
      ctx.arc(x, y - z, ballSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Ball seams (simple)
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1 + (z / 200);
      ctx.beginPath();
      ctx.arc(x, y - z, ballSize * 0.7, 0.2, 1.2);
      ctx.stroke();
    }

    // Result Overlay
    if (this.state.resultText) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 240, CANVAS_WIDTH, 120);
      
      // Foul/Fair Indicator
      if (this.state.lastHitType) {
        ctx.fillStyle = this.state.lastHitType === 'fair' ? '#4ade80' : '#f87171';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.fillText(this.state.lastHitType.toUpperCase(), CANVAS_WIDTH / 2, 270);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 15;
      ctx.fillText(this.state.resultText, CANVAS_WIDTH / 2, 310);
      ctx.restore();
    }

    // Hit Flash Effect
    if (this.state.hitEffect > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.state.hitEffect * 0.4})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }
}

// --- React Component ---

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  // Initialize state with the engine's initial state directly
  const [gameState, setGameState] = useState<GameState>(() => {
    const tempEngine = new GameEngine(() => {});
    return tempEngine.getInitialState();
  });
  const prevModeRef = useRef<GameMode>('menu');
  const prevScoreRef = useRef({ away: 0, home: 0 });
  const prevResultRef = useRef('');
  const [bests, setBests] = useState<BaseballBests>(() => loadBests());

  useEffect(() => {
    const engine = new GameEngine((state) => {
      if (state.score.away > prevScoreRef.current.away) playScore();
      if (state.score.home > prevScoreRef.current.home) playError();
      if (state.resultText && state.resultText !== prevResultRef.current) {
        if (state.resultText.includes('HOME RUN')) playGoal();
        else if (state.resultText.includes('OUT') || state.resultText.includes('STRIKEOUT')) {
          playError();
        }
      }
      if (state.mode === 'gameOver' && prevModeRef.current !== 'gameOver') {
        if (state.playMode === 'derby') {
          if (state.derbyHrs > 0) playWin();
          else playLose();
          const next = updateDerbyBests(loadBests(), state.derbyHrs, state.derbyBestDist);
          saveBests(next);
          setBests(next);
        } else {
          if (state.score.away > state.score.home) playWin();
          else if (state.score.away < state.score.home) playLose();
          const next = updateMatchBests(loadBests(), state.score.away, state.score.home);
          saveBests(next);
          setBests(next);
        }
      }
      prevModeRef.current = state.mode;
      prevScoreRef.current = { ...state.score };
      prevResultRef.current = state.resultText || '';
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
      const dt = (time - lastTime) / 1000;
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
        if (engine.state.mode === 'playing' && engine.isPlayerBatting) {
          engine.state.swingDir = 'left';
          engine.onStateChange(engine.state);
        }
      } else if (e.code === 'ArrowRight') {
        if (engine.state.mode === 'playing' && engine.isPlayerBatting) {
          engine.state.swingDir = 'right';
          engine.onStateChange(engine.state);
        }
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        if (engine.state.mode === 'playing' && engine.isPlayerBatting) {
          engine.state.swingDir = 'center';
          engine.onStateChange(engine.state);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleStart = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.start(eng.state.playMode, eng.state.difficulty);
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

  const handlePitch = (type: PitchType, loc: PitchLoc) => {
    engineRef.current?.handlePitch(type, loc);
  };

  const setSwingDirection = (dir: 'left' | 'center' | 'right') => {
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-950 overflow-x-hidden w-full">
      <BackToMenu />
      {/* Cap the fixed 800px canvas so phone viewports are not forced ~802px wide */}
      <div className="relative w-full max-w-[800px] bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10">
        {/* Scoreboard */}
        <div className="absolute top-0 left-0 right-0 p-3 sm:p-6 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-start gap-2">
          {gameState.playMode === 'derby' ? (
            <div className="flex gap-4 sm:gap-8 min-w-0">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">全壘打</span>
                <span className="text-3xl sm:text-4xl font-mono font-bold text-yellow-400">{gameState.derbyHrs}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">剩餘揮棒</span>
                <span className="text-3xl sm:text-4xl font-mono font-bold text-blue-400">{gameState.derbySwingsLeft}</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 sm:gap-8 min-w-0">
              <div className="flex items-center gap-2">
                <img
                  src={`${import.meta.env.BASE_URL}portraits/batter.jpg`}
                  alt=""
                  className="w-9 h-9 rounded-lg object-cover border border-blue-400/40"
                  draggable={false}
                />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Away (Player)</span>
                  <span className="text-3xl sm:text-4xl font-mono font-bold text-blue-400">{gameState.score.away}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Home (CPU)</span>
                  <span className="text-3xl sm:text-4xl font-mono font-bold text-red-400">{gameState.score.home}</span>
                </div>
                <img
                  src={`${import.meta.env.BASE_URL}portraits/pitcher.jpg`}
                  alt=""
                  className="w-9 h-9 rounded-lg object-cover border border-red-400/40"
                  draggable={false}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
              <span className="text-xs font-bold text-zinc-400">
                {gameState.playMode === 'derby'
                  ? `全壘打大賽 · ${DIFFICULTY_LABELS[gameState.difficulty]}`
                  : `${gameState.inning} 局 ${gameState.halfInning === 0 ? '上' : '下'} · ${DIFFICULTY_LABELS[gameState.difficulty]}`}
              </span>
            </div>
            {gameState.playMode !== 'derby' && (
              <>
            <div className="flex gap-1 mt-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < gameState.outs ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-zinc-800'}`} />
              ))}
              <span className="text-[10px] text-zinc-500 ml-1 font-bold uppercase">Outs</span>
            </div>
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < gameState.strikes ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]' : 'bg-zinc-800'}`} />
              ))}
              <span className="text-[10px] text-zinc-500 ml-1 font-bold uppercase">Strikes</span>
            </div>
            <div className="flex gap-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < gameState.balls ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-zinc-800'}`} />
              ))}
              <span className="text-[10px] text-zinc-500 ml-1 font-bold uppercase">Balls</span>
            </div>
              </>
            )}
          </div>
        </div>

        {/* Game Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block w-full max-w-full h-auto"
        />

        {/* Overlays */}
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
              <h1 className="text-4xl sm:text-6xl font-bold tracking-tighter mb-1 italic text-center">TOY BASEBALL</h1>
              <p className="text-zinc-400 mb-4 text-sm tracking-widest uppercase">玩具棒球機檯</p>

              <div className="w-full max-w-md mb-3">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold text-center mb-2">模式</p>
                <div className="flex gap-2 justify-center">
                  {(['match', 'derby'] as PlayMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMenuPlayMode(m)}
                      className={`px-4 py-2 rounded-full font-bold text-sm transition-all ${
                        gameState.playMode === m
                          ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.45)]'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {PLAY_MODE_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full max-w-md mb-3">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold text-center mb-2">難度</p>
                <div className="flex gap-2 justify-center">
                  {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setMenuDifficulty(d)}
                      className={`px-4 py-2 rounded-full font-bold text-sm transition-all ${
                        gameState.difficulty === d
                          ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {DIFFICULTY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    engineRef.current!.state.handedness = 'right';
                    setGameState({ ...engineRef.current!.state });
                  }}
                  className={`px-6 py-2 rounded-full font-bold transition-all ${gameState.handedness === 'right' ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  右打 (R)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    engineRef.current!.state.handedness = 'left';
                    setGameState({ ...engineRef.current!.state });
                  }}
                  className={`px-6 py-2 rounded-full font-bold transition-all ${gameState.handedness === 'left' ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  左打 (L)
                </button>
              </div>

              <p className="text-zinc-500 text-xs mb-3 text-center max-w-sm">
                {gameState.playMode === 'derby'
                  ? `限 ${DERBY_SWINGS} 次揮擊，拚全壘打數。對準時機＋方向。`
                  : '三局制對戰電腦。打者抓時機揮棒；投手選球路。'}
              </p>

              <p className="text-zinc-400 text-xs mb-4 text-center font-medium">
                {gameState.playMode === 'derby'
                  ? `個人最佳：全壘打 ${bests.derbyBestHrs} · 最遠 ${Math.round(bests.derbyBestDist)}`
                  : `個人最佳：勝場 ${bests.matchWins} · 連勝 ${bests.matchWinStreak}${
                      bests.matchBestRuns > 0 ? ` · 勝場最高得分 ${bests.matchBestRuns}` : ''
                    }`}
              </p>

              <button
                type="button"
                onClick={handleStart}
                className="group relative flex items-center gap-3 bg-white text-black px-10 py-4 rounded-full font-bold text-xl hover:scale-105 transition-all active:scale-95"
              >
                <Play className="fill-current" />
                {gameState.playMode === 'derby' ? '開始大賽' : '開始比賽'}
                <div className="absolute -inset-1 bg-white/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
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
                      { label: '勝場', value: bests.matchWins },
                      { label: '連勝', value: bests.matchWinStreak },
                      { label: '難度', value: DIFFICULTY_LABELS[gameState.difficulty] },
                    ]
              }
              onPrimary={handleReset}
              primaryLabel="回選單"
            />
          )}
        </AnimatePresence>

        {/* Controls Overlay */}
        {gameState.mode === 'playing' && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
            {gameState.playMode === 'derby' || gameState.halfInning === 0 ? (
              <>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex flex-col items-center gap-2 hidden md:flex"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <kbd className="bg-zinc-800 px-3 py-1 rounded-md font-mono text-sm border border-white/10">SPACE</kbd>
                    <span className="text-sm font-bold text-zinc-300">揮棒打擊</span>
                  </div>
                  <div className="w-px h-4 bg-white/10" />
                  <div className="flex items-center gap-2">
                    <kbd className="bg-zinc-800 px-3 py-1 rounded-md font-mono text-sm border border-white/10">← →</kbd>
                    <span className="text-sm font-bold text-zinc-300">調整方向</span>
                  </div>
                </div>
                <div className="flex gap-4 mt-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${gameState.swingDir === 'left' ? 'text-blue-400' : 'text-zinc-600'}`}>Pull (左)</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${gameState.swingDir === 'center' ? 'text-blue-400' : 'text-zinc-600'}`}>Center (中)</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${gameState.swingDir === 'right' ? 'text-blue-400' : 'text-zinc-600'}`}>Push (右)</span>
                </div>
              </motion.div>
              <div className={`${touchControlsWrapClass} pointer-events-auto`}>
                <div className="flex gap-2 w-full justify-center">
                  <TouchButton label="← 拉" ariaLabel="Pull left" onClick={() => setSwingDirection('left')} />
                  <TouchButton label="中" ariaLabel="Center" onClick={() => setSwingDirection('center')} />
                  <TouchButton label="推 →" ariaLabel="Push right" onClick={() => setSwingDirection('right')} />
                </div>
                <TouchButton label="揮棒" ariaLabel="Swing" wide accent onClick={handleBattingSwing} />
              </div>
              </>
            ) : (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-black/60 backdrop-blur-md p-6 rounded-3xl border border-white/10 flex flex-col gap-4 pointer-events-auto"
              >
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => handlePitch('fast', 'left')}
                    className="flex flex-col items-center gap-1 p-3 bg-zinc-800 hover:bg-blue-600 rounded-xl transition-colors group"
                  >
                    <Zap className="w-5 h-5 text-blue-400 group-hover:text-white" />
                    <span className="text-[10px] font-bold">快速左</span>
                  </button>
                  <button
                    onClick={() => handlePitch('fast', 'center')}
                    className="flex flex-col items-center gap-1 p-3 bg-zinc-800 hover:bg-blue-600 rounded-xl transition-colors group"
                  >
                    <Target className="w-5 h-5 text-blue-400 group-hover:text-white" />
                    <span className="text-[10px] font-bold">快速中</span>
                  </button>
                  <button
                    onClick={() => handlePitch('fast', 'right')}
                    className="flex flex-col items-center gap-1 p-3 bg-zinc-800 hover:bg-blue-600 rounded-xl transition-colors group"
                  >
                    <Zap className="w-5 h-5 text-blue-400 group-hover:text-white" />
                    <span className="text-[10px] font-bold">快速右</span>
                  </button>
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => handlePitch('slow', 'left')}
                    className="flex flex-col items-center gap-1 p-3 bg-zinc-800 hover:bg-emerald-600 rounded-xl transition-colors group"
                  >
                    <ChevronLeft className="w-5 h-5 text-emerald-400 group-hover:text-white" />
                    <span className="text-[10px] font-bold">慢速左</span>
                  </button>
                  <button
                    onClick={() => handlePitch('slow', 'center')}
                    className="flex flex-col items-center gap-1 p-3 bg-zinc-800 hover:bg-emerald-600 rounded-xl transition-colors group"
                  >
                    <Target className="w-5 h-5 text-emerald-400 group-hover:text-white" />
                    <span className="text-[10px] font-bold">慢速中</span>
                  </button>
                  <button
                    onClick={() => handlePitch('slow', 'right')}
                    className="flex flex-col items-center gap-1 p-3 bg-zinc-800 hover:bg-emerald-600 rounded-xl transition-colors group"
                  >
                    <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:text-white" />
                    <span className="text-[10px] font-bold">慢速右</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 text-zinc-500 text-xs flex flex-wrap gap-4 sm:gap-8 font-medium justify-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>打擊方 (Away)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>投球方 (Home)</span>
        </div>
      </div>
    </div>
  );
}
