import React, { useEffect, useRef } from 'react';
import {
  EDGE_MARGIN,
  PUSHER_X0,
  PUSHER_X1,
  SHELF_LEN,
  SHELF_W,
  TRIGGER_ZONE_MARGIN,
  WALL_X0,
  WALL_X1,
} from '../game/constants';
import { coinRadius, pusherFrontY } from '../game/engine';
import type { CoinSetDef } from '../game/progress';
import type { Peg } from '../game/tables';
import type { Coin, CoinKind, RunState } from '../game/types';

interface Props {
  stateRef: React.MutableRefObject<RunState | null>;
  chuteXRef: React.MutableRefObject<number>;
  paused: boolean;
  reducedMotion: boolean;
  coinSet: CoinSetDef;
  cabinetHue: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
  size: number;
}

interface JackpotFlash {
  life: number;
  amount: number;
  tide: boolean;
}

function loadImage(path: string): HTMLImageElement {
  const img = new Image();
  img.decoding = 'async';
  img.src = `${import.meta.env.BASE_URL}${path}`;
  return img;
}

function drawCabinet(
  ctx: CanvasRenderingContext2D,
  shelf: HTMLImageElement | null,
  hue: number,
): void {
  const wood = ctx.createLinearGradient(0, -70, 0, SHELF_LEN);
  wood.addColorStop(0, `hsl(${hue}, 45%, 18%)`);
  wood.addColorStop(0.5, `hsl(${hue}, 42%, 28%)`);
  wood.addColorStop(1, `hsl(${hue}, 40%, 12%)`);
  ctx.fillStyle = wood;
  ctx.fillRect(-8, -70, SHELF_W + 16, SHELF_LEN + 78);

  if (shelf && shelf.complete && shelf.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SHELF_W, SHELF_LEN);
    ctx.clip();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(shelf, 0, 0, SHELF_W, SHELF_LEN);
    ctx.globalAlpha = 1;
    const varnish = ctx.createLinearGradient(0, 0, 0, SHELF_LEN);
    varnish.addColorStop(0, `hsla(${hue}, 40%, 10%, 0.35)`);
    varnish.addColorStop(0.7, `hsla(${hue}, 35%, 8%, 0.15)`);
    varnish.addColorStop(1, `hsla(${hue}, 70%, 55%, 0.12)`);
    ctx.fillStyle = varnish;
    ctx.fillRect(0, 0, SHELF_W, SHELF_LEN);
    ctx.restore();
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, SHELF_LEN);
    bg.addColorStop(0, `hsl(${hue}, 30%, 12%)`);
    bg.addColorStop(1, `hsl(${hue}, 35%, 18%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SHELF_W, SHELF_LEN);
  }

  const leftWall = ctx.createLinearGradient(0, 0, WALL_X0, 0);
  leftWall.addColorStop(0, `hsl(${hue}, 35%, 8%)`);
  leftWall.addColorStop(1, `hsl(${hue}, 40%, 22%)`);
  ctx.fillStyle = leftWall;
  ctx.fillRect(0, 0, WALL_X0, SHELF_LEN);
  const rightWall = ctx.createLinearGradient(WALL_X1, 0, SHELF_W, 0);
  rightWall.addColorStop(0, `hsl(${hue}, 40%, 22%)`);
  rightWall.addColorStop(1, `hsl(${hue}, 35%, 8%)`);
  ctx.fillStyle = rightWall;
  ctx.fillRect(WALL_X1, 0, SHELF_W - WALL_X1, SHELF_LEN);

  for (let i = 0; i < 7; i++) {
    const y = 28 + i * ((SHELF_LEN - 56) / 6);
    for (const x of [WALL_X0 * 0.45, WALL_X1 + (SHELF_W - WALL_X1) * 0.55]) {
      const glow = ctx.createRadialGradient(x, y, 1, x, y, 14);
      glow.addColorStop(0, `hsla(${hue + 20}, 90%, 70%, 0.85)`);
      glow.addColorStop(0.4, `hsla(${hue + 10}, 85%, 55%, 0.35)`);
      glow.addColorStop(1, `hsla(${hue}, 80%, 50%, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#fef3c7';
      ctx.fill();
    }
  }

  const edgeGlow = ctx.createLinearGradient(0, SHELF_LEN - 36, 0, SHELF_LEN + 8);
  edgeGlow.addColorStop(0, `hsla(${hue}, 80%, 55%, 0)`);
  edgeGlow.addColorStop(0.55, `hsla(${hue}, 80%, 55%, 0.22)`);
  edgeGlow.addColorStop(1, `hsla(${hue + 15}, 90%, 65%, 0.55)`);
  ctx.fillStyle = edgeGlow;
  ctx.fillRect(0, SHELF_LEN - 36, SHELF_W, 44);

  ctx.fillStyle = 'rgba(15, 10, 4, 0.55)';
  ctx.fillRect(WALL_X0, SHELF_LEN - 4, WALL_X1 - WALL_X0, 8);
  ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.65)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(WALL_X0, SHELF_LEN);
  ctx.lineTo(WALL_X1, SHELF_LEN);
  ctx.stroke();
}

