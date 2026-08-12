// Canvas toy silhouettes — readable characters, not flat rectangles.

import { drawFighterBody, type CharacterDef } from './characters';

export const BOXER_WIDTH = 60;
export const BOXER_HEIGHT = 120;

export type DrawAction =
  | 'IDLE'
  | 'JAB'
  | 'HOOK'
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
    // Ears
    roundRect(ctx, -18, -BOXER_HEIGHT / 2 - 58, 10, 32, 5);
    ctx.fill();
    roundRect(ctx, 8, -BOXER_HEIGHT / 2 - 58, 10, 32, 5);
    ctx.fill();
  } else if (id === 'bear') {
    // Round ears
    ctx.beginPath();
    ctx.arc(-18, -BOXER_HEIGHT / 2 - 28, 10, 0, Math.PI * 2);
    ctx.arc(18, -BOXER_HEIGHT / 2 - 28, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'bot') {
    // Antenna
    ctx.fillRect(-2, -BOXER_HEIGHT / 2 - 48, 4, 18);
    ctx.beginPath();
    ctx.arc(0, -BOXER_HEIGHT / 2 - 52, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'dino') {
    // Spikes / crest
    ctx.beginPath();
    ctx.moveTo(-8, -BOXER_HEIGHT / 2 - 28);
    ctx.lineTo(0, -BOXER_HEIGHT / 2 - 52);
    ctx.lineTo(8, -BOXER_HEIGHT / 2 - 28);
    ctx.closePath();
    ctx.fill();
    // Snout
    ctx.fillStyle = accent;
    roundRect(ctx, facing === 1 ? 8 : -28, -BOXER_HEIGHT / 2 - 18, 20, 12, 4);
    ctx.fill();
  }
}

export function drawToyBoxer(ctx: CanvasRenderingContext2D, b: DrawBoxerState): void {
  const char = b.character;
  ctx.save();

  const totalTime =
    b.action === 'JAB'
      ? 0.2
      : b.action === 'HOOK'
        ? 0.4
        : b.action === 'DODGE'
          ? 0.3
          : b.action === 'PARRY'
            ? 0.2
            : b.action === 'STAGGER'
              ? 0.6
              : 1;
  const progress = b.actionTimer > 0 ? (totalTime - b.actionTimer) / totalTime : 0;

  let bounce = Math.sin(Date.now() / 200) * 2;
  ctx.translate(b.x + BOXER_WIDTH / 2, b.y + BOXER_HEIGHT / 2 + bounce);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  const shadowScale = b.action === 'DODGE' ? 1.2 : 1;
  ctx.ellipse(0, BOXER_HEIGHT / 2 - bounce, 30 * shadowScale, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  if (b.action === 'JAB') {
    ctx.rotate(b.facing * progress * 0.1);
  } else if (b.action === 'HOOK') {
    ctx.rotate(b.facing * Math.sin(progress * Math.PI) * 0.2);
  } else if (b.action === 'HIT') {
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
  }

  // Body — soft fighter plate when ready; else procedural silhouette.
  const flashHit = b.action === 'HIT';
  ctx.save();
  ctx.scale(b.facing, 1);
  const usedPlate = !flashHit && b.action !== 'STAGGER' && drawFighterBody(ctx, char.id, BOXER_WIDTH, BOXER_HEIGHT);
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

    // Belly stripe
    ctx.fillStyle = char.accent;
    ctx.globalAlpha = 0.35;
    roundRect(ctx, -18, -20, 36, 50, 10);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Head
    ctx.fillStyle = char.head;
    roundRect(ctx, -18, -BOXER_HEIGHT / 2 - 32, 36, 34, 12);
    ctx.fill();
    drawAccessory(ctx, char.id, char.accent, b.facing);

    // Eyes
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

  // Dizzy dots
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

  if (b.action === 'JAB') {
    let ext: number;
    if (progress < 0.3) ext = (progress / 0.3) * 70;
    else ext = 70 - ((progress - 0.3) / 0.7) * 70;
    ctx.fillStyle = char.body;
    ctx.fillRect(b.facing === 1 ? 20 : -20 - ext, -20, ext, 15);
    ctx.fillStyle = gloveColor;
    roundRect(ctx, b.facing === 1 ? 20 + ext : -35 - ext, -25, 22, 28, 8);
    ctx.fill();
  } else if (b.action === 'HOOK') {
    const windUp = 0.3;
    let angle: number;
    if (progress < windUp) {
      angle = -(progress / windUp) * 0.5;
      ctx.rotate(b.facing * -0.1);
    } else {
      const swingProgress = (progress - windUp) / (1 - windUp);
      angle = -0.5 + swingProgress * (Math.PI + 0.5);
      ctx.rotate(b.facing * swingProgress * 0.3);
    }
    const x = Math.cos(angle) * 55 * b.facing;
    const y = -Math.sin(angle) * 35;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = char.body;
    ctx.beginPath();
    ctx.arc(b.facing === 1 ? 20 : -20, -10, 45, Math.PI, Math.PI + angle * b.facing, b.facing === -1);
    ctx.stroke();
    ctx.fillStyle = gloveColor;
    ctx.beginPath();
    ctx.arc(b.facing === 1 ? 20 + x : -20 + x, -10 + y, 18, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.action === 'BLOCK') {
    ctx.fillStyle = gloveColor;
    roundRect(ctx, b.facing === 1 ? 15 : -35, -45, 20, 30, 8);
    ctx.fill();
    roundRect(ctx, b.facing === 1 ? 5 : -25, -35, 20, 30, 8);
    ctx.fill();
  } else if (b.action === 'DODGE') {
    ctx.translate(0, 30 * Math.sin(progress * Math.PI));
  } else if (b.action === 'IDLE') {
    ctx.fillStyle = gloveColor;
    roundRect(ctx, b.facing === 1 ? 15 : -35, -10, 16, 22, 7);
    ctx.fill();
    roundRect(ctx, b.facing === 1 ? -30 : 15, -10, 16, 22, 7);
    ctx.fill();
  }

  ctx.restore();
}
