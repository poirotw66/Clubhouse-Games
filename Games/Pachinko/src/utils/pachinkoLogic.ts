/**
 * Pachinko: vertical board, ball launched upward, bounces off pins, falls into slots.
 * Gravity + circle-circle collision with pins, slots at bottom for scoring.
 */

export const BOARD_WIDTH = 380;
export const BOARD_HEIGHT = 560;
export const BALL_RADIUS = 8;
export const PIN_RADIUS = 10;
export const GRAVITY = 420;
export const LAUNCH_Y = BOARD_HEIGHT - 50;
export const LAUNCH_POWER_MAX = 380;
export const INITIAL_BALLS = 10;
export const SLOT_HEIGHT = 48;

export type GamePhase = 'menu' | 'aiming' | 'playing' | 'gameOver';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Pin {
  x: number;
  y: number;
}

export interface Slot {
  x: number;
  width: number;
  score: number;
}

export interface PachinkoState {
  phase: GamePhase;
  score: number;
  ballsLeft: number;
  ball: Ball | null;
  launchPower: number;
  pins: Pin[];
  slots: Slot[];
  lastScore: number | null;
  centerStreak: number;
  jackpotJustTriggered: boolean;
}

function buildPins(): Pin[] {
  const pins: Pin[] = [];
  const rows = 12;
  const startY = 80;
  const rowDy = 38;
  for (let row = 0; row < rows; row++) {
    const y = startY + row * rowDy;
    const count = row % 2 === 0 ? 8 : 7;
    const offset = row % 2 === 0 ? 0 : (BOARD_WIDTH / (count + 1)) / 2;
    for (let i = 0; i < count; i++) {
      const x = offset + (BOARD_WIDTH / (count + 1)) * (i + 1);
      pins.push({ x, y });
    }
  }
  return pins;
}

function buildSlots(): Slot[] {
  const w = BOARD_WIDTH / 5;
  return [
    { x: 0, width: w, score: 10 },
    { x: w, width: w, score: 25 },
    { x: w * 2, width: w, score: 100 },
    { x: w * 3, width: w, score: 25 },
    { x: w * 4, width: w, score: 10 },
  ];
}

export function createInitialState(): PachinkoState {
  return {
    phase: 'menu',
    score: 0,
    ballsLeft: INITIAL_BALLS,
    ball: null,
    launchPower: 0.5,
    pins: buildPins(),
    slots: buildSlots(),
    lastScore: null,
    centerStreak: 0,
    jackpotJustTriggered: false,
  };
}

export function startGame(state: PachinkoState): PachinkoState {
  return {
    ...createInitialState(),
    phase: 'aiming',
    score: 0,
    ballsLeft: INITIAL_BALLS,
    pins: buildPins(),
    slots: buildSlots(),
    centerStreak: 0,
    jackpotJustTriggered: false,
  };
}

export function setLaunchPower(state: PachinkoState, power: number): PachinkoState {
  if (state.phase !== 'aiming') return state;
  return { ...state, launchPower: Math.max(0.1, Math.min(1, power)) };
}

export function launch(state: PachinkoState): PachinkoState {
  if (state.phase !== 'aiming' || state.ballsLeft <= 0) return state;
  const power = state.launchPower * LAUNCH_POWER_MAX;
  return {
    ...state,
    phase: 'playing',
    ballsLeft: state.ballsLeft - 1,
    launchPower: 0.5,
    ball: {
      x: BOARD_WIDTH / 2,
      y: LAUNCH_Y,
      vx: (Math.random() - 0.5) * 40,
      vy: -power,
    },
    lastScore: null,
  };
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function applySlotHit(state: PachinkoState, slotIndex: number): PachinkoState {
  const slot = state.slots[slotIndex];
  const isCenter = slotIndex === 2;
  const nextCenterStreak = isCenter ? state.centerStreak + 1 : 0;
  const jackpotNow = isCenter && state.centerStreak >= 1;
  const bonusBalls = jackpotNow ? 1 : 0;
  const gained = jackpotNow ? slot.score * 2 : slot.score;
  const nextBallsLeft = state.ballsLeft + bonusBalls;

  return {
    ...state,
    score: state.score + gained,
    ballsLeft: nextBallsLeft,
    ball: null,
    lastScore: gained,
    centerStreak: nextCenterStreak,
    jackpotJustTriggered: jackpotNow,
    phase: nextBallsLeft > 0 ? 'aiming' : 'gameOver',
  };
}

export function update(state: PachinkoState, dt: number): PachinkoState {
  if (state.phase !== 'playing' || !state.ball) return state;

  const slotTop = BOARD_HEIGHT - SLOT_HEIGHT;
  let ball = { ...state.ball };

  ball.vy += GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  const br = BALL_RADIUS;
  const pr = PIN_RADIUS;

  for (const pin of state.pins) {
    const d = dist(ball.x, ball.y, pin.x, pin.y);
    const overlap = br + pr - d;
    if (overlap > 0) {
      const nx = (ball.x - pin.x) / d || 1;
      const ny = (ball.y - pin.y) / d || 0;
      ball.x += nx * overlap;
      ball.y += ny * overlap;
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
      const damp = 0.92;
      ball.vx *= damp;
      ball.vy *= damp;
    }
  }

  if (ball.x - br < 0) {
    ball.x = br;
    ball.vx = Math.abs(ball.vx) * 0.9;
  }
  if (ball.x + br > BOARD_WIDTH) {
    ball.x = BOARD_WIDTH - br;
    ball.vx = -Math.abs(ball.vx) * 0.9;
  }
  if (ball.y - br < 0) {
    ball.y = br;
    ball.vy = Math.abs(ball.vy) * 0.9;
  }

  if (ball.y > slotTop) {
    for (let i = 0; i < state.slots.length; i++) {
      const slot = state.slots[i];
      if (ball.x >= slot.x && ball.x < slot.x + slot.width) {
        return applySlotHit(state, i);
      }
    }
    ball.vy *= 0.5;
    if (ball.y > BOARD_HEIGHT + br * 2) {
      return {
        ...state,
        ball: null,
        lastScore: 0,
        centerStreak: 0,
        jackpotJustTriggered: false,
        phase: state.ballsLeft > 0 ? 'aiming' : 'gameOver',
      };
    }
  }

  const speed = Math.hypot(ball.vx, ball.vy);
  if (ball.y > slotTop && speed < 5) {
    const index = state.slots.findIndex(
      (s) => ball.x >= s.x && ball.x < s.x + s.width
    );
    if (index !== -1) {
      return applySlotHit(state, index);
    }
  }

  return { ...state, ball };
}