function drawPegs(ctx: CanvasRenderingContext2D, pegs: readonly Peg[]): void {
  for (const peg of pegs) {
    const shade = ctx.createRadialGradient(
      peg.x - peg.r * 0.3,
      peg.y - peg.r * 0.35,
      peg.r * 0.1,
      peg.x,
      peg.y,
      peg.r,
    );
    shade.addColorStop(0, '#e2e8f0');
    shade.addColorStop(0.45, '#64748b');
    shade.addColorStop(1, '#1e293b');
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, peg.r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fill();
  }
}

function drawEdgeBonusZones(ctx: CanvasRenderingContext2D): void {
  const h = SHELF_LEN - 12;
  for (const x0 of [WALL_X0, WALL_X1 - EDGE_MARGIN]) {
    const wash = ctx.createLinearGradient(x0, 0, x0 + (x0 === WALL_X0 ? EDGE_MARGIN : -EDGE_MARGIN), 0);
    wash.addColorStop(0, 'rgba(52, 211, 153, 0.14)');
    wash.addColorStop(1, 'rgba(52, 211, 153, 0)');
    ctx.fillStyle = wash;
    ctx.fillRect(x0 === WALL_X0 ? WALL_X0 : WALL_X1 - EDGE_MARGIN, 8, EDGE_MARGIN, h);
  }
}

function drawTriggerZone(ctx: CanvasRenderingContext2D, zoneX: number, tick: number, reduced: boolean): void {
  const zoneHalf = ((WALL_X1 - WALL_X0) * TRIGGER_ZONE_MARGIN) / 2;
  const pulse = reduced ? 0.55 : 0.4 + 0.35 * Math.sin(tick * 0.08);
  const w = zoneHalf * 4.8;
  const x0 = zoneX - w / 2;

  const wash = ctx.createLinearGradient(x0, 0, x0 + w, 0);
  wash.addColorStop(0, 'rgba(244,114,182,0)');
  wash.addColorStop(0.5, `rgba(244,114,182,${0.12 * pulse})`);
  wash.addColorStop(1, 'rgba(244,114,182,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(x0, 4, w, SHELF_LEN - 8);

  ctx.save();
  ctx.strokeStyle = `rgba(244,114,182,${0.45 + 0.35 * pulse})`;
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, 4, w, SHELF_LEN - 8);
  ctx.restore();

  ctx.fillStyle = `rgba(251, 113, 133, ${0.55 + 0.25 * pulse})`;
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('彩池觸發區', zoneX, 18);
}

