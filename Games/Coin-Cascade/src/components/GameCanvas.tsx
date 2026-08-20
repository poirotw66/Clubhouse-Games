import React, { useEffect, useRef } from 'react';
import {
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
import type { Coin, RunState } from '../game/types';

interface Props {
  stateRef: React.MutableRefObject<RunState | null>;
  chuteXRef: React.MutableRefObject<number>;
  paused: boolean;
  reducedMotion: boolean;
}

const KIND_FILL: Record<string, string> = {
  normal: '#fde68a',
  heavy: '#f59e0b',
  ball: '#e0f2fe',
  trigger: '#f472b6',
};
const KIND_STROKE: Record<string, string> = {
  normal: '#92640a',
  heavy: '#7c3d05',
  ball: '#0369a1',
  trigger: '#9d174d',
};

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
      const FIELD_H = SHELF_LEN + 70; // a little headroom above the back wall for the chute
      const scale = Math.min(cssW / FIELD_W, cssH / FIELD_H);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      ctx.save();
      ctx.translate((cssW - FIELD_W * scale) / 2, (cssH - FIELD_H * scale) / 2);
      ctx.scale(scale, scale);
      ctx.translate(0, 70); // shelf origin sits below the chute strip

      // Shelf surface
      const bg = ctx.createLinearGradient(0, 0, 0, SHELF_LEN);
      bg.addColorStop(0, '#241c12');
      bg.addColorStop(1, '#3a2a14');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, SHELF_W, SHELF_LEN);

      // Walls
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, WALL_X0, SHELF_LEN);
      ctx.fillRect(WALL_X1, 0, SHELF_W - WALL_X1, SHELF_LEN);

      // Front edge glow (the open exit)
      const edgeGlow = ctx.createLinearGradient(0, SHELF_LEN - 24, 0, SHELF_LEN);
      edgeGlow.addColorStop(0, 'rgba(251,191,36,0)');
      edgeGlow.addColorStop(1, 'rgba(251,191,36,0.35)');
      ctx.fillStyle = edgeGlow;
      ctx.fillRect(0, SHELF_LEN - 24, SHELF_W, 24);

      // Trigger zone marker
      const zoneHalf = ((WALL_X1 - WALL_X0) * TRIGGER_ZONE_MARGIN) / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(244,114,182,0.55)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(s.triggerZoneX - zoneHalf * 2.4, 4, zoneHalf * 4.8, SHELF_LEN - 8);
      ctx.restore();

      // Pusher plate
      const frontY = pusherFrontY(s.tick);
      const backY = frontY - PUSHER_THICK;
      const plateGrad = ctx.createLinearGradient(0, backY, 0, frontY);
      plateGrad.addColorStop(0, '#cbd5e1');
      plateGrad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = plateGrad;
      ctx.fillRect(PUSHER_X0, backY, PUSHER_X1 - PUSHER_X0, frontY - backY);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(PUSHER_X0, frontY - 3, PUSHER_X1 - PUSHER_X0, 3);

      // Coins, batched by kind for fewer fill calls.
      const byKind = new Map<string, Coin[]>();
      for (const coin of s.coins) {
        const list = byKind.get(coin.kind);
        if (list) list.push(coin);
        else byKind.set(coin.kind, [coin]);
      }
      for (const [kind, list] of byKind) {
        ctx.beginPath();
        for (const coin of list) {
          const r = coinRadius(coin.kind);
          ctx.moveTo(coin.x + r, coin.y);
          ctx.arc(coin.x, coin.y, r, 0, Math.PI * 2);
        }
        ctx.fillStyle = KIND_FILL[kind] ?? '#fde68a';
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = KIND_STROKE[kind] ?? '#92640a';
        ctx.stroke();
      }

      // Near-miss highlight: a bright pulsing ring around any teetering coin.
      const teetering = s.coins.filter((c) => c.teeterSince >= 0);
      if (teetering.length > 0) {
        const pulse = reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(s.tick * 0.35);
        for (const c of teetering) {
          const r = coinRadius(c.kind) + 4;
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(248, 250, 252, ${0.55 * pulse})`;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }

      // Chute indicator
      const chuteX = chuteXRef.current;
      ctx.beginPath();
      ctx.moveTo(chuteX - 9, -18);
      ctx.lineTo(chuteX + 9, -18);
      ctx.lineTo(chuteX, -4);
      ctx.closePath();
      ctx.fillStyle = s.cooldown > 0 ? 'rgba(148,163,184,0.55)' : '#fbbf24';
      ctx.fill();

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
