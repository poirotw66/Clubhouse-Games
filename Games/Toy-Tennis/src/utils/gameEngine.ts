/**
 * Toy Tennis: 2D side-view Pong-style. Player (left paddle) vs CPU (right).
 * First to 7 points (or win by 2 if 6-6). Ball bounces off paddles and top/bottom.
 */

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;
export const WINNING_POINTS = 7;

const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const PADDLE_MARGIN = 40;
const BALL_RADIUS = 8;
const BASE_BALL_SPEED = 380;
const MAX_BALL_SPEED = 620;
const PADDLE_SPEED = 320;
const RALLY_SPEED_BOOST = 0.035;
const MAX_RALLY_BOOST = 0.45;
const TRAIL_LENGTH = 8;
const POINT_PAUSE = 1.1;

export type CpuDifficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'menu' | 'playing' | 'gameOver';
export type HitSide = 'player' | 'cpu';
export type MatchStatus = 'normal' | 'deuce' | 'playerMatchPoint' | 'cpuMatchPoint';

const CPU_PARAMS: Record<CpuDifficulty, { reaction: number; error: number }> = {
  easy: { reaction: 0.28, error: 42 },
  normal: { reaction: 0.4, error: 25 },
  hard: { reaction: 0.62, error: 12 },
};

export interface GameState {
  mode: GameMode;
  scorePlayer: number;
  scoreCpu: number;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  paddlePlayerY: number;
  paddleCpuY: number;
  pointEndTimer: number;
  serveDirection: number;
  rallyHits: number;
  lastHitBy: HitSide | null;
  matchStatus: MatchStatus;
  /** Rally length of the point that just ended (for UI feedback). */
  lastPointRally: number;
}

function canWinOnNextPoint(leader: number, trailer: number): boolean {
  const next = leader + 1;
  return next >= WINNING_POINTS && next - trailer >= 2;
}

export function getMatchStatus(scorePlayer: number, scoreCpu: number): MatchStatus {
  if (scorePlayer >= 6 && scoreCpu >= 6 && scorePlayer === scoreCpu) {
    return 'deuce';
  }
  if (canWinOnNextPoint(scorePlayer, scoreCpu)) {
    return 'playerMatchPoint';
  }
  if (canWinOnNextPoint(scoreCpu, scorePlayer)) {
    return 'cpuMatchPoint';
  }
  return 'normal';
}

function clampSpeed(vx: number, vy: number): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy);
  if (speed <= MAX_BALL_SPEED) {
    return { vx, vy };
  }
  const scale = MAX_BALL_SPEED / speed;
  return { vx: vx * scale, vy: vy * scale };
}

function reflectOffPaddle(
  hitNorm: number,
  towardRight: boolean,
  rallyHits: number
): { vx: number; vy: number } {
  const edgeBoost = Math.abs(hitNorm) * 0.15;
  const angle = hitNorm * (0.55 + edgeBoost) * Math.PI;
  const rallyMult = 1 + Math.min(rallyHits * RALLY_SPEED_BOOST, MAX_RALLY_BOOST);
  const speed = Math.min(BASE_BALL_SPEED * rallyMult * 1.02, MAX_BALL_SPEED);
  const baseAngle = towardRight ? angle : Math.PI - angle;
  return clampSpeed(speed * Math.cos(baseAngle), speed * Math.sin(baseAngle));
}

export class GameEngine {
  state: GameState;
  onStateChange: (s: GameState) => void;
  difficulty: CpuDifficulty;
  private trail: { x: number; y: number }[] = [];

  constructor(
    onStateChange: (s: GameState) => void,
    difficulty: CpuDifficulty = 'normal'
  ) {
    this.onStateChange = onStateChange;
    this.difficulty = difficulty;
    this.state = this.getInitialState();
  }

  setDifficulty(difficulty: CpuDifficulty): void {
    this.difficulty = difficulty;
  }