function drawPusher(
  ctx: CanvasRenderingContext2D,
  tick: number,
  metal: HTMLImageElement | null,
  physics: RunState['config']['physics'],
): void {
  const frontY = pusherFrontY(tick, physics);
  const backY = frontY - physics.pusherThick;
  const x0 = PUSHER_X0;
  const w = PUSHER_X1 - PUSHER_X0;
  const h = frontY - backY;

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x0 + 4, frontY, w - 8, 8);

  if (metal && metal.complete && metal.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, backY, w, h);
    ctx.clip();
    ctx.drawImage(metal, x0, backY, w, h);
    ctx.restore();
  } else {
    const plateGrad = ctx.createLinearGradient(0, backY, 0, frontY);
    plateGrad.addColorStop(0, '#e2e8f0');
    plateGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = plateGrad;
    ctx.fillRect(x0, backY, w, h);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(x0, frontY - 3, w, 3);
  ctx.fillStyle = 'rgba(15,23,42,0.35)';
  ctx.fillRect(x0, backY, w, 2);
  ctx.strokeStyle = 'rgba(248,250,252,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, backY + 0.5, w - 1, h - 1);
}

function tintFor(kind: CoinKind, set: CoinSetDef): string {
  if (kind === 'heavy') return `hsla(${set.heavyHue}, 80%, 35%, 0.35)`;
  if (kind === 'trigger') return 'rgba(219, 39, 119, 0.4)';
  if (kind === 'ball') return 'rgba(14, 165, 233, 0.25)';
  if (kind === 'magnet') return 'rgba(99, 102, 241, 0.35)';
  return `hsla(${set.normalHue}, 70%, 45%, 0.12)`;
}

