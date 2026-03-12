/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Play, RotateCcw, ChevronRight, ChevronLeft, Target, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    };
  }

  reset() {
    this.state = this.getInitialState();
    this.onStateChange(this.state);
  }

  start() {
    this.state.mode = 'playing';
    this.nextBatter();
    this.onStateChange(this.state);
  }

  nextBatter() {
    this.state.strikes = 0;
    this.state.balls = 0;
    this.state.ballPos = null;
    this.state.ballVel = null;
    this.state.ballState = 'idle';
    this.state.isPitching = false;
    this.state.pitchType = null;
    this.state.pitchLoc = null;
    this.state.swingTime = null;
  }

  get isPlayerBatting() {
    return this.state.halfInning === 0; // Player is Away team
  }

  handlePitch(type: PitchType, loc: PitchLoc) {
    if (this.state.ballState !== 'idle' || this.state.ballPos) return;

    this.state.isPitching = true;
    this.state.ballState = 'pitching';
    this.state.pitchType = type;
    this.state.pitchLoc = loc;
    this.state.ballPos = { x: 400, y: 150, z: 20 }; // Pitcher mound
    
    const speed = type === 'fast' ? 500 : 300;
    let targetX = 400;
    if (loc === 'left') targetX = 370;
    if (loc === 'right') targetX = 430;

    const dx = targetX - 400;
    const dy = 450 - 150; // Home plate is at y=450
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    this.state.ballVel = {
      x: (dx / dist) * speed,
      y: (dy / dist) * speed,
      z: -5 // Slight downward pitch
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
        this.nextBatter();
      }
      this.onStateChange(this.state);
      return;
    }

    // CPU Pitching Logic
    if (this.isPlayerBatting && this.state.ballState === 'idle') {
      // Simple delay before CPU pitches
      setTimeout(() => {
        if (this.state.mode === 'playing' && this.isPlayerBatting && this.state.ballState === 'idle') {
          const types: PitchType[] = ['fast', 'slow'];
          const locs: PitchLoc[] = ['left', 'center', 'right'];
          this.handlePitch(
            types[Math.floor(Math.random() * types.length)],
            locs[Math.floor(Math.random() * locs.length)]
          );
        }
      }, 1000);
    }

    // CPU Batting Logic
    if (!this.isPlayerBatting && this.state.ballState === 'pitching' && this.state.swingTime === null) {
      if (this.state.ballPos && this.state.ballPos.y > 420 && this.state.ballPos.y < 460) {
        if (Math.random() > 0.4) {
          this.state.swingDir = ['left', 'center', 'right'][Math.floor(Math.random() * 3)] as SwingDir;
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
          // Radius increased from 30 to 60 for easier hitting
          if (dist < 60) {
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

    const angleOffset = timing * 5 + dirBias; 
    const powerFactor = Math.max(0.2, 1 - Math.abs(timing) * 4);
    const rand = Math.random();
    const hitScore = powerFactor * 0.8 + rand * 0.2;

    const speed = 400 + hitScore * 400;
    const baseAngle = -Math.PI / 2;
    const finalAngle = baseAngle + angleOffset;

    this.state.ballVel = {
      x: Math.cos(finalAngle) * speed,
      y: Math.sin(finalAngle) * speed,
      z: 150 + hitScore * 250 // Vertical launch
    };
    
    this.onStateChange(this.state);
  }

  determineResult(type: 'HR' | 'LANDED') {
    let result = 'OUT';
    let bases = 0;
    let hitType: 'foul' | 'fair' | null = null;

    const x = this.state.ballPos?.x || 400;
    const y = this.state.ballPos?.y || 450;

    // Precise Foul check (V-shape from home plate)
    const isFoul = Math.abs(x - 400) > Math.abs(y - 450) + 5 || x < 0 || x > 800;

    if (type === 'HR') {
      if (isFoul) {
        result = '界外球 (FOUL)';
        hitType = 'foul';
        this.state.strikes = Math.min(2, this.state.strikes + 1);
      } else {
        result = '全壘打 (HOME RUN!)';
        hitType = 'fair';
        bases = 4;
      }
    } else {
      if (isFoul) {
        result = '界外球 (FOUL)';
        hitType = 'foul';
        this.state.strikes = Math.min(2, this.state.strikes + 1);
      } else {
        hitType = 'fair';
        // Distance from home - Increased for deeper outfield
        const dist = Math.sqrt(Math.pow(x - 400, 2) + Math.pow(y - 450, 2));
        if (dist > 450) {
          result = '三壘安打 (3B)';
          bases = 3;
        } else if (dist > 300) {
          result = '二壘安打 (2B)';
          bases = 2;
        } else if (dist > 180) {
          result = '一壘安打 (1B)';
          bases = 1;
        } else {
          result = '接殺出局 (OUT)';
          this.state.outs++;
        }
      }
    }

    if (bases > 0) this.advanceRunners(bases);
    
    this.state.ballPos = null;
    this.state.ballVel = null;
    this.state.ballState = 'idle';
    this.state.resultText = result;
    this.state.resultTimer = 2.5;
    this.state.lastHitType = hitType;
    this.checkInningEnd();
  }

  processMiss() {
    // Determine if it was a strike or ball based on location
    const isStrike = this.state.pitchLoc === 'center' || (Math.random() > 0.5);
    
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

    // Rule: 3 Strikes = 1 Out
    if (this.state.strikes >= 3) {
      this.state.outs++;
      this.state.resultText = '三振出局 (STRIKEOUT)';
      this.state.strikes = 0;
      this.state.balls = 0;
    } 
    // Rule: 4 Balls = Walk
    else if (this.state.balls >= 4) {
      this.advanceRunners(1);
      this.state.resultText = '四壞保送 (WALK)';
      this.state.strikes = 0;
      this.state.balls = 0;
    }

    this.state.resultTimer = 1.5;
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

    // 1. Draw Field Base (Dark Grass)
    ctx.fillStyle = '#2e7d32'; 
    ctx.beginPath();
    ctx.moveTo(400, 550);
    ctx.lineTo(-400, 100);
    ctx.lineTo(400, -600);
    ctx.lineTo(1200, 100);
    ctx.closePath();
    ctx.fill();

    // 2. Draw Checkered Grass Pattern
    ctx.save();
    // Clip to field
    ctx.beginPath();
    ctx.moveTo(400, 550);
    ctx.lineTo(-400, 100);
    ctx.lineTo(400, -600);
    ctx.lineTo(1200, 100);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = '#388e3c';
    const gridSize = 40;
    for (let x = -400; x < 1200; x += gridSize * 2) {
      for (let y = -600; y < 600; y += gridSize * 2) {
        ctx.fillRect(x, y, gridSize, gridSize);
        ctx.fillRect(x + gridSize, y + gridSize, gridSize, gridSize);
      }
    }
    ctx.restore();

    // 3. Draw Warning Track (Tan Arc)
    ctx.fillStyle = '#c19a6b';
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
    ctx.fillStyle = '#d2b48c';
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
    ctx.fillStyle = '#388e3c';
    ctx.beginPath();
    ctx.moveTo(400, 420);
    ctx.lineTo(500, 300);
    ctx.lineTo(400, 200);
    ctx.lineTo(300, 300);
    ctx.closePath();
    ctx.fill();

    // 7. Draw Pitcher's Mound
    ctx.fillStyle = '#c19a6b';
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

  useEffect(() => {
    const engine = new GameEngine((state) => {
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
    engineRef.current?.start();
  };

  const handleReset = () => {
    engineRef.current?.reset();
  };

  const handlePitch = (type: PitchType, loc: PitchLoc) => {
    engineRef.current?.handlePitch(type, loc);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-950">
      <div className="relative bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10">
        {/* Scoreboard */}
        <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-start">
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Away (Player)</span>
              <span className="text-4xl font-mono font-bold text-blue-400">{gameState.score.away}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Home (CPU)</span>
              <span className="text-4xl font-mono font-bold text-red-400">{gameState.score.home}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
              <span className="text-xs font-bold text-zinc-400">
                {gameState.inning} 局 {gameState.halfInning === 0 ? '上' : '下'}
              </span>
            </div>
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
          </div>
        </div>

        {/* Game Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block"
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState.mode === 'menu' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20"
            >
              <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
              <h1 className="text-6xl font-bold tracking-tighter mb-2 italic">TOY BASEBALL</h1>
              <p className="text-zinc-400 mb-8 text-sm tracking-widest uppercase">玩具棒球機檯</p>
              
              <div className="flex gap-4 mb-8">
                <button
                  onClick={() => {
                    engineRef.current!.state.handedness = 'right';
                    setGameState({ ...engineRef.current!.state });
                  }}
                  className={`px-6 py-2 rounded-full font-bold transition-all ${gameState.handedness === 'right' ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  右打 (R)
                </button>
                <button
                  onClick={() => {
                    engineRef.current!.state.handedness = 'left';
                    setGameState({ ...engineRef.current!.state });
                  }}
                  className={`px-6 py-2 rounded-full font-bold transition-all ${gameState.handedness === 'left' ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  左打 (L)
                </button>
              </div>

              <button
                onClick={handleStart}
                className="group relative flex items-center gap-3 bg-white text-black px-10 py-4 rounded-full font-bold text-xl hover:scale-105 transition-all active:scale-95"
              >
                <Play className="fill-current" />
                開始比賽
                <div className="absolute -inset-1 bg-white/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </motion.div>
          )}

          {gameState.mode === 'gameOver' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-20"
            >
              <h2 className="text-5xl font-bold mb-4 italic">比賽結束</h2>
              <div className="flex gap-12 mb-12 items-center">
                <div className="text-center">
                  <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Away</p>
                  <p className="text-7xl font-mono font-bold">{gameState.score.away}</p>
                </div>
                <div className="text-4xl text-zinc-700 font-bold">VS</div>
                <div className="text-center">
                  <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Home</p>
                  <p className="text-7xl font-mono font-bold">{gameState.score.home}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-yellow-500 mb-12">
                {gameState.score.away > gameState.score.home ? '🏆 玩家獲勝！' : gameState.score.away < gameState.score.home ? '💻 電腦獲勝！' : '🤝 平手！'}
              </p>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-8 py-3 rounded-full font-bold transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                重新開始
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls Overlay */}
        {gameState.mode === 'playing' && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
            {gameState.halfInning === 0 ? (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex flex-col items-center gap-2"
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

      <div className="mt-8 text-zinc-500 text-xs flex gap-8 font-medium">
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