  getInitialState(): GameState {
    return {
      mode: 'menu',
      scorePlayer: 0,
      scoreCpu: 0,
      ballX: CANVAS_WIDTH / 2,
      ballY: CANVAS_HEIGHT / 2,
      ballVx: 0,
      ballVy: 0,
      paddlePlayerY: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      paddleCpuY: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      pointEndTimer: 0,
      serveDirection: 1,
      rallyHits: 0,
      lastHitBy: null,
      matchStatus: 'normal',
      lastPointRally: 0,
    };
  }

  reset(): void {
    this.trail = [];
    this.state = this.getInitialState();
    this.onStateChange(this.state);
  }

  start(): void {
    this.trail = [];
    this.state = {
      ...this.getInitialState(),
      mode: 'playing',
      serveDirection: 1,
      matchStatus: 'normal',
    };
    this.serve();
    this.onStateChange(this.state);
  }

  serve(): void {
    this.state.ballX = CANVAS_WIDTH / 2;
    this.state.ballY = CANVAS_HEIGHT / 2;
    const angle = (Math.random() * 0.5 - 0.25) * Math.PI;
    const speed = BASE_BALL_SPEED * 0.92;
    this.state.ballVx = this.state.serveDirection * speed * Math.cos(angle);
    this.state.ballVy = speed * Math.sin(angle);
    this.state.pointEndTimer = 0;
    this.state.rallyHits = 0;
    this.state.lastHitBy = null;
    this.trail = [{ x: this.state.ballX, y: this.state.ballY }];
    this.syncMatchStatus();
    this.onStateChange(this.state);
  }

