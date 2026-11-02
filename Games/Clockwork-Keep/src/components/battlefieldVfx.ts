/**
 * Steampunk clockwork combat visual effects:
 * - Animated crossbow bolts, mortar ballistic shells & explosions
 * - Tesla coil lightning chain arcs, frost mist pulses, hammer smash shockwaves
 * - Dynamic hit particles and floating kill reward text (+XX⚙)
 */
import { CHAIN_RADIUS, TOWER_DEFS } from '../game/constants';
import { chainTargets, enemiesInRange, selectPrimaryTarget } from '../game/combat';
import { resolveTowerStats } from '../game/economy';
import type { GameState } from '../game/types';

export const CELL = 64;

export interface Projectile {
  id: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  type: 'crossbow' | 'mortar';
  color: string;
  splashRadius?: number;
}

export interface Beam {
  id: number;
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  life: number;
  maxLife: number;
  type: 'coil' | 'frost' | 'hammer' | 'grinder' | 'mortar';
  radius?: number;
  cx?: number;
  cy?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface VfxManager {
  projectiles: Projectile[];
  beams: Beam[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  nextId: number;
}

export function createVfxManager(): VfxManager {
  return {
    projectiles: [],
    beams: [],
    particles: [],
    floatingTexts: [],
    nextId: 1,
  };
}

export function spawnCombatVfx(
  vfx: VfxManager,
  state: GameState,
  prevTowers: Map<number, number>,
  prevEnemies: Map<number, number>,
): void {
  // 1. Detect newly fired towers
  for (const t of state.towers) {
    const prevCooldown = prevTowers.get(t.id);
    const stats = resolveTowerStats(t);
    const minFireCooldown = (1 / stats.fireRate) * 0.75;
    if (prevCooldown !== undefined && t.cooldown > prevCooldown && t.cooldown >= minFireCooldown) {
      const cx = t.x * CELL + CELL / 2;
      const cy = t.y * CELL + CELL / 2;
      const def = TOWER_DEFS[t.type];
      const targetsAir = stats.targetsAir ?? def.targetsAir;
      const inRange = enemiesInRange(state.enemies, t.x + 0.5, t.y + 0.5, stats.range, targetsAir);
      const primary = selectPrimaryTarget(inRange);

      if (t.type === 'frost') {
        vfx.beams.push({
          id: vfx.nextId++,
          points: [{ x: cx, y: cy }],
          color: '#38bdf8',
          width: 3,
          life: 0.28,
          maxLife: 0.28,
          type: 'frost',
          radius: stats.range * CELL,
          cx,
          cy,
        });
      } else if (t.type === 'grinder') {
        vfx.beams.push({
          id: vfx.nextId++,
          points: [{ x: cx, y: cy }],
          color: '#fb923c',
          width: 2,
          life: 0.22,
          maxLife: 0.22,
          type: 'grinder',
          cx,
          cy,
        });
        for (let k = 0; k < 6; k++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 60 + Math.random() * 80;
          vfx.particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            color: '#f97316',
            size: 2.5,
            life: 0.25,
            maxLife: 0.25,
          });
        }
      } else if (primary) {
        const tx = primary.worldX * CELL;
        const ty = primary.worldY * CELL;

        if (t.type === 'crossbow') {
          vfx.projectiles.push({
            id: vfx.nextId++,
            startX: cx,
            startY: cy,
            currentX: cx,
            currentY: cy,
            targetX: tx,
            targetY: ty,
            progress: 0,
            speed: 5.2,
            type: 'crossbow',
            color: '#fbbf24',
          });
        } else if (t.type === 'mortar') {
          const splashR = (stats.splashRadius ?? def.splashRadius ?? 1.5) * CELL;
          vfx.projectiles.push({
            id: vfx.nextId++,
            startX: cx,
            startY: cy,
            currentX: cx,
            currentY: cy,
            targetX: tx,
            targetY: ty,
            progress: 0,
            speed: 1.9,
            type: 'mortar',
            color: '#ea580c',
            splashRadius: splashR,
          });
        } else if (t.type === 'coil') {
          const chainMax = stats.chainTargets ?? def.chainTargets ?? 3;
          const chained = chainTargets(primary, inRange, chainMax, CHAIN_RADIUS);
          const pts = [{ x: cx, y: cy }];
          for (const c of chained) {
            pts.push({ x: c.worldX * CELL, y: c.worldY * CELL });
          }
          vfx.beams.push({
            id: vfx.nextId++,
            points: pts,
            color: '#a78bfa',
            width: 3,
            life: 0.22,
            maxLife: 0.22,
            type: 'coil',
          });
        } else if (t.type === 'hammer') {
          vfx.beams.push({
            id: vfx.nextId++,
            points: [{ x: tx, y: ty }],
            color: '#c45c26',
            width: 3,
            life: 0.25,
            maxLife: 0.25,
            type: 'hammer',
            cx: tx,
            cy: ty,
          });
        }
      }
    }
  }

