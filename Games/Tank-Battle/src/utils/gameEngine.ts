export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;
const TANK_RADIUS = 18;
const BULLET_RADIUS = 4;
const PLAYER_SPEED = 200;
const BULLET_SPEED = 420;
const TURN_SPEED = Math.PI * 1.8;
const ROUND_KILLS = 3;
const ARENA_MARGIN = 40;
const RESPAWN_DELAY = 1.5;

export type GameMode = 'menu' | 'playing' | 'gameOver';

export interface Tank {
  x: number;
  y: number;
  angle: number;
  kills: number;
  isAlive: boolean;
  respawnTimer: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 'player' | 'cpu';
}

export interface GameState {
  mode: GameMode;
  timeElapsed: number;
  player: Tank;
  cpu: Tank;
  bullets: Bullet[];
  winner: 'player' | 'cpu' | null;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  kick: boolean;
  kickDirX: number;
  kickDirY: number;
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
      timeElapsed: 0,
      player: {
        x: ARENA_MARGIN + 80,
        y: CANVAS_HEIGHT / 2,
        angle: 0,
        kills: 0,
        isAlive: true,
        respawnTimer: 0,
      },
      cpu: {
        x: CANVAS_WIDTH - ARENA_MARGIN - 80,
        y: CANVAS_HEIGHT / 2,
        angle: Math.PI,
        kills: 0,
        isAlive: true,
        respawnTimer: 0,
      },
      bullets: [],
      winner: null,
    };
  }

  reset(): void {
    this.state = this.getInitialState();
    this.onStateChange(this.state);
  }

  start(): void {
    this.state = this.getInitialState();
    this.state.mode = 'playing';
    this.onStateChange(this.state);
  }

  private clampToArena(x: number, y: number): { x: number; y: number } {
    const minX = ARENA_MARGIN + TANK_RADIUS;
    const maxX = CANVAS_WIDTH - ARENA_MARGIN - TANK_RADIUS;
    const minY = ARENA_MARGIN + TANK_RADIUS;
    const maxY = CANVAS_HEIGHT - ARENA_MARGIN - TANK_RADIUS;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  }

  private moveTank(tank: Tank, forward: number, turn: number, dt: number): Tank {
    let angle = tank.angle + turn * TURN_SPEED * dt;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    let x = tank.x + dirX * forward * PLAYER_SPEED * dt;
    let y = tank.y + dirY * forward * PLAYER_SPEED * dt;
    const clamped = this.clampToArena(x, y);
    x = clamped.x;
    y = clamped.y;
    return { ...tank, x, y, angle };
  }

  private spawnBullet(owner: 'player' | 'cpu', x: number, y: number, angle: number): void {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const bx = x + dirX * (TANK_RADIUS + BULLET_RADIUS + 4);
    const by = y + dirY * (TANK_RADIUS + BULLET_RADIUS + 4);
    this.state.bullets.push({
      x: bx,
      y: by,
      vx: dirX * BULLET_SPEED,
      vy: dirY * BULLET_SPEED,
      owner,
    });
  }

  private updateBullets(dt: number): void {
    const bullets: Bullet[] = [];
    for (const b of this.state.bullets) {
      const x = b.x + b.vx * dt;
      const y = b.y + b.vy * dt;
      if (
        x < ARENA_MARGIN ||
        x > CANVAS_WIDTH - ARENA_MARGIN ||
        y < ARENA_MARGIN ||
        y > CANVAS_HEIGHT - ARENA_MARGIN
      ) {
        continue;
      }
      bullets.push({ ...b, x, y });
    }
    this.state.bullets = bullets;
  }

  private handleHits(): void {
    for (const b of this.state.bullets) {
      if (b.owner === 'player' && this.state.cpu.isAlive) {
        const d = dist(b.x, b.y, this.state.cpu.x, this.state.cpu.y);
        if (d <= TANK_RADIUS + BULLET_RADIUS) {
          this.state.player.kills += 1;
          this.state.cpu.isAlive = false;
          this.state.cpu.respawnTimer = RESPAWN_DELAY;
        }
      } else if (b.owner === 'cpu' && this.state.player.isAlive) {
        const d = dist(b.x, b.y, this.state.player.x, this.state.player.y);
        if (d <= TANK_RADIUS + BULLET_RADIUS) {
          this.state.cpu.kills += 1;
          this.state.player.isAlive = false;
          this.state.player.respawnTimer = RESPAWN_DELAY;
        }
      }
    }
    this.state.bullets = this.state.bullets.filter(() => true);
  }

  private updateRespawn(dt: number): void {
    const p = this.state.player;
    const c = this.state.cpu;
    if (!p.isAlive) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        p.isAlive = true;
        p.respawnTimer = 0;
        p.x = ARENA_MARGIN + 80;
        p.y = CANVAS_HEIGHT / 2;
        p.angle = 0;
      }
    }
    if (!c.isAlive) {
      c.respawnTimer -= dt;
      if (c.respawnTimer <= 0) {
        c.isAlive = true;
        c.respawnTimer = 0;
        c.x = CANVAS_WIDTH - ARENA_MARGIN - 80;
        c.y = CANVAS_HEIGHT / 2;
        c.angle = Math.PI;
      }
    }
  }

  private updateCpu(dt: number): void {
    const cpu = this.state.cpu;
    const player = this.state.player;
    if (!cpu.isAlive || !player.isAlive) return;

    const dx = player.x - cpu.x;
    const dy = player.y - cpu.y;
    const angleToPlayer = Math.atan2(dy, dx);
    let turnDir = 0;
    const diff = ((angleToPlayer - cpu.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (diff > 0.1) turnDir = 1;
    else if (diff < -0.1) turnDir = -1;

    const distance = Math.hypot(dx, dy);
    const forward = distance > 140 ? 1 : distance < 90 ? -0.4 : 0;

    this.state.cpu = this.moveTank(cpu, forward, turnDir, dt);

    if (Math.abs(diff) < 0.18 && distance < 360) {
      if (Math.random() < dt * 1.4) {
        this.spawnBullet('cpu', this.state.cpu.x, this.state.cpu.y, this.state.cpu.angle);
      }
    }
  }

  update(dt: number, input: InputState): void {
    if (this.state.mode !== 'playing') return;

    this.state.timeElapsed += dt;

    if (this.state.player.isAlive) {
      let forward = 0;
      if (input.up) forward += 1;
      if (input.down) forward -= 1;
      let turn = 0;
      if (input.left) turn -= 1;
      if (input.right) turn += 1;
      this.state.player = this.moveTank(this.state.player, forward, turn, dt);

      if (input.kick) {
        this.spawnBullet('player', this.state.player.x, this.state.player.y, this.state.player.angle);
        input.kick = false;
      }
    }

    this.updateCpu(dt);
    this.updateBullets(dt);
    this.handleHits();
    this.updateRespawn(dt);

    if (this.state.player.kills >= ROUND_KILLS || this.state.cpu.kills >= ROUND_KILLS) {
      this.state.mode = 'gameOver';
      this.state.winner = this.state.player.kills > this.state.cpu.kills ? 'player' : 'cpu';
    }

    this.onStateChange(this.state);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const g = this.state;

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#111827';
    ctx.fillRect(ARENA_MARGIN, ARENA_MARGIN, CANVAS_WIDTH - ARENA_MARGIN * 2, CANVAS_HEIGHT - ARENA_MARGIN * 2);

    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 3;
    ctx.strokeRect(ARENA_MARGIN, ARENA_MARGIN, CANVAS_WIDTH - ARENA_MARGIN * 2, CANVAS_HEIGHT - ARENA_MARGIN * 2);

    ctx.setLineDash([6, 10]);
    ctx.strokeStyle = 'rgba(148,163,184,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, ARENA_MARGIN);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - ARENA_MARGIN);
    ctx.stroke();
    ctx.setLineDash([]);

    this.drawTank(ctx, g.cpu, '#f97316', '#9a3412');
    this.drawTank(ctx, g.player, '#3b82f6', '#1d4ed8');

    ctx.fillStyle = '#e5e7eb';
    for (const b of g.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawTank(
    ctx: CanvasRenderingContext2D,
    tank: Tank,
    bodyColor: string,
    borderColor: string
  ): void {
    if (!tank.isAlive) return;
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.angle);

    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-TANK_RADIUS, -TANK_RADIUS, TANK_RADIUS * 2, TANK_RADIUS * 2, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(TANK_RADIUS + 10, 0);
    ctx.stroke();

    ctx.restore();
  }
}
