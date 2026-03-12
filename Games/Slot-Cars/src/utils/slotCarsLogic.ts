export const TRACK_WIDTH = 640;
export const TRACK_HEIGHT = 420;

export type GamePhase = 'menu' | 'running' | 'results';

export interface Vec2 {
  x: number;
  y: number;
}

export interface SlotCarsInput {
  throttle: number;
}

export interface CarState {
  progress: number;
  speed: number;
  lap: number;
  currentLapTime: number;
  bestLapTime: number | null;
  crashed: boolean;
  crashTimer: number;
}

export interface SlotCarsState {
  phase: GamePhase;
  timeElapsed: number;
  lapTarget: number;
  player: CarState;
  cpu: CarState;
  winner: 'player' | 'cpu' | 'tie' | null;
}

const TRACK_LENGTH = 1000;
const PLAYER_LANE_OFFSET = 22;
const CPU_LANE_OFFSET = -8;
const BASE_RADIUS_X = 220;
const BASE_RADIUS_Y = 130;
const CENTER_X = TRACK_WIDTH / 2;
const CENTER_Y = TRACK_HEIGHT / 2;

const MAX_SPEED_STRAIGHT = 230;
const MAX_SPEED_CURVE = 150;
const GLOBAL_MAX_SPEED = 260;
const ACCELERATION = 260;
const FRICTION = 0.8;
const CRASH_DURATION = 1.2;

function createCar(initialOffset: number): CarState {
  return {
    progress: initialOffset,
    speed: 0,
    lap: 0,
    currentLapTime: 0,
    bestLapTime: null,
    crashed: false,
    crashTimer: 0,
  };
}

export function createInitialState(): SlotCarsState {
  return {
    phase: 'menu',
    timeElapsed: 0,
    lapTarget: 3,
    player: createCar(0),
    cpu: createCar(TRACK_LENGTH * 0.25),
    winner: null,
  };
}

export function startRace(prev: SlotCarsState): SlotCarsState {
  const base = createInitialState();
  return {
    ...base,
    phase: 'running',
  };
}

function getTrackAngle(progress: number): number {
  const t = (progress % TRACK_LENGTH) / TRACK_LENGTH;
  return t * Math.PI * 2;
}

export function sampleCarPosition(progress: number, laneOffset: number): Vec2 {
  const angle = getTrackAngle(progress);
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  const baseX = CENTER_X + nx * BASE_RADIUS_X;
  const baseY = CENTER_Y + ny * BASE_RADIUS_Y;
  const tx = -ny;
  const ty = nx;
  return {
    x: baseX + tx * laneOffset,
    y: baseY + ty * laneOffset,
  };
}

function isCurveSection(progress: number): boolean {
  const p = (progress % TRACK_LENGTH + TRACK_LENGTH) % TRACK_LENGTH;
  return p < 120 || p > 380;
}

function getSafeSpeed(progress: number): number {
  return isCurveSection(progress) ? MAX_SPEED_CURVE : MAX_SPEED_STRAIGHT;
}

function updateCar(
  car: CarState,
  inputThrottle: number,
  dt: number,
  isCpu: boolean
): CarState {
  let next = { ...car };

  if (next.crashed) {
    next.crashTimer -= dt;
    if (next.crashTimer <= 0) {
      next.crashed = false;
      next.crashTimer = 0;
    }
    next.speed = 0;
    return next;
  }

  const throttle = isCpu ? getCpuThrottle(next) : inputThrottle;
  const accel = throttle * ACCELERATION;
  next.speed += accel * dt;

  const drag = FRICTION * next.speed * dt;
  next.speed = Math.max(0, next.speed - drag);
  next.speed = Math.min(next.speed, GLOBAL_MAX_SPEED);

  const safe = getSafeSpeed(next.progress);
  if (next.speed > safe * 1.15) {
    next.crashed = true;
    next.crashTimer = CRASH_DURATION;
    next.speed = 0;
    return next;
  }

  const oldProgress = next.progress;
  next.progress += next.speed * dt;
  next.currentLapTime += dt;

  if (oldProgress < TRACK_LENGTH && next.progress >= TRACK_LENGTH) {
    next.progress -= TRACK_LENGTH;
    next.lap += 1;
    if (next.bestLapTime === null || next.currentLapTime < next.bestLapTime) {
      next.bestLapTime = next.currentLapTime;
    }
    next.currentLapTime = 0;
  }

  return next;
}

function getCpuThrottle(car: CarState): number {
  const lookAhead = 80;
  const futureProgress = car.progress + Math.max(car.speed * 0.3, lookAhead);
  const approachingCurve = isCurveSection(futureProgress);
  const safeNow = getSafeSpeed(car.progress);

  if (approachingCurve) {
    if (car.speed > safeNow * 0.95) {
      return 0.05;
    }
    if (car.speed > safeNow * 0.8) {
      return 0.25;
    }
    return 0.45;
  }

  if (car.speed < MAX_SPEED_STRAIGHT * 0.7) return 0.9;
  if (car.speed < MAX_SPEED_STRAIGHT * 0.95) return 0.7;
  return 0.4;
}

export function updateState(
  state: SlotCarsState,
  input: SlotCarsInput,
  dt: number
): SlotCarsState {
  if (state.phase !== 'running') {
    return state;
  }

  const nextPlayer = updateCar(state.player, input.throttle, dt, false);
  const nextCpu = updateCar(state.cpu, input.throttle, dt, true);

  let next: SlotCarsState = {
    ...state,
    timeElapsed: state.timeElapsed + dt,
    player: nextPlayer,
    cpu: nextCpu,
  };

  const finishedPlayer = nextPlayer.lap >= next.lapTarget;
  const finishedCpu = nextCpu.lap >= next.lapTarget;

  if (finishedPlayer || finishedCpu) {
    let winner: 'player' | 'cpu' | 'tie';
    if (finishedPlayer && !finishedCpu) winner = 'player';
    else if (!finishedPlayer && finishedCpu) winner = 'cpu';
    else {
      if (nextPlayer.progress > nextCpu.progress) winner = 'player';
      else if (nextPlayer.progress < nextCpu.progress) winner = 'cpu';
      else winner = 'tie';
    }

    next = {
      ...next,
      phase: 'results',
      winner,
    };
  }

  return next;
}
