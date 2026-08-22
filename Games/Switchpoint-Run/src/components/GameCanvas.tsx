import React, { useEffect, useRef } from 'react';
import { FIELD_H, FIELD_W, LANE_COUNT, PLAYER_Y, laneCenterX, type ObstacleKind } from '../game/constants';
import type { RunState } from '../game/types';

interface Props {
  stateRef: React.MutableRefObject<RunState | null>;
  paused: boolean;
}

const LANE_W = FIELD_W / LANE_COUNT;

function drawBallast(ctx: CanvasRenderingContext2D, distance: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  bg.addColorStop(0, '#0a1610');
  bg.addColorStop(0.55, '#10241a');
  bg.addColorStop(1, '#0c1a14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  // Tunnel walls
  const left = ctx.createLinearGradient(0, 0, 18, 0);
  left.addColorStop(0, 'rgba(0,0,0,0.55)');
  left.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, 18, FIELD_H);
  const right = ctx.createLinearGradient(FIELD_W, 0, FIELD_W - 18, 0);
  right.addColorStop(0, 'rgba(0,0,0,0.55)');
  right.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = right;
  ctx.fillRect(FIELD_W - 18, 0, 18, FIELD_H);

  // Distant speed lines keyed off scroll
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
  ctx.lineWidth = 1;
  const offset = distance % 40;
  for (let y = -offset; y < FIELD_H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(FIELD_W - 8, y);
    ctx.stroke();
  }
}

function drawTracks(ctx: CanvasRenderingContext2D, distance: number, activeLane: number): void {
  const sleeperGap = 22;
  const scroll = distance % sleeperGap;

  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const x0 = lane * LANE_W;
    const cx = x0 + LANE_W / 2;
    const railLeft = cx - 16;
    const railRight = cx + 16;

    // Active lane glow
    if (lane === activeLane) {
      const glow = ctx.createLinearGradient(x0, 0, x0 + LANE_W, 0);
      glow.addColorStop(0, 'rgba(52, 211, 153, 0)');
      glow.addColorStop(0.5, 'rgba(52, 211, 153, 0.10)');
      glow.addColorStop(1, 'rgba(52, 211, 153, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x0, 0, LANE_W, FIELD_H);
    }

    // Sleepers (ties)
    ctx.fillStyle = 'rgba(120, 90, 50, 0.55)';
    for (let y = -scroll; y < FIELD_H + sleeperGap; y += sleeperGap) {
      ctx.fillRect(railLeft - 6, y, railRight - railLeft + 12, 5);
    }

    // Rails
    const railGrad = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    railGrad.addColorStop(0, '#94a3b8');
    railGrad.addColorStop(0.5, '#e2e8f0');
    railGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = railGrad;
    ctx.fillRect(railLeft - 1.5, 0, 3, FIELD_H);
    ctx.fillRect(railRight - 1.5, 0, 3, FIELD_H);

    // Inner highlight on rails
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(railLeft - 0.5, 0, 1, FIELD_H);
    ctx.fillRect(railRight - 0.5, 0, 1, FIELD_H);
  }

  // Lane separators as faint gravel ridges
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < LANE_COUNT; i++) {
    const x = LANE_W * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD_H);
    ctx.stroke();
  }
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  kind: ObstacleKind,
  x0: number,
  y: number,
  w: number,
): void {
  if (kind === 'hurdle') {
    // Low rail barrier — jump over
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x0 + 4, y - 4, w - 8, 10);
    const bar = ctx.createLinearGradient(x0, y, x0, y + 8);
    bar.addColorStop(0, '#fbbf24');
    bar.addColorStop(1, '#b45309');
    ctx.fillStyle = bar;
    ctx.fillRect(x0 + 2, y - 8, w - 4, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x0 + 2, y - 8, w - 4, 1.5);
  } else if (kind === 'beam') {
    // Overhead beam — slide under
    ctx.fillStyle = 'rgba(14, 116, 144, 0.35)';
    ctx.fillRect(x0 + 2, y - 4, w - 4, 28);
    const beam = ctx.createLinearGradient(x0, y - 18, x0, y - 6);
    beam.addColorStop(0, '#7dd3fc');
    beam.addColorStop(1, '#0284c7');
    ctx.fillStyle = beam;
    ctx.fillRect(x0, y - 18, w, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(x0, y - 18, w, 2);
    // Support posts
    ctx.fillStyle = '#0e7490';
    ctx.fillRect(x0 + 4, y - 8, 4, 24);
    ctx.fillRect(x0 + w - 8, y - 8, 4, 24);
  } else {
    // Blocking wall — change lane
    const wall = ctx.createLinearGradient(x0, y - 24, x0 + w, y + 24);
    wall.addColorStop(0, '#7f1d1d');
    wall.addColorStop(0.5, '#f87171');
    wall.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = wall;
    ctx.fillRect(x0 + 2, y - 24, w - 4, 48);
    ctx.strokeStyle = 'rgba(254, 226, 226, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 + 2, y - 24, w - 4, 48);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✕', x0 + w / 2, y + 4);
  }
}

