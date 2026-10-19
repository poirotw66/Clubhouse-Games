// Canvas toy silhouettes — readable characters with wind-up tells + high/low guards.

import { drawFighterBody, type CharacterDef } from './characters';
import type { ActiveAttack, Height, PunchPhase } from './combat';

export const BOXER_WIDTH = 60;
export const BOXER_HEIGHT = 120;

export type DrawAction =
  | 'IDLE'
  | 'JAB'
  | 'HOOK'
  | 'SIGNATURE'
  | 'BLOCK'
  | 'DODGE'
  | 'HIT'
  | 'KO'
  | 'PARRY'
  | 'STAGGER';

export interface DrawBoxerState {
  x: number;
  y: number;
  facing: 1 | -1;
  action: DrawAction;
  actionTimer: number;
  character: CharacterDef;
  height: Height;
  attack: ActiveAttack | null;
  stunRatio?: number;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawAccessory(
  ctx: CanvasRenderingContext2D,
  id: CharacterDef['id'],
  accent: string,
  facing: 1 | -1,
): void {
  ctx.fillStyle = accent;
  if (id === 'bunny') {
    roundRect(ctx, -18, -BOXER_HEIGHT / 2 - 58, 10, 32, 5);
    ctx.fill();
    roundRect(ctx, 8, -BOXER_HEIGHT / 2 - 58, 10, 32, 5);
    ctx.fill();
  } else if (id === 'bear') {
    ctx.beginPath();
    ctx.arc(-18, -BOXER_HEIGHT / 2 - 28, 10, 0, Math.PI * 2);
    ctx.arc(18, -BOXER_HEIGHT / 2 - 28, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'bot') {
    ctx.fillRect(-2, -BOXER_HEIGHT / 2 - 48, 4, 18);
    ctx.beginPath();
    ctx.arc(0, -BOXER_HEIGHT / 2 - 52, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'dino') {
    ctx.beginPath();
    ctx.moveTo(-8, -BOXER_HEIGHT / 2 - 28);
    ctx.lineTo(0, -BOXER_HEIGHT / 2 - 52);
    ctx.lineTo(8, -BOXER_HEIGHT / 2 - 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = accent;
    roundRect(ctx, facing === 1 ? 8 : -28, -BOXER_HEIGHT / 2 - 18, 20, 12, 4);
    ctx.fill();
  }
}

function phaseProgress(attack: ActiveAttack): number {
  const p = attack.profile;
  if (attack.phase === 'windup') return 1 - attack.phaseTimer / Math.max(0.001, p.windup);
  if (attack.phase === 'active') return 1 - attack.phaseTimer / Math.max(0.001, p.active);
  return 1 - attack.phaseTimer / Math.max(0.001, p.recovery);
}

function gloveY(height: Height, crouch = 0): number {
  return height === 'low' ? 18 + crouch : -22 + crouch;
}

function drawWindupTell(
  ctx: CanvasRenderingContext2D,
  facing: 1 | -1,
  height: Height,
  progress: number,
  gloveColor: string,
  bodyColor: string,
  kind: string,
): void {
  // Pull glove back — the readable tell before the punch lands.
  const pull = 20 + progress * (kind === 'signature' ? 42 : kind === 'hook' ? 34 : 22);
  const y = gloveY(height);
  const shoulderDrop = height === 'low' ? progress * 10 : progress * 4;

  ctx.save();
  ctx.translate(0, shoulderDrop);
  ctx.fillStyle = bodyColor;
  const armX = facing === 1 ? 12 - pull : -12 + pull - 14;
  ctx.fillRect(armX, y + 4, 14 + pull * 0.15, 12);
  ctx.fillStyle = gloveColor;
  roundRect(ctx, facing === 1 ? 8 - pull : -30 + pull, y, 22, 26, 8);
  ctx.fill();

  // Motion line behind the coiled glove.
  ctx.strokeStyle = `rgba(255,255,255,${0.15 + progress * 0.45})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(facing === 1 ? 8 - pull - 8 : -8 + pull + 8, y + 12);
  ctx.lineTo(facing === 1 ? 8 - pull - 22 : -8 + pull + 22, y + 12);
  ctx.stroke();
  ctx.restore();
}

function drawActivePunch(
  ctx: CanvasRenderingContext2D,
  facing: 1 | -1,
  height: Height,
  progress: number,
  gloveColor: string,
  bodyColor: string,
  kind: string,
): void {
  const y = gloveY(height);
  if (kind === 'jab') {
    let ext: number;
    if (progress < 0.45) ext = (progress / 0.45) * 75;
    else ext = 75 - ((progress - 0.45) / 0.55) * 75;
    ctx.fillStyle = bodyColor;
    ctx.fillRect(facing === 1 ? 20 : -20 - ext, y + 4, ext, 14);
    ctx.fillStyle = gloveColor;
    roundRect(ctx, facing === 1 ? 20 + ext : -35 - ext, y - 2, 22, 28, 8);
    ctx.fill();
  } else {
    // Hook / signature arc — low swings lower.
    const windUp = 0.25;
    let angle: number;
    if (progress < windUp) {
      angle = -(progress / windUp) * 0.5;
    } else {
      const swingProgress = (progress - windUp) / (1 - windUp);
      angle = -0.5 + swingProgress * (Math.PI + 0.5);
      ctx.rotate(facing * swingProgress * 0.25);
    }
    const radius = kind === 'signature' ? 62 : 55;
    const x = Math.cos(angle) * radius * facing;
    const arcY = -Math.sin(angle) * (height === 'low' ? 22 : 35) + (height === 'low' ? 24 : 0);
    ctx.lineWidth = kind === 'signature' ? 16 : 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(facing === 1 ? 20 : -20, y, radius - 10, Math.PI, Math.PI + angle * facing, facing === -1);
    ctx.stroke();
    ctx.fillStyle = gloveColor;
    ctx.beginPath();
    ctx.arc(facing === 1 ? 20 + x : -20 + x, y + arcY * 0.2, kind === 'signature' ? 20 : 18, 0, Math.PI * 2);
    ctx.fill();
    if (kind === 'signature') {
      ctx.strokeStyle = 'rgba(232,121,249,0.85)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

export function drawToyBoxer(ctx: CanvasRenderingContext2D, b: DrawBoxerState): void {
  const char = b.character;
  ctx.save();

  const crouch = b.height === 'low' && (b.action === 'IDLE' || b.action === 'BLOCK') ? 14 : 0;
  let bounce = Math.sin(Date.now() / 200) * 2;
  ctx.translate(b.x + BOXER_WIDTH / 2, b.y + BOXER_HEIGHT / 2 + bounce + crouch);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  const shadowScale = b.action === 'DODGE' ? 1.2 : 1;
  ctx.ellipse(0, BOXER_HEIGHT / 2 - bounce - crouch, 30 * shadowScale, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  if (b.action === 'HIT') {
    ctx.translate(Math.random() * 6 - 3, Math.random() * 6 - 3);
    ctx.rotate(b.facing * -0.15);
  } else if (b.action === 'KO') {
    const elapsed = 2.0 - b.actionTimer;
    const fallProgress = Math.min(1, elapsed / 0.8);
    ctx.rotate(b.facing * (-Math.PI / 2) * fallProgress);
    ctx.translate(0, (BOXER_HEIGHT / 2) * fallProgress);
  } else if (b.action === 'PARRY') {
    ctx.rotate(b.facing * -0.05);
  } else if (b.action === 'STAGGER') {
    ctx.rotate(b.facing * -0.3);
    ctx.translate(Math.random() * 4 - 2, 0);
  } else if (b.action === 'DODGE') {
    const progress = b.actionTimer > 0 ? 1 - b.actionTimer / 0.3 : 0;
    ctx.translate(0, 30 * Math.sin(progress * Math.PI));
  }

  const flashHit = b.action === 'HIT';
  ctx.save();
  ctx.scale(b.facing, 1);
  const usedPlate =
    !flashHit && b.action !== 'STAGGER' && drawFighterBody(ctx, char.id, BOXER_WIDTH, BOXER_HEIGHT);
  ctx.restore();
  if (!usedPlate) {
    ctx.fillStyle = char.body;
    if (flashHit) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffffff';
    } else if (b.action === 'PARRY') {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#60a5fa';
    } else if (b.action === 'STAGGER') {
      ctx.fillStyle = '#71717a';
    }
    roundRect(ctx, -BOXER_WIDTH / 2, -BOXER_HEIGHT / 2, BOXER_WIDTH, BOXER_HEIGHT, 14);
    ctx.fill();
    if (b.action === 'PARRY') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = char.accent;
    ctx.globalAlpha = 0.35;
    roundRect(ctx, -18, -20, 36, 50, 10);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = char.head;
    roundRect(ctx, -18, -BOXER_HEIGHT / 2 - 32, 36, 34, 12);
    ctx.fill();
    drawAccessory(ctx, char.id, char.accent, b.facing);

    ctx.fillStyle = '#0f172a';
    const eyeX = b.facing === 1 ? 4 : -12;
    ctx.fillRect(eyeX, -BOXER_HEIGHT / 2 - 18, 6, 6);
    ctx.fillRect(eyeX + (b.facing === 1 ? 10 : -10), -BOXER_HEIGHT / 2 - 18, 6, 6);
  } else if (b.action === 'PARRY') {
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#60a5fa';
    roundRect(ctx, -BOXER_WIDTH / 2, -BOXER_HEIGHT / 2 - 28, BOXER_WIDTH, BOXER_HEIGHT + 36, 14);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Stun warning ring near the head.
  if ((b.stunRatio ?? 0) > 0.55) {
    const alpha = 0.35 + (b.stunRatio! - 0.55) * 1.2;
    ctx.strokeStyle = `rgba(250, 204, 21, ${Math.min(1, alpha)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -BOXER_HEIGHT / 2 - 20, 22 + b.stunRatio! * 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (b.action === 'KO' || b.action === 'HIT' || b.action === 'STAGGER') {
    const starsCount = b.action === 'KO' ? 5 : b.action === 'STAGGER' ? 4 : 3;
    const radius = b.action === 'STAGGER' ? 30 : 40;
    const time = performance.now() / 200;
    for (let i = 0; i < starsCount; i++) {
      const angle = time + (i * Math.PI * 2) / starsCount;
      const sx = Math.cos(angle) * radius;
      const sy = Math.sin(angle) * radius * 0.3 - 50;
      ctx.fillStyle = b.action === 'STAGGER' ? '#60a5fa' : '#fde047';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const gloveColor = char.glove;
  const attack = b.attack;

  if (attack && (b.action === 'JAB' || b.action === 'HOOK' || b.action === 'SIGNATURE')) {
    const progress = phaseProgress(attack);
    if (attack.phase === 'windup') {
      drawWindupTell(ctx, b.facing, attack.height, progress, gloveColor, char.body, attack.kind);
    } else if (attack.phase === 'active') {
      drawActivePunch(ctx, b.facing, attack.height, progress, gloveColor, char.body, attack.kind);
    } else {
      // Recovery — glove coming back.
      drawActivePunch(ctx, b.facing, attack.height, 0.85 + progress * 0.15, gloveColor, char.body, attack.kind === 'jab' ? 'jab' : 'hook');
    }
  } else if (b.action === 'BLOCK') {
    const y = gloveY(b.height);
    ctx.fillStyle = gloveColor;
    roundRect(ctx, b.facing === 1 ? 15 : -35, y - 8, 20, 30, 8);
    ctx.fill();
    roundRect(ctx, b.facing === 1 ? 5 : -25, y + 2, 20, 30, 8);
    ctx.fill();
    // Height badge for readability.
    ctx.fillStyle = b.height === 'high' ? 'rgba(96,165,250,0.9)' : 'rgba(251,146,60,0.9)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.height === 'high' ? '上' : '下', b.facing * 28, y - 14);
  } else if (b.action === 'IDLE' || b.action === 'DODGE') {
    const y = gloveY(b.height === 'low' ? 'low' : 'high');
    ctx.fillStyle = gloveColor;
    roundRect(ctx, b.facing === 1 ? 15 : -35, y, 16, 22, 7);
    ctx.fill();
    roundRect(ctx, b.facing === 1 ? -30 : 15, y, 16, 22, 7);
    ctx.fill();
  }

  ctx.restore();
}

export type { PunchPhase };