  // 2. Detect enemy damage & deaths
  for (const e of state.enemies) {
    const prevHp = prevEnemies.get(e.id);
    const ex = e.worldX * CELL;
    const ey = e.worldY * CELL;
    if (prevHp !== undefined && e.hp < prevHp) {
      for (let k = 0; k < 3; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 30 + Math.random() * 50;
        vfx.particles.push({
          x: ex,
          y: ey,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          color: '#fde047',
          size: 2,
          life: 0.2,
          maxLife: 0.2,
        });
      }
    }
    if (e.dead && (prevHp === undefined || prevHp > 0)) {
      vfx.floatingTexts.push({
        id: vfx.nextId++,
        x: ex,
        y: ey - 12,
        text: `+${e.killReward}⚙`,
        color: '#facc15',
        life: 0.85,
        maxLife: 0.85,
      });
      for (let k = 0; k < 6; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 60;
        vfx.particles.push({
          x: ex,
          y: ey,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          color: '#fbbf24',
          size: 3,
          life: 0.35,
          maxLife: 0.35,
        });
      }
    }
  }
}

export function updateVfx(vfx: VfxManager, dt: number): void {
  // Update projectiles
  for (let i = vfx.projectiles.length - 1; i >= 0; i--) {
    const p = vfx.projectiles[i];
    p.progress += dt * p.speed;
    p.currentX = p.startX + (p.targetX - p.startX) * Math.min(1, p.progress);
    p.currentY = p.startY + (p.targetY - p.startY) * Math.min(1, p.progress);
    if (p.progress >= 1) {
      vfx.projectiles.splice(i, 1);
      if (p.type === 'mortar' && p.splashRadius) {
        vfx.beams.push({
          id: vfx.nextId++,
          points: [{ x: p.targetX, y: p.targetY }],
          color: '#ea580c',
          width: 3,
          life: 0.3,
          maxLife: 0.3,
          type: 'mortar',
          radius: p.splashRadius,
          cx: p.targetX,
          cy: p.targetY,
        });
      }
    }
  }

  // Update beams
  for (let i = vfx.beams.length - 1; i >= 0; i--) {
    vfx.beams[i].life -= dt;
    if (vfx.beams[i].life <= 0) vfx.beams.splice(i, 1);
  }

  // Update particles
  for (let i = vfx.particles.length - 1; i >= 0; i--) {
    const pt = vfx.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.life <= 0) vfx.particles.splice(i, 1);
  }

  // Update floating texts
  for (let i = vfx.floatingTexts.length - 1; i >= 0; i--) {
    const ft = vfx.floatingTexts[i];
    ft.life -= dt;
    ft.y -= 26 * dt;
    if (ft.life <= 0) vfx.floatingTexts.splice(i, 1);
  }
}

export function drawVfx(ctx: CanvasRenderingContext2D, vfx: VfxManager): void {
  // 1. Draw Beams & AoE rings
  for (const b of vfx.beams) {
    const alpha = Math.max(0, b.life / b.maxLife);
    ctx.save();
    if (b.type === 'frost' && b.cx !== undefined && b.cy !== undefined && b.radius) {
      const curR = b.radius * (1 - alpha * 0.4);
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, curR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.22})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.75})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (b.type === 'mortar' && b.cx !== undefined && b.cy !== undefined && b.radius) {
      const curR = b.radius * (1 - alpha * 0.3);
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, curR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(234, 88, 12, ${alpha * 0.35})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(254, 215, 170, ${alpha * 0.85})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (b.type === 'hammer' && b.cx !== undefined && b.cy !== undefined) {
      const curR = 36 * (1 - alpha * 0.7);
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, curR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(196, 92, 38, ${alpha * 0.85})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (b.type === 'grinder' && b.cx !== undefined && b.cy !== undefined) {
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, 26, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(251, 146, 60, ${alpha * 0.85})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (b.type === 'coil' && b.points.length >= 2) {
      ctx.strokeStyle = `rgba(167, 139, 250, ${alpha * 0.9})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 0; k < b.points.length - 1; k++) {
        const p1 = b.points[k];
        const p2 = b.points[k + 1];
        if (k === 0) ctx.moveTo(p1.x, p1.y);
        const segments = 4;
        const dx = (p2.x - p1.x) / segments;
        const dy = (p2.y - p1.y) / segments;
        const nx = -dy;
        const ny = dx;
        const len = Math.hypot(nx, ny);
        const normX = len > 0 ? nx / len : 0;
        const normY = len > 0 ? ny / len : 0;
        for (let s = 1; s < segments; s++) {
          const jitter = (Math.random() - 0.5) * 12;
          ctx.lineTo(p1.x + dx * s + normX * jitter, p1.y + dy * s + normY * jitter);
        }
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 2. Draw Projectiles
  for (const p of vfx.projectiles) {
    ctx.save();
    if (p.type === 'crossbow') {
      const angle = Math.atan2(p.targetY - p.startY, p.targetX - p.startX);
      ctx.translate(p.currentX, p.currentY);
      ctx.rotate(angle);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-8, -1.5, 14, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, -1, 3, 2);
    } else if (p.type === 'mortar') {
      const arc = -Math.sin(p.progress * Math.PI) * 45;
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.arc(p.currentX, p.currentY + arc, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Draw Particles
  for (const pt of vfx.particles) {
    const alpha = Math.max(0, pt.life / pt.maxLife);
    ctx.save();
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 4. Draw Floating Texts (+XX⚙)
  for (const ft of vfx.floatingTexts) {
    const alpha = Math.max(0, ft.life / ft.maxLife);
    ctx.save();
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = ft.color;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 4;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}
