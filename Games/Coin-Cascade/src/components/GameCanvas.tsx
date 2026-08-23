import React, { useEffect, useRef } from 'react';
import {
  EDGE_MARGIN,
  PUSHER_THICK,
  PUSHER_X0,
  PUSHER_X1,
  SHELF_LEN,
  SHELF_W,
  TRIGGER_ZONE_MARGIN,
  WALL_X0,
  WALL_X1,
} from '../game/constants';
import { coinRadius, pusherFrontY } from '../game/engine';
import type { Coin, CoinKind, RunState } from '../game/types';

interface Props {
  stateRef: React.MutableRefObject<RunState | null>;
  chuteXRef: React.MutableRefObject<number>;
  paused: boolean;
  reducedMotion: boolean;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
}

function loadImage(path: string): HTMLImageElement {
  const img = new Image();
  img.decoding = 'async';
  img.src = `${import.meta.env.BASE_URL}${path}`;
  return img;
}

function drawCabinet(ctx: CanvasRenderingContext2D, shelf: HTMLImageElement | null): void {
  // Outer wood frame
  const wood = ctx.createLinearGradient(0, -70, 0, SHELF_LEN);
  wood.addColorStop(0, '#3b2414');
  wood.addColorStop(0.5, '#5c3a1e');
  wood.addColorStop(1, '#2a180c');
  ctx.fillStyle = wood;
  ctx.fillRect(-8, -70, SHELF_W + 16, SHELF_LEN + 78);

  // Shelf play surface
  if (shelf && shelf.complete && shelf.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SHELF_W, SHELF_LEN);
    ctx.clip();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(shelf, 0, 0, SHELF_W, SHELF_LEN);
    ctx.globalAlpha = 1;
    // Warm varnish wash so coins still read clearly
    const varnish = ctx.createLinearGradient(0, 0, 0, SHELF_LEN);
    varnish.addColorStop(0, 'rgba(40, 24, 10, 0.35)');
    varnish.addColorStop(0.7, 'rgba(20, 12, 4, 0.15)');
    varnish.addColorStop(1, 'rgba(251, 191, 36, 0.12)');
    ctx.fillStyle = varnish;
    ctx.fillRect(0, 0, SHELF_W, SHELF_LEN);
    ctx.restore();
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, SHELF_LEN);
    bg.addColorStop(0, '#241c12');
    bg.addColorStop(1, '#3a2a14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SHELF_W, SHELF_LEN);
  }

  // Side walls with warm bulb glow
  const leftWall = ctx.createLinearGradient(0, 0, WALL_X0, 0);
  leftWall.addColorStop(0, '#1a0e08');
  leftWall.addColorStop(1, '#4a2c16');
  ctx.fillStyle = leftWall;
  ctx.fillRect(0, 0, WALL_X0, SHELF_LEN);
  const rightWall = ctx.createLinearGradient(WALL_X1, 0, SHELF_W, 0);
  rightWall.addColorStop(0, '#4a2c16');
  rightWall.addColorStop(1, '#1a0e08');
  ctx.fillStyle = rightWall;
  ctx.fillRect(WALL_X1, 0, SHELF_W - WALL_X1, SHELF_LEN);

  // Decorative bulbs along walls
  for (let i = 0; i < 7; i++) {
    const y = 28 + i * ((SHELF_LEN - 56) / 6);
    for (const x of [WALL_X0 * 0.45, WALL_X1 + (SHELF_W - WALL_X1) * 0.55]) {
      const glow = ctx.createRadialGradient(x, y, 1, x, y, 14);
      glow.addColorStop(0, 'rgba(253, 224, 71, 0.85)');
      glow.addColorStop(0.4, 'rgba(251, 191, 36, 0.35)');
      glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
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

  // Front lip / prize chute glow
  const edgeGlow = ctx.createLinearGradient(0, SHELF_LEN - 36, 0, SHELF_LEN + 8);
  edgeGlow.addColorStop(0, 'rgba(251,191,36,0)');
  edgeGlow.addColorStop(0.55, 'rgba(251,191,36,0.22)');
  edgeGlow.addColorStop(1, 'rgba(253, 224, 71, 0.55)');
  ctx.fillStyle = edgeGlow;
  ctx.fillRect(0, SHELF_LEN - 36, SHELF_W, 44);

  ctx.fillStyle = 'rgba(15, 10, 4, 0.55)';
  ctx.fillRect(WALL_X0, SHELF_LEN - 4, WALL_X1 - WALL_X0, 8);
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(WALL_X0, SHELF_LEN);
  ctx.lineTo(WALL_X1, SHELF_LEN);
  ctx.stroke();
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

function drawPusher(ctx: CanvasRenderingContext2D, tick: number, metal: HTMLImageElement | null): void {
  const frontY = pusherFrontY(tick);
  const backY = frontY - PUSHER_THICK;
  const x0 = PUSHER_X0;
  const w = PUSHER_X1 - PUSHER_X0;
  const h = frontY - backY;

  // Shadow under plate
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

  // Bevel highlights
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(x0, frontY - 3, w, 3);
  ctx.fillStyle = 'rgba(15,23,42,0.35)';
  ctx.fillRect(x0, backY, w, 2);
  ctx.strokeStyle = 'rgba(248,250,252,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, backY + 0.5, w - 1, h - 1);
}

function tintFor(kind: CoinKind): string {
  if (kind === 'heavy') return 'rgba(180, 83, 9, 0.35)';
  if (kind === 'trigger') return 'rgba(219, 39, 119, 0.4)';
  if (kind === 'ball') return 'rgba(14, 165, 233, 0.25)';
  return 'rgba(251, 191, 36, 0.08)';
}

function drawCoinFace(
  ctx: CanvasRenderingContext2D,
  coin: Coin,
  gold: HTMLImageElement | null,
  tick: number,
): void {
  const r = coinRadius(coin.kind);
  const { x, y, kind } = coin;

  // Drop shadow
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

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  if (gold && gold.complete && gold.naturalWidth > 0) {
    ctx.drawImage(gold, x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = tintFor(kind);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  } else {
    const fill = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.15, x, y, r);
    if (kind === 'trigger') {
      fill.addColorStop(0, '#fce7f3');
      fill.addColorStop(0.5, '#f472b6');
      fill.addColorStop(1, '#9d174d');
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

    // Embossed rings
    ctx.beginPath();
    ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Specular glint
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
  ctx.strokeStyle = kind === 'trigger' ? 'rgba(251, 113, 133, 0.85)' : 'rgba(120, 53, 15, 0.75)';
  ctx.lineWidth = kind === 'heavy' ? 2 : 1.3;
  ctx.stroke();
}

function drawChute(ctx: CanvasRenderingContext2D, chuteX: number, cooling: boolean): void {
  // Rail above shelf
  ctx.fillStyle = 'rgba(15, 10, 4, 0.65)';
  ctx.fillRect(WALL_X0, -52, WALL_X1 - WALL_X0, 14);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.strokeRect(WALL_X0, -52, WALL_X1 - WALL_X0, 14);

  // Aim marker
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

  // Aim line down the shelf
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
export function GameCanvas({ stateRef, chuteXRef, paused, reducedMotion }: Props): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const shelfImg = loadImage('shelf.jpg');
    const metalImg = loadImage('metal.jpg');
    const goldImg = loadImage('coin-gold.jpg');
    const sparks: Spark[] = [];
    let lastTeeterIds = new Set<number>();

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

      drawCabinet(ctx, shelfImg);
      drawTriggerZone(ctx, s.triggerZoneX, s.tick, reducedMotion);
      drawEdgeBonusZones(ctx);
      drawPusher(ctx, s.tick, metalImg);

      // Spawn edge sparkles when a coin starts teetering (render-only juice).
      if (!reducedMotion) {
        const nowTeeter = new Set<number>();
        for (const c of s.coins) {
          if (c.teeterSince < 0) continue;
          nowTeeter.add(c.id);
          if (!lastTeeterIds.has(c.id)) {
            for (let i = 0; i < 5; i++) {
              // Deterministic spark directions from coin id — render-only juice.
              const n = ((c.id * 1103515245 + i * 12345) >>> 0) / 0xffffffff;
              const n2 = ((c.id * 1664525 + i * 1013904223) >>> 0) / 0xffffffff;
              sparks.push({
                x: c.x,
                y: c.y,
                vx: (n - 0.5) * 2.4,
                vy: -n2 * 2.2 - 0.4,
                life: 1,
                hue: c.kind === 'trigger' ? 330 : 45,
              });
            }
          }
        }
        lastTeeterIds = nowTeeter;
      }

      // Depth-ish order: back (small y) first so front coins sit on top.
      const ordered = [...s.coins].sort((a, b) => a.y - b.y);
      for (const coin of ordered) {
        drawCoinFace(ctx, coin, goldImg, s.tick);
        if (coin.wellTimed) {
          const r = coinRadius(coin.kind) + 3;
          ctx.beginPath();
          ctx.arc(coin.x, coin.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Near-miss pulse ring
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

      // Sparks
      for (const sp of sparks) {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += 0.08;
        sp.life -= 0.04;
        if (sp.life <= 0) continue;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 1.6 + (1 - sp.life) * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${sp.hue}, 95%, 70%, ${sp.life})`;
        ctx.fill();
      }
      while (sparks.length > 0 && sparks[0].life <= 0) sparks.shift();

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
