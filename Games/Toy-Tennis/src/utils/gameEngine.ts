/**
 * Toy Tennis: 2D side-view Pong-style. Player (left paddle) vs CPU (right).
 * First to 7 points (or win by 2 if 6-6). Ball bounces off paddles and top/bottom.
 */

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const PADDLE_MARGIN = 40;
const BALL_RADIUS = 8;
const BALL_SPEED = 380;
const PADDLE_SPEED = 320;
const WINNING_POINTS = 7;
const CPU_REACTION = 0.4;
const CPU_ERROR = 25;

export type GameMode = 'menu' | 'playing' | 'gameOver';

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
  /** Brief pause after point before next serve. */
  pointEndTimer: number;
  /** Winner of last point serves next; 1 = toward CPU, -1 = toward player. */
  serveDirection: number;
}

export class GameEngine {
  state: GameState;
  onStateChange: (s: GameState) => void;

  constructor(onStateChange: (s: GameState) => void) {
    this.onStateChange = onStateChange;
    this.state = this.getInitialState();
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
    };
  }

  reset(): void {
    this.state = this.getInitialState();
    this.onStateChange(this.state);
  }

  start(): void {
    this.state.mode = 'playing';
    this.state.serveDirection = 1;
    this.serve();
    this.onStateChange(this.state);
  }

  /** Launch ball from center toward serve direction. */
  serve(): void {
    this.state.ballX = CANVAS_WIDTH / 2;
    this.state.ballY = CANVAS_HEIGHT / 2;
    const angle = (Math.random() * 0.4 - 0.2) * Math.PI;
    const speed = BALL_SPEED;
    this.state.ballVx = this.state.serveDirection * speed * Math.cos(angle);
    this.state.ballVy = speed * Math.sin(angle);
    this.state.pointEndTimer = 0;
    this.onStateChange(this.state);
  }

  /** direction: -1 up, 1 down, 0 none. Called from update with key state. */
  movePlayer(direction: number, dt: number): void {
    if (this.state.mode !== 'playing' || direction === 0) return;
    this.state.paddlePlayerY += direction * PADDLE_SPEED * dt;
    this.state.paddlePlayerY = Math.max(
      0,
      Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, this.state.paddlePlayerY)
    );
  }

  update(dt: number, keys: { up: boolean; down: boolean }): void {
    if (this.state.mode !== 'playing') return;

    if (keys.up) this.movePlayer(-1, dt);
    if (keys.down) this.movePlayer(1, dt);

    if (this.state.pointEndTimer > 0) {
      this.state.pointEndTimer -= dt;
      if (this.state.pointEndTimer <= 0 && this.state.mode === 'playing') this.serve();
      this.onStateChange(this.state);
      return;
    }

    const leftPaddleX = PADDLE_MARGIN;
    const rightPaddleX = CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH;

    // CPU paddle: move toward ball with delay and error
    const cpuTarget = this.state.ballY - PADDLE_HEIGHT / 2;
    const diff = cpuTarget - this.state.paddleCpuY;
    const error = (Math.random() - 0.5) * 2 * CPU_ERROR;
    this.state.paddleCpuY += (diff * CPU_REACTION + error) * dt * PADDLE_SPEED;
    this.state.paddleCpuY = Math.max(
      0,
      Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, this.state.paddleCpuY)
    );

    this.state.ballX += this.state.ballVx * dt;
    this.state.ballY += this.state.ballVy * dt;

    // Top/bottom walls
    if (this.state.ballY <= BALL_RADIUS) {
      this.state.ballY = BALL_RADIUS;
      this.state.ballVy = Math.abs(this.state.ballVy);
    }
    if (this.state.ballY >= CANVAS_HEIGHT - BALL_RADIUS) {
      this.state.ballY = CANVAS_HEIGHT - BALL_RADIUS;
      this.state.ballVy = -Math.abs(this.state.ballVy);
    }

    // Left paddle (player)
    if (
      this.state.ballVx < 0 &&
      this.state.ballX - BALL_RADIUS <= leftPaddleX + PADDLE_WIDTH &&
      this.state.ballX + BALL_RADIUS >= leftPaddleX &&
      this.state.ballY >= this.state.paddlePlayerY &&
      this.state.ballY <= this.state.paddlePlayerY + PADDLE_HEIGHT
    ) {
      this.state.ballX = leftPaddleX + PADDLE_WIDTH + BALL_RADIUS;
      const hitNorm = (this.state.ballY - (this.state.paddlePlayerY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
      const angle = hitNorm * 0.6 * Math.PI;
      const speed = Math.sqrt(this.state.ballVx ** 2 + this.state.ballVy ** 2) * 1.02;
      this.state.ballVx = speed * Math.cos(angle);
      this.state.ballVy = speed * Math.sin(angle);
    }

    // Right paddle (CPU)
    if (
      this.state.ballVx > 0 &&
      this.state.ballX + BALL_RADIUS >= rightPaddleX &&
      this.state.ballX - BALL_RADIUS <= rightPaddleX + PADDLE_WIDTH &&
      this.state.ballY >= this.state.paddleCpuY &&
      this.state.ballY <= this.state.paddleCpuY + PADDLE_HEIGHT
    ) {
      this.state.ballX = rightPaddleX - BALL_RADIUS;
      const hitNorm = (this.state.ballY - (this.state.paddleCpuY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
      const angle = Math.PI - hitNorm * 0.6 * Math.PI;
      const speed = Math.sqrt(this.state.ballVx ** 2 + this.state.ballVy ** 2) * 1.02;
      this.state.ballVx = speed * Math.cos(angle);
      this.state.ballVy = speed * Math.sin(angle);
    }

    // Point: ball out left (CPU scores) or right (player scores)
    if (this.state.ballX < -BALL_RADIUS * 2) {
      this.state.scoreCpu += 1;
      this.state.serveDirection = -1;
      this.state.pointEndTimer = 0.8;
      this.state.ballX = CANVAS_WIDTH / 2;
      this.state.ballY = CANVAS_HEIGHT / 2;
      this.state.ballVx = 0;
      this.state.ballVy = 0;
      this.checkGameOver();
    }
    if (this.state.ballX > CANVAS_WIDTH + BALL_RADIUS * 2) {
      this.state.scorePlayer += 1;
      this.state.serveDirection = 1;
      this.state.pointEndTimer = 0.8;
      this.state.ballX = CANVAS_WIDTH / 2;
      this.state.ballY = CANVAS_HEIGHT / 2;
      this.state.ballVx = 0;
      this.state.ballVy = 0;
      this.checkGameOver();
    }

    this.onStateChange(this.state);
  }

  private checkGameOver(): void {
    const { scorePlayer, scoreCpu } = this.state;
    const playerWins = scorePlayer >= WINNING_POINTS && scorePlayer - scoreCpu >= 2;
    const cpuWins = scoreCpu >= WINNING_POINTS && scoreCpu - scorePlayer >= 2;
    if (playerWins || cpuWins) {
      this.state.mode = 'gameOver';
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Court lines
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, CANVAS_WIDTH - 40, CANVAS_HEIGHT - 40);
    ctx.setLineDash([15, 15]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 20);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Net
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(CANVAS_WIDTH / 2 - 3, 0, 6, CANVAS_HEIGHT);

    // Paddles
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

    // Ball
    if (this.state.pointEndTimer <= 0 || Math.abs(this.state.ballVx) > 1) {
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
