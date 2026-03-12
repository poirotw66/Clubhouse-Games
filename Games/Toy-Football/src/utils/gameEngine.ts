/**
 * Toy Football: top-down 2D. Player vs CPU, 90 seconds, most goals wins.
 * Ball in center, move with arrows, Space to kick. Goals at left (CPU) and right (player).
 */

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;
const BALL_RADIUS = 10;
const PLAYER_RADIUS = 22;
const KICK_POWER = 520;
const BALL_FRICTION = 0.98;
const PLAYER_SPEED = 260;
const GOAL_WIDTH = 30;
const GOAL_TOP = 150;
const GOAL_BOTTOM = 350;
const GOAL_LEFT = 0;
const GOAL_RIGHT = CANVAS_WIDTH;
const MATCH_DURATION = 90;
const RESTART_AFTER_GOAL = 1.2;

export type GameMode = 'menu' | 'playing' | 'gameOver';

export interface GameState {
  mode: GameMode;
  scorePlayer: number;
  scoreCpu: number;
  timeLeft: number;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  playerX: number;
  playerY: number;
  cpuX: number;
  cpuY: number;
  goalTimer: number;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
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
      timeLeft: MATCH_DURATION,
      ballX: CANVAS_WIDTH / 2,
      ballY: CANVAS_HEIGHT / 2,
      ballVx: 0,
      ballVy: 0,
      playerX: 200,
      playerY: CANVAS_HEIGHT / 2,
      cpuX: 600,
      cpuY: CANVAS_HEIGHT / 2,
      goalTimer: 0,
    };
  }

  reset(): void {
    this.state = this.getInitialState();
    this.onStateChange(this.state);
  }

  start(): void {
    this.state.mode = 'playing';
    this.state.timeLeft = MATCH_DURATION;
    this.state.scorePlayer = 0;
    this.state.scoreCpu = 0;
    this.placeBallAndPlayers();
    this.state.goalTimer = 0;
    this.onStateChange(this.state);
  }

  private placeBallAndPlayers(): void {
    this.state.ballX = CANVAS_WIDTH / 2;
    this.state.ballY = CANVAS_HEIGHT / 2;
    this.state.ballVx = 0;
    this.state.ballVy = 0;
    this.state.playerX = 200;
    this.state.playerY = CANVAS_HEIGHT / 2;
    this.state.cpuX = 600;
    this.state.cpuY = CANVAS_HEIGHT / 2;
  }

  movePlayer(dx: number, dy: number, dt: number): void {
    if (this.state.mode !== 'playing' || this.state.goalTimer > 0) return;
    this.state.playerX += dx * PLAYER_SPEED * dt;
    this.state.playerY += dy * PLAYER_SPEED * dt;
    this.state.playerX = Math.max(PLAYER_RADIUS + 10, Math.min(CANVAS_WIDTH - PLAYER_RADIUS - 10, this.state.playerX));
    this.state.playerY = Math.max(PLAYER_RADIUS + 10, Math.min(CANVAS_HEIGHT - PLAYER_RADIUS - 10, this.state.playerY));
  }

  /** Kick in direction (dx, dy); if both 0, default toward CPU goal (right). */
  kick(directionX: number, directionY: number): void {
    if (this.state.mode !== 'playing' || this.state.goalTimer > 0) return;
    const d = dist(this.state.playerX, this.state.playerY, this.state.ballX, this.state.ballY);
    if (d > PLAYER_RADIUS + BALL_RADIUS + 15) return;
    let dx = directionX;
    let dy = directionY;
    if (dx === 0 && dy === 0) {
      dx = CANVAS_WIDTH - 50 - this.state.ballX;
      dy = CANVAS_HEIGHT / 2 - this.state.ballY;
    }
    const len = Math.hypot(dx, dy) || 1;
    this.state.ballVx = (dx / len) * KICK_POWER + (Math.random() - 0.5) * 60;
    this.state.ballVy = (dy / len) * KICK_POWER + (Math.random() - 0.5) * 60;
    this.onStateChange(this.state);
  }

  update(dt: number, keys: { up: boolean; down: boolean; left: boolean; right: boolean; kick: boolean; kickDirX: number; kickDirY: number }): void {
    if (this.state.mode !== 'playing') return;

    if (this.state.goalTimer > 0) {
      this.state.goalTimer -= dt;
      if (this.state.goalTimer <= 0) this.placeBallAndPlayers();
      this.onStateChange(this.state);
      return;
    }

    this.state.timeLeft -= dt;
    if (this.state.timeLeft <= 0) {
      this.state.timeLeft = 0;
      this.state.mode = 'gameOver';
      this.onStateChange(this.state);
      return;
    }

    let dx = 0, dy = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const norm = Math.hypot(dx, dy) || 1;
      this.movePlayer(dx / norm, dy / norm, dt);
    }
    if (keys.kick) {
      this.kick(keys.kickDirX, keys.kickDirY);
      keys.kick = false;
    }

    // CPU: move toward ball, kick when close
    const cpuToBall = dist(this.state.cpuX, this.state.cpuY, this.state.ballX, this.state.ballY);
    if (cpuToBall < PLAYER_RADIUS + BALL_RADIUS + 20) {
      const towardGoalX = 50 - this.state.ballX;
      const towardGoalY = CANVAS_HEIGHT / 2 - this.state.ballY;
      const len = Math.hypot(towardGoalX, towardGoalY) || 1;
      this.state.ballVx = (towardGoalX / len) * (KICK_POWER * 0.85) + (Math.random() - 0.5) * 60;
      this.state.ballVy = (towardGoalY / len) * (KICK_POWER * 0.85) + (Math.random() - 0.5) * 60;
    } else {
      const moveSpeed = PLAYER_SPEED * 0.75 * dt;
      const dx = this.state.ballX - this.state.cpuX;
      const dy = this.state.ballY - this.state.cpuY;
      const len = Math.hypot(dx, dy) || 1;
      this.state.cpuX += (dx / len) * moveSpeed;
      this.state.cpuY += (dy / len) * moveSpeed;
      this.state.cpuX = Math.max(PLAYER_RADIUS + 10, Math.min(CANVAS_WIDTH - PLAYER_RADIUS - 10, this.state.cpuX));
      this.state.cpuY = Math.max(PLAYER_RADIUS + 10, Math.min(CANVAS_HEIGHT - PLAYER_RADIUS - 10, this.state.cpuY));
    }

    // Ball physics
    this.state.ballX += this.state.ballVx * dt;
    this.state.ballY += this.state.ballVy * dt;
    this.state.ballVx *= BALL_FRICTION;
    this.state.ballVy *= BALL_FRICTION;
    if (Math.abs(this.state.ballVx) < 2) this.state.ballVx = 0;
    if (Math.abs(this.state.ballVy) < 2) this.state.ballVy = 0;

    // Walls
    if (this.state.ballY <= BALL_RADIUS) {
      this.state.ballY = BALL_RADIUS;
      this.state.ballVy = Math.abs(this.state.ballVy) * 0.7;
    }
    if (this.state.ballY >= CANVAS_HEIGHT - BALL_RADIUS) {
      this.state.ballY = CANVAS_HEIGHT - BALL_RADIUS;
      this.state.ballVy = -Math.abs(this.state.ballVy) * 0.7;
    }
    if (this.state.ballX < -BALL_RADIUS * 2 || this.state.ballX > CANVAS_WIDTH + BALL_RADIUS * 2) {
      this.placeBallAndPlayers();
    }

    // Goals: left = player's goal (CPU scores), right = CPU's goal (player scores)
    if (this.state.ballX <= GOAL_WIDTH && this.state.ballY >= GOAL_TOP && this.state.ballY <= GOAL_BOTTOM) {
      this.state.scoreCpu += 1;
      this.state.goalTimer = RESTART_AFTER_GOAL;
      this.placeBallAndPlayers();
    }
    if (this.state.ballX >= CANVAS_WIDTH - GOAL_WIDTH && this.state.ballY >= GOAL_TOP && this.state.ballY <= GOAL_BOTTOM) {
      this.state.scorePlayer += 1;
      this.state.goalTimer = RESTART_AFTER_GOAL;
      this.placeBallAndPlayers();
    }

    this.onStateChange(this.state);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const g = this.state;

    ctx.fillStyle = '#166534';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, CANVAS_WIDTH - 80, CANVAS_HEIGHT - 80);
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 40);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, GOAL_TOP, GOAL_WIDTH + 4, GOAL_BOTTOM - GOAL_TOP);
    ctx.fillRect(CANVAS_WIDTH - GOAL_WIDTH - 4, GOAL_TOP, GOAL_WIDTH + 4, GOAL_BOTTOM - GOAL_TOP);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, GOAL_TOP, GOAL_WIDTH, GOAL_BOTTOM - GOAL_TOP);
    ctx.strokeRect(CANVAS_WIDTH - GOAL_WIDTH, GOAL_TOP, GOAL_WIDTH, GOAL_BOTTOM - GOAL_TOP);

    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(g.playerX, g.playerY, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(g.cpuX, g.cpuY, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b91c1c';
    ctx.stroke();

    if (g.goalTimer <= 0 || Math.abs(g.ballVx) > 1 || Math.abs(g.ballVy) > 1) {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(g.ballX, g.ballY, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