function drawCoinFace(
  ctx: CanvasRenderingContext2D,
  coin: Coin,
  gold: HTMLImageElement | null,
  tick: number,
  set: CoinSetDef,
): void {
  const r = coinRadius(coin.kind);
  const { x, y, kind } = coin;

  ctx.beginPath();
  ctx.ellipse(x + 1.2, y + 1.8, r * 0.95, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  if (kind === 'ball') {
    const ball = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    ball.addColorStop(0, '#f0f9ff');
    ball.addColorStop(0.45, '#7dd3fc');
    ball.addColorStop(1, '#0369a1');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ball;
    ctx.fill();
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    return;
  }

  if (kind === 'magnet') {
    const mag = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
    mag.addColorStop(0, '#e0e7ff');
    mag.addColorStop(0.45, '#818cf8');
    mag.addColorStop(1, '#3730a3');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = mag;
    ctx.fill();
    ctx.strokeStyle = 'rgba(199, 210, 254, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // N/S poles hint
    ctx.fillStyle = 'rgba(248, 113, 113, 0.85)';
    ctx.fillRect(x - r * 0.55, y - 2, r * 0.4, 4);
    ctx.fillStyle = 'rgba(96, 165, 250, 0.85)';
    ctx.fillRect(x + r * 0.15, y - 2, r * 0.4, 4);
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  if (gold && gold.complete && gold.naturalWidth > 0 && set.id === 'classic') {
    ctx.drawImage(gold, x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = tintFor(kind, set);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  } else {
    const fill = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.15, x, y, r);
    const hue = kind === 'heavy' ? set.heavyHue : set.normalHue;
    if (kind === 'trigger') {
      fill.addColorStop(0, '#fce7f3');
      fill.addColorStop(0.5, '#f472b6');
      fill.addColorStop(1, '#9d174d');
    } else if (set.id === 'neon') {
      fill.addColorStop(0, `hsl(${hue}, 90%, 85%)`);
      fill.addColorStop(0.45, `hsl(${hue}, 85%, 60%)`);
      fill.addColorStop(1, `hsl(${hue}, 80%, 35%)`);
    } else if (set.id === 'jade') {
      fill.addColorStop(0, `hsl(${hue}, 45%, 78%)`);
      fill.addColorStop(0.45, `hsl(${hue}, 50%, 48%)`);
      fill.addColorStop(1, `hsl(${hue}, 40%, 28%)`);
    } else if (kind === 'heavy') {
      fill.addColorStop(0, '#fef3c7');
      fill.addColorStop(0.5, '#f59e0b');
      fill.addColorStop(1, '#92400e');
    } else {
      fill.addColorStop(0, '#fffbeb');
      fill.addColorStop(0.45, '#fde68a');
      fill.addColorStop(1, '#b45309');
    }
    ctx.fillStyle = fill;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    ctx.beginPath();
    ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
    ctx.strokeStyle = set.id === 'neon' ? `hsla(${hue}, 90%, 80%, 0.55)` : 'rgba(120, 53, 15, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
    ctx.stroke();
  }

  const spin = (tick * 0.04 + coin.id * 0.7) % (Math.PI * 2);
  ctx.beginPath();
  ctx.ellipse(
    x + Math.cos(spin) * r * 0.25,
    y - r * 0.35,
    r * 0.35,
    r * 0.18,
    -0.5,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle =
    kind === 'trigger'
      ? 'rgba(251, 113, 133, 0.85)'
      : set.id === 'neon'
        ? `hsla(${set.normalHue}, 90%, 70%, 0.9)`
        : 'rgba(120, 53, 15, 0.75)';
  ctx.lineWidth = kind === 'heavy' ? 2 : 1.3;
  ctx.stroke();
}

function drawChute(ctx: CanvasRenderingContext2D, chuteX: number, cooling: boolean): void {
  ctx.fillStyle = 'rgba(15, 10, 4, 0.65)';
  ctx.fillRect(WALL_X0, -52, WALL_X1 - WALL_X0, 14);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.strokeRect(WALL_X0, -52, WALL_X1 - WALL_X0, 14);

  const body = ctx.createLinearGradient(chuteX, -48, chuteX, -4);
  body.addColorStop(0, cooling ? '#94a3b8' : '#fde68a');
  body.addColorStop(1, cooling ? '#64748b' : '#f59e0b');
  ctx.beginPath();
  ctx.moveTo(chuteX - 12, -46);
  ctx.lineTo(chuteX + 12, -46);
  ctx.lineTo(chuteX + 7, -22);
  ctx.lineTo(chuteX, -4);
  ctx.lineTo(chuteX - 7, -22);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.strokeStyle = cooling ? 'rgba(148,163,184,0.25)' : 'rgba(251,191,36,0.28)';
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(chuteX, 0);
  ctx.lineTo(chuteX, SHELF_LEN);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Draws the shelf every animation frame straight from the simulation
 * snapshot, reading through a ref so React never re-renders at 60fps.
 */
export function GameCanvas({
  stateRef,
  chuteXRef,
  paused,
  reducedMotion,
  coinSet,
  cabinetHue,
}: Props): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const coinSetRef = useRef(coinSet);
  const hueRef = useRef(cabinetHue);
  coinSetRef.current = coinSet;
  hueRef.current = cabinetHue;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const shelfImg = loadImage('shelf.jpg');
    const metalImg = loadImage('metal.jpg');
    const goldImg = loadImage('coin-gold.jpg');
    const sparks: Spark[] = [];
    let jackpotFlash: JackpotFlash | null = null;
    let lastTeeterIds = new Set<number>();
    let lastJackpotBursts = -1;

    const draw = (): void => {
      rafRef.current = requestAnimationFrame(draw);
      const s = stateRef.current;
      if (!s) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
      }
      const FIELD_W = SHELF_W;
      const FIELD_H = SHELF_LEN + 70;
      const scale = Math.min(cssW / FIELD_W, cssH / FIELD_H);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      ctx.save();
      ctx.translate((cssW - FIELD_W * scale) / 2, (cssH - FIELD_H * scale) / 2);
      ctx.scale(scale, scale);
      ctx.translate(0, 70);

      drawCabinet(ctx, shelfImg, hueRef.current);
      drawTriggerZone(ctx, s.triggerZoneX, s.tick, reducedMotion);
      drawEdgeBonusZones(ctx);
      drawPegs(ctx, s.config.physics.pegs);
      drawPusher(ctx, s.tick, metalImg, s.config.physics);

      // Jackpot celebration: detect burst count rise (render-only).
      if (lastJackpotBursts < 0) lastJackpotBursts = s.jackpotBursts;
      if (s.jackpotBursts > lastJackpotBursts) {
        const amount = s.events.jackpotBurst;
        const tide = s.events.jackpotTideBonus;
        jackpotFlash = { life: reducedMotion ? 0.55 : 1, amount, tide };
        if (!reducedMotion) {
          for (let i = 0; i < (tide ? 28 : 18); i++) {
            const n = ((s.tick * 1103515245 + i * 12345) >>> 0) / 0xffffffff;
            const n2 = ((s.tick * 1664525 + i * 1013904223) >>> 0) / 0xffffffff;
            sparks.push({
              x: SHELF_W * 0.5 + (n - 0.5) * SHELF_W * 0.6,
              y: SHELF_LEN * 0.55,
              vx: (n - 0.5) * 4.5,
              vy: -n2 * 5 - 1.2,
              life: 1,
              hue: tide ? 160 + n * 40 : 320 + n * 40,
              size: 2 + n2 * 2.5,
            });
          }
        }
      }
      lastJackpotBursts = s.jackpotBursts;

      if (!reducedMotion) {
        const nowTeeter = new Set<number>();
        for (const c of s.coins) {
          if (c.teeterSince < 0) continue;
          nowTeeter.add(c.id);
          if (!lastTeeterIds.has(c.id)) {
            for (let i = 0; i < 5; i++) {
              const n = ((c.id * 1103515245 + i * 12345) >>> 0) / 0xffffffff;
              const n2 = ((c.id * 1664525 + i * 1013904223) >>> 0) / 0xffffffff;
              sparks.push({
                x: c.x,
                y: c.y,
                vx: (n - 0.5) * 2.4,
                vy: -n2 * 2.2 - 0.4,
                life: 1,
                hue: c.kind === 'trigger' ? 330 : 45,
                size: 1.6,
              });
            }
          }
        }
        lastTeeterIds = nowTeeter;
      }

      const ordered = [...s.coins].sort((a, b) => a.y - b.y);
      for (const coin of ordered) {
        drawCoinFace(ctx, coin, goldImg, s.tick, coinSetRef.current);
        if (coin.wellTimed) {
          const r = coinRadius(coin.kind) + 3;
          ctx.beginPath();
          ctx.arc(coin.x, coin.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      const teetering = s.coins.filter((c) => c.teeterSince >= 0);
      if (teetering.length > 0) {
        const pulse = reducedMotion ? 1 : 0.55 + 0.45 * Math.sin(s.tick * 0.35);
        for (const c of teetering) {
          const r = coinRadius(c.kind) + 5;
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(254, 249, 195, ${0.65 * pulse})`;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }

      for (const sp of sparks) {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += 0.08;
        sp.life -= reducedMotion ? 0.08 : 0.04;
        if (sp.life <= 0) continue;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size + (1 - sp.life) * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${sp.hue}, 95%, 70%, ${sp.life})`;
        ctx.fill();
      }
      while (sparks.length > 0 && sparks[0]!.life <= 0) sparks.shift();

      if (jackpotFlash) {
        const alpha = jackpotFlash.life * (jackpotFlash.tide ? 0.55 : 0.4);
        ctx.fillStyle = jackpotFlash.tide
          ? `rgba(45, 212, 191, ${alpha})`
          : `rgba(244, 114, 182, ${alpha})`;
        ctx.fillRect(0, 0, SHELF_W, SHELF_LEN);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, jackpotFlash.life)})`;
        ctx.font = 'bold 22px Orbitron, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          jackpotFlash.tide
            ? `潮湧彩池！+${Math.round(jackpotFlash.amount)}`
            : `彩池爆開！+${Math.round(jackpotFlash.amount)}`,
          SHELF_W / 2,
          SHELF_LEN * 0.42,
        );
        jackpotFlash.life -= reducedMotion ? 0.06 : 0.025;
        if (jackpotFlash.life <= 0) jackpotFlash = null;
      }

      drawChute(ctx, chuteXRef.current, s.cooldown > 0);

      ctx.restore();

      if (paused) {
        ctx.fillStyle = 'rgba(10,6,2,0.6)';
        ctx.fillRect(0, 0, cssW, cssH);
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stateRef, chuteXRef, paused, reducedMotion]);

  return <canvas ref={canvasRef} className="w-full h-full block touch-none" aria-label="幣潮台面" />;
}