  movePlayer(direction: number, dt: number): void {
    if (this.state.mode !== 'playing' || direction === 0) return;
    this.state.paddlePlayerY += direction * PADDLE_SPEED * dt;
    this.state.paddlePlayerY = Math.max(
      0,
      Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, this.state.paddlePlayerY)
    );
  }

  private syncMatchStatus(): void {
    this.state.matchStatus = getMatchStatus(
      this.state.scorePlayer,
      this.state.scoreCpu
    );
  }

  private awardPoint(toCpu: boolean): void {
    this.state.lastPointRally = this.state.rallyHits;
    if (toCpu) {
      this.state.scoreCpu += 1;
      this.state.serveDirection = -1;
    } else {
      this.state.scorePlayer += 1;
      this.state.serveDirection = 1;
    }
    this.state.pointEndTimer = POINT_PAUSE;
    this.state.ballX = CANVAS_WIDTH / 2;
    this.state.ballY = CANVAS_HEIGHT / 2;
    this.state.ballVx = 0;
    this.state.ballVy = 0;
    this.state.rallyHits = 0;
    this.state.lastHitBy = null;
    this.trail = [];
    this.syncMatchStatus();
    this.checkGameOver();
  }

  update(dt: number, keys: { up: boolean; down: boolean }): void {
    if (this.state.mode !== 'playing') return;

    this.state.lastHitBy = null;
    if (this.state.pointEndTimer <= 0) {
      this.state.lastPointRally = 0;
    }

    if (keys.up) this.movePlayer(-1, dt);
    if (keys.down) this.movePlayer(1, dt);

    if (this.state.pointEndTimer > 0) {
      this.state.pointEndTimer -= dt;
      if (this.state.pointEndTimer <= 0 && this.state.mode === 'playing') {
        this.serve();
      }
      this.onStateChange(this.state);
      return;
    }

    const leftPaddleX = PADDLE_MARGIN;
    const rightPaddleX = CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH;
    const cpu = CPU_PARAMS[this.difficulty];
    const cpuCenter = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;

    if (this.state.ballVx > 0 || this.state.ballX > CANVAS_WIDTH * 0.52) {
      const cpuTarget = this.state.ballY - PADDLE_HEIGHT / 2;
      const diff = cpuTarget - this.state.paddleCpuY;
      const error = (Math.random() - 0.5) * 2 * cpu.error;
      this.state.paddleCpuY += (diff * cpu.reaction + error) * dt * PADDLE_SPEED;
    } else {
      this.state.paddleCpuY += (cpuCenter - this.state.paddleCpuY) * 2.5 * dt;
    }
    this.state.paddleCpuY = Math.max(
      0,
      Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, this.state.paddleCpuY)
    );

    this.state.ballX += this.state.ballVx * dt;
    this.state.ballY += this.state.ballVy * dt;

    this.trail.unshift({ x: this.state.ballX, y: this.state.ballY });
    if (this.trail.length > TRAIL_LENGTH) {
      this.trail.pop();
    }

    if (this.state.ballY <= BALL_RADIUS) {
      this.state.ballY = BALL_RADIUS;
      this.state.ballVy = Math.abs(this.state.ballVy);
    }
    if (this.state.ballY >= CANVAS_HEIGHT - BALL_RADIUS) {
      this.state.ballY = CANVAS_HEIGHT - BALL_RADIUS;
      this.state.ballVy = -Math.abs(this.state.ballVy);
    }

    if (
      this.state.ballVx < 0 &&
      this.state.ballX - BALL_RADIUS <= leftPaddleX + PADDLE_WIDTH &&
      this.state.ballX + BALL_RADIUS >= leftPaddleX &&
      this.state.ballY >= this.state.paddlePlayerY &&
      this.state.ballY <= this.state.paddlePlayerY + PADDLE_HEIGHT
    ) {
      this.state.ballX = leftPaddleX + PADDLE_WIDTH + BALL_RADIUS;
      const hitNorm =
        (this.state.ballY - (this.state.paddlePlayerY + PADDLE_HEIGHT / 2)) /
        (PADDLE_HEIGHT / 2);
      const reflected = reflectOffPaddle(hitNorm, true, this.state.rallyHits);
      this.state.ballVx = reflected.vx;
      this.state.ballVy = reflected.vy;
      this.state.rallyHits += 1;
      this.state.lastHitBy = 'player';
    }

    if (
      this.state.ballVx > 0 &&
      this.state.ballX + BALL_RADIUS >= rightPaddleX &&
      this.state.ballX - BALL_RADIUS <= rightPaddleX + PADDLE_WIDTH &&
      this.state.ballY >= this.state.paddleCpuY &&
      this.state.ballY <= this.state.paddleCpuY + PADDLE_HEIGHT
    ) {
      this.state.ballX = rightPaddleX - BALL_RADIUS;
      const hitNorm =
        (this.state.ballY - (this.state.paddleCpuY + PADDLE_HEIGHT / 2)) /
        (PADDLE_HEIGHT / 2);
      const reflected = reflectOffPaddle(hitNorm, false, this.state.rallyHits);
      this.state.ballVx = reflected.vx;
      this.state.ballVy = reflected.vy;
      this.state.rallyHits += 1;
      this.state.lastHitBy = 'cpu';
    }

    if (this.state.ballX < -BALL_RADIUS * 2) {
      this.awardPoint(true);
    } else if (this.state.ballX > CANVAS_WIDTH + BALL_RADIUS * 2) {
      this.awardPoint(false);
    }

    this.onStateChange(this.state);
  }

  private checkGameOver(): void {
    const { scorePlayer, scoreCpu } = this.state;
    const playerWins =
      scorePlayer >= WINNING_POINTS && scorePlayer - scoreCpu >= 2;
    const cpuWins = scoreCpu >= WINNING_POINTS && scoreCpu - scorePlayer >= 2;
    if (playerWins || cpuWins) {
      this.state.mode = 'gameOver';
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, CANVAS_WIDTH - 40, CANVAS_HEIGHT - 40);
    ctx.setLineDash([15, 15]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 20);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(CANVAS_WIDTH / 2 - 3, 0, 6, CANVAS_HEIGHT);

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(
      PADDLE_MARGIN,
      this.state.paddlePlayerY,
      PADDLE_WIDTH,
      PADDLE_HEIGHT
    );
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(
      CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH,
      this.state.paddleCpuY,
      PADDLE_WIDTH,
      PADDLE_HEIGHT
    );

    if (this.state.pointEndTimer <= 0 || Math.abs(this.state.ballVx) > 1) {
      for (let i = this.trail.length - 1; i >= 0; i -= 1) {
        const point = this.trail[i];
        const alpha = 0.15 + (1 - i / TRAIL_LENGTH) * 0.35;
        ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, BALL_RADIUS * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(this.state.ballX, this.state.ballY, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