function drawReward(ctx: CanvasRenderingContext2D, x: number, y: number, kind: 'supply' | 'score', t: number): void {
  const pulse = 8 + Math.sin(t * 6) * 2;
  ctx.beginPath();
  ctx.arc(x, y, pulse + 6, 0, Math.PI * 2);
  ctx.fillStyle = kind === 'supply' ? 'rgba(52, 211, 153, 0.18)' : 'rgba(251, 191, 36, 0.18)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, pulse, 0, Math.PI * 2);
  const fill = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, pulse);
  if (kind === 'supply') {
    fill.addColorStop(0, '#ecfdf5');
    fill.addColorStop(1, '#059669');
  } else {
    fill.addColorStop(0, '#fffbeb');
    fill.addColorStop(1, '#d97706');
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(kind === 'supply' ? '+' : '×', x, y + 0.5);
  ctx.textBaseline = 'alphabetic';
}

function drawTrain(ctx: CanvasRenderingContext2D, trainY: number, t: number): void {
  const bodyTop = trainY - 18;
  const bodyH = 34;

  // Headlight bloom
  const light = ctx.createRadialGradient(FIELD_W / 2, trainY - 28, 4, FIELD_W / 2, trainY - 40, 90);
  light.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
  light.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = light;
  ctx.fillRect(40, trainY - 80, FIELD_W - 80, 70);

  // Body
  const body = ctx.createLinearGradient(20, 0, FIELD_W - 20, 0);
  body.addColorStop(0, '#7f1d1d');
  body.addColorStop(0.5, '#ef4444');
  body.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = body;
  ctx.fillRect(28, bodyTop, FIELD_W - 56, bodyH);
  ctx.strokeStyle = 'rgba(254, 202, 202, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, bodyTop, FIELD_W - 56, bodyH);

  // Cab windows
  ctx.fillStyle = 'rgba(254, 243, 199, 0.85)';
  const flicker = 0.7 + Math.sin(t * 10) * 0.3;
  ctx.globalAlpha = flicker;
  ctx.fillRect(FIELD_W / 2 - 36, bodyTop + 6, 22, 12);
  ctx.fillRect(FIELD_W / 2 + 14, bodyTop + 6, 22, 12);
  ctx.globalAlpha = 1;

  // Cowcatcher
  ctx.beginPath();
  ctx.moveTo(FIELD_W / 2 - 50, bodyTop);
  ctx.lineTo(FIELD_W / 2, bodyTop - 14);
  ctx.lineTo(FIELD_W / 2 + 50, bodyTop);
  ctx.closePath();
  ctx.fillStyle = '#fca5a5';
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('列車', FIELD_W / 2, trainY + 4);
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  lane: number,
  jumpTimer: number,
  slideTimer: number,
): void {
  const px = laneCenterX(lane);
  const py = jumpTimer > 0 ? PLAYER_Y - 16 : slideTimer > 0 ? PLAYER_Y + 6 : PLAYER_Y;

  if (jumpTimer > 0) {
    ctx.beginPath();
    ctx.ellipse(px, PLAYER_Y + 12, 11, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
  }

  if (slideTimer > 0) {
    // Sliding railcar silhouette
    ctx.beginPath();
    ctx.ellipse(px, py, 18, 8, 0, 0, Math.PI * 2);
    const slide = ctx.createLinearGradient(px - 18, py, px + 18, py);
    slide.addColorStop(0, '#0ea5e9');
    slide.addColorStop(0.5, '#e0f2fe');
    slide.addColorStop(1, '#0ea5e9');
    ctx.fillStyle = slide;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.stroke();
    return;
  }

  // Small railcart / runner
  ctx.beginPath();
  ctx.moveTo(px, py - 16);
  ctx.lineTo(px - 12, py + 10);
  ctx.lineTo(px - 4, py + 6);
  ctx.lineTo(px, py + 11);
  ctx.lineTo(px + 4, py + 6);
  ctx.lineTo(px + 12, py + 10);
  ctx.closePath();
  const hull = ctx.createLinearGradient(px, py - 16, px, py + 11);
  hull.addColorStop(0, '#ecfeff');
  hull.addColorStop(0.5, '#67e8f9');
  hull.addColorStop(1, '#0891b2');
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Canopy
  ctx.beginPath();
  ctx.ellipse(px, py - 3, 3.5, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#34d399';
  ctx.fill();
}

function drawPreviewStrip(ctx: CanvasRenderingContext2D, s: RunState): void {
  const pj = s.pendingJunction;
  const stripH = 68;
  const panel = ctx.createLinearGradient(0, 0, 0, stripH);
  panel.addColorStop(0, 'rgba(4, 14, 10, 0.92)');
  panel.addColorStop(1, 'rgba(4, 14, 10, 0.72)');
  ctx.fillStyle = panel;
  ctx.fillRect(0, 0, FIELD_W, stripH);
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, stripH - 0.5);
  ctx.lineTo(FIELD_W, stripH - 0.5);
  ctx.stroke();

  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const b = pj.branches.find((br) => br.lane === lane);
    const cx = LANE_W * (lane + 0.5);
    const cardX = lane * LANE_W + 6;
    const cardW = LANE_W - 12;

    ctx.fillStyle = b ? 'rgba(15, 40, 28, 0.85)' : 'rgba(60, 16, 16, 0.75)';
    ctx.fillRect(cardX, 8, cardW, 52);
    ctx.strokeStyle = b ? 'rgba(52, 211, 153, 0.35)' : 'rgba(248, 113, 113, 0.4)';
    ctx.strokeRect(cardX, 8, cardW, 52);

    if (!b) {
      ctx.fillStyle = 'rgba(248,113,113,0.95)';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('封閉', cx, 40);
      continue;
    }

    const speedGlyph = b.speedMult > 1.05 ? '加速 ▲' : b.speedMult < 0.95 ? '減速 ▼' : '維持 ▬';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(speedGlyph, cx, 22);

    const dots = Math.min(8, b.density);
    const dotSpacing = 8;
    const startX = cx - ((dots - 1) * dotSpacing) / 2;
    for (let i = 0; i < dots; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * dotSpacing, 36, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = i < 3 ? '#86efac' : i < 6 ? '#fbbf24' : '#f87171';
      ctx.fill();
    }

    const rewardText = b.reward === 'supply' ? '補給' : b.reward === 'score' ? '倍率' : '—';
    ctx.fillStyle = b.reward === 'none' ? 'rgba(148,163,184,0.7)' : b.reward === 'supply' ? '#34d399' : '#fbbf24';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(rewardText, cx, 52);
  }
}

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

      drawBallast(ctx, s.distance);
      drawTracks(ctx, s.distance, s.lane);

      const pj = s.pendingJunction;
      if (!s.activeBranch) {
        const lockY = screenY(pj.lockDistance);
        if (lockY > -20 && lockY < FIELD_H + 20) {
          const openLanes = new Set(pj.branches.map((b) => b.lane));
          for (let lane = 0; lane < LANE_COUNT; lane++) {
            if (openLanes.has(lane)) continue;
            // Closed track: broken rails + danger wash
            const x0 = lane * LANE_W;
            ctx.fillStyle = 'rgba(248,113,113,0.22)';
            ctx.fillRect(x0 + 4, Math.max(0, lockY - 400), LANE_W - 8, 400);
            ctx.strokeStyle = 'rgba(248,113,113,0.55)';
            ctx.setLineDash([6, 5]);
            ctx.strokeRect(x0 + 8, Math.max(0, lockY - 400), LANE_W - 16, 400);
            ctx.setLineDash([]);
          }
          // Switch lock line
          const lockGrad = ctx.createLinearGradient(0, lockY - 2, 0, lockY + 2);
          lockGrad.addColorStop(0, 'rgba(226,232,240,0)');
          lockGrad.addColorStop(0.5, 'rgba(226,232,240,0.95)');
          lockGrad.addColorStop(1, 'rgba(226,232,240,0)');
          ctx.fillStyle = lockGrad;
          ctx.fillRect(0, lockY - 2, FIELD_W, 4);
          ctx.fillStyle = 'rgba(226,232,240,0.8)';
          ctx.font = 'bold 10px system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('道岔鎖定', 10, lockY - 6);
        }
      }

      if (s.activeBranch) {
        for (const o of s.activeBranch.obstacles) {
          if (o.resolved) continue;
          const y = screenY(o.absDistance);
          if (y < -30 || y > FIELD_H + 30) continue;
          const x0 = o.lane * LANE_W + 6;
          const w = LANE_W - 12;
          drawObstacle(ctx, o.kind, x0, y, w);
        }

        if (!s.activeBranch.rewardCollected && s.activeBranch.reward !== 'none') {
          const y = screenY(s.activeBranch.rewardAbsDistance);
          if (y > -20 && y < FIELD_H + 20) {
            drawReward(ctx, laneCenterX(s.activeBranch.lane), y, s.activeBranch.reward, s.elapsed);
          }
        }
      }

      const trainY = Math.min(FIELD_H + 40, screenY(s.distance - s.buffer));
      drawTrain(ctx, trainY, s.elapsed);

      const blinking = s.hitStunTimer > 0 && Math.floor(s.hitStunTimer * 14) % 2 === 0;
      if (!blinking) {
        drawPlayer(ctx, s.lane, s.jumpTimer, s.slideTimer);
      }

      ctx.restore();

      ctx.save();
      ctx.translate((cssW - FIELD_W * scale) / 2, (cssH - FIELD_H * scale) / 2);
      ctx.scale(scale, scale);
      drawPreviewStrip(ctx, s);
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
