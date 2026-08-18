import React, { useEffect, useRef } from 'react';
import { FIELD_H, FIELD_W, LANE_COUNT, PLAYER_Y, laneCenterX } from '../game/constants';
import type { RunState } from '../game/types';

interface Props {
  stateRef: React.MutableRefObject<RunState | null>;
  paused: boolean;
}

const OBSTACLE_COLOR: Record<string, string> = {
  hurdle: '#f59e0b',
  beam: '#38bdf8',
  wall: '#f87171',
};

/**
 * Draws the field every animation frame straight from the simulation
 * snapshot, reading through a ref rather than props so React never re-renders
 * at 60fps — the HUD updates a few times a second, the canvas draws itself.
 *
 * The junction preview strip is drawn fixed at the top (it summarises the
 * PENDING junction, which is knowable in full the instant the current branch
 * was locked in — that is the whole point of the design). The lock line
 * itself scrolls toward the player like any other track feature, so its
 * approach is felt spatially as well as read from the strip.
 */
export function GameCanvas({ stateRef, paused }: Props): React.ReactElement {
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
      const scale = Math.min(cssW / FIELD_W, cssH / FIELD_H);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      ctx.save();
      ctx.translate((cssW - FIELD_W * scale) / 2, (cssH - FIELD_H * scale) / 2);
      ctx.scale(scale, scale);

      const screenY = (absDistance: number): number => PLAYER_Y - (absDistance - s.distance);

      // Field background.
      const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H);
      bg.addColorStop(0, '#08130d');
      bg.addColorStop(1, '#0e1f16');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);

      // Lane dividers, and a soft highlight under the player's current lane so
      // "which branch am I about to take" reads at a glance.
      ctx.fillStyle = 'rgba(74,222,128,0.06)';
      ctx.fillRect(s.lane * (FIELD_W / LANE_COUNT), 0, FIELD_W / LANE_COUNT, FIELD_H);
      ctx.strokeStyle = 'rgba(148,163,184,0.18)';
      ctx.lineWidth = 1;
      for (let i = 1; i < LANE_COUNT; i++) {
        const x = (FIELD_W / LANE_COUNT) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, FIELD_H);
        ctx.stroke();
      }

      // The pending junction's lock line and its closed lane(s), scrolling in.
      const pj = s.pendingJunction;
      if (!s.activeBranch) {
        const lockY = screenY(pj.lockDistance);
        if (lockY > -20 && lockY < FIELD_H + 20) {
          const openLanes = new Set(pj.branches.map((b) => b.lane));
          for (let lane = 0; lane < LANE_COUNT; lane++) {
            if (openLanes.has(lane)) continue;
            ctx.fillStyle = 'rgba(248,113,113,0.35)';
            ctx.fillRect(lane * (FIELD_W / LANE_COUNT) + 4, Math.max(0, lockY - 400), FIELD_W / LANE_COUNT - 8, 400);
          }
          ctx.strokeStyle = 'rgba(226,232,240,0.85)';
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(0, lockY);
          ctx.lineTo(FIELD_W, lockY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Obstacles of the active branch.
      if (s.activeBranch) {
        for (const o of s.activeBranch.obstacles) {
          if (o.resolved) continue;
          const y = screenY(o.absDistance);
          if (y < -30 || y > FIELD_H + 30) continue;
          const x0 = o.lane * (FIELD_W / LANE_COUNT) + 6;
          const w = FIELD_W / LANE_COUNT - 12;
          ctx.fillStyle = OBSTACLE_COLOR[o.kind];
          if (o.kind === 'hurdle') {
            ctx.fillRect(x0, y - 6, w, 12);
          } else if (o.kind === 'beam') {
            ctx.fillRect(x0, y - 16, w, 10);
            ctx.fillStyle = 'rgba(56,189,248,0.25)';
            ctx.fillRect(x0, y - 5, w, 20);
          } else {
            ctx.fillRect(x0, y - 22, w, 44);
          }
        }

        // Reward marker.
        if (!s.activeBranch.rewardCollected && s.activeBranch.reward !== 'none') {
          const y = screenY(s.activeBranch.rewardAbsDistance);
          if (y > -20 && y < FIELD_H + 20) {
            const x = laneCenterX(s.activeBranch.lane);
            ctx.beginPath();
            ctx.arc(x, y, 9, 0, Math.PI * 2);
            ctx.fillStyle = s.activeBranch.reward === 'supply' ? '#34d399' : '#fbbf24';
            ctx.fill();
          }
        }
      }

      // Train, chasing from below. Clamped so a huge buffer still renders on
      // screen — it is meant to be reassuring, not invisible.
      const trainY = Math.min(FIELD_H + 40, screenY(s.distance - s.buffer));
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(20, trainY - 14, FIELD_W - 40, 26);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▲ 列車', FIELD_W / 2, trainY + 4);

      // Player.
      const blinking = s.hitStunTimer > 0 && Math.floor(s.hitStunTimer * 14) % 2 === 0;
      if (!blinking) {
        const px = laneCenterX(s.lane);
        const py = s.jumpTimer > 0 ? PLAYER_Y - 16 : s.slideTimer > 0 ? PLAYER_Y + 6 : PLAYER_Y;
        ctx.beginPath();
        if (s.slideTimer > 0) {
          ctx.ellipse(px, py, 16, 7, 0, 0, Math.PI * 2);
        } else {
          ctx.moveTo(px, py - 14);
          ctx.lineTo(px - 10, py + 10);
          ctx.lineTo(px + 10, py + 10);
          ctx.closePath();
        }
        ctx.fillStyle = '#e0f2fe';
        ctx.fill();
        if (s.jumpTimer > 0) {
          ctx.beginPath();
          ctx.ellipse(px, PLAYER_Y + 12, 10, 3, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fill();
        }
      }

      ctx.restore();

      // ── Fixed HUD strip: the pending junction's preview, always current. ──
      const stripH = 64;
      ctx.save();
      ctx.translate((cssW - FIELD_W * scale) / 2, (cssH - FIELD_H * scale) / 2);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(4,10,7,0.72)';
      ctx.fillRect(0, 0, FIELD_W, stripH);
      const laneW = FIELD_W / LANE_COUNT;
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        const b = pj.branches.find((br) => br.lane === lane);
        const cx = laneW * (lane + 0.5);
        if (!b) {
          ctx.fillStyle = 'rgba(248,113,113,0.9)';
          ctx.font = 'bold 16px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('封閉', cx, 24);
          continue;
        }
        const speedGlyph = b.speedMult > 1.05 ? '加速 ▲' : b.speedMult < 0.95 ? '減速 ▼' : '維持 ▬';
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(speedGlyph, cx, 16);
        // Density dots.
        const dots = Math.min(8, b.density);
        const dotSpacing = 9;
        const startX = cx - ((dots - 1) * dotSpacing) / 2;
        for (let i = 0; i < dots; i++) {
          ctx.beginPath();
          ctx.arc(startX + i * dotSpacing, 32, 2.6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(226,232,240,0.85)';
          ctx.fill();
        }
        const rewardText = b.reward === 'supply' ? '補給' : b.reward === 'score' ? '倍率' : '—';
        ctx.fillStyle = b.reward === 'none' ? 'rgba(148,163,184,0.7)' : b.reward === 'supply' ? '#34d399' : '#fbbf24';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(rewardText, cx, 48);
      }
      ctx.restore();

      if (paused) {
        ctx.fillStyle = 'rgba(4,10,7,0.6)';
        ctx.fillRect(0, 0, cssW, cssH);
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stateRef, paused]);

  return <canvas ref={canvasRef} className="w-full h-full block touch-none" aria-label="岔道跑道" />;
}
