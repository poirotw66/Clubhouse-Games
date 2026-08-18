import React, { useEffect, useRef } from 'react';
import { FIELD_H, FIELD_W } from '../game/constants';
import { grazeRadius, hitboxRadius } from '../game/engine';
import type { RunState } from '../game/types';

interface Props {
  stateRef: React.MutableRefObject<RunState | null>;
  paused: boolean;
}

/**
 * Draws the field every animation frame straight from the simulation snapshot.
 * It reads through a ref rather than props so React never re-renders at 60fps —
 * the HUD re-renders a few times a second, the canvas draws itself.
 *
 * Bullets are batched by colour into a handful of paths. The balance harness
 * measured a peak of 648 bullets on screen, and a beginPath/fill per bullet at
 * that count is what turns a danmaku game into a slideshow on a phone.
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

      // Field
      const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H);
      bg.addColorStop(0, '#0a0b1e');
      bg.addColorStop(1, '#141033');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);

      // Fragments
      if (s.fragments.length > 0) {
        ctx.beginPath();
        for (const f of s.fragments) {
          ctx.moveTo(f.x + 5, f.y);
          ctx.arc(f.x, f.y, 5, 0, Math.PI * 2);
        }
        ctx.fillStyle = '#fde68a';
        ctx.fill();
      }

      // Enemies
      for (const e of s.enemies) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = e.isBoss ? 'rgba(244,114,182,0.85)' : 'rgba(148,163,184,0.9)';
        ctx.fill();
        if (e.isBoss) {
          const w = 220;
          const x0 = FIELD_W / 2 - w / 2;
          const frac = Math.max(0, e.hp / e.maxHp);
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(x0, 14, w, 5);
          ctx.fillStyle = '#f9a8d4';
          ctx.fillRect(x0, 14, w * frac, 5);

          // Phase thresholds are drawn onto the health bar. A card that grows a
          // new emitter at 50% is only a decision if you can see the line
          // coming — otherwise the fight just gets inexplicably worse.
          for (const phase of e.card?.phases ?? []) {
            const px = x0 + w * phase.belowHpFrac;
            const passed = frac <= phase.belowHpFrac;
            ctx.fillStyle = passed ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)';
            ctx.fillRect(px - 0.75, 11, 1.5, 11);
          }
        }
      }

      // Bullets, batched by hue bucket so the whole screen is a few fills.
      // Wall bullets get their own buckets (offset by 1000) so they can be
      // drawn as bright squares instead of soft circles.
      const buckets = new Map<number, typeof s.bullets>();
      for (const b of s.bullets) {
        const key = Math.round(b.hue / 30) * 30 + (b.isWall ? 1000 : 0);
        const list = buckets.get(key);
        if (list) list.push(b);
        else buckets.set(key, [b]);
      }
      for (const [key, list] of buckets) {
        const isWall = key >= 1000;
        const hue = key - (isWall ? 1000 : 0);
        ctx.beginPath();
        for (const b of list) {
          if (isWall) {
            ctx.rect(b.x - b.r, b.y - b.r * 0.72, b.r * 2, b.r * 1.44);
          } else {
            ctx.moveTo(b.x + b.r, b.y);
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          }
        }
        ctx.fillStyle = isWall ? `hsla(${hue}, 95%, 80%, 0.98)` : `hsla(${hue}, 90%, 72%, 0.95)`;
        ctx.fill();
        ctx.lineWidth = isWall ? 2 : 1.4;
        ctx.strokeStyle = `hsla(${hue}, 100%, ${isWall ? 96 : 92}%, ${isWall ? 1 : 0.85})`;
        ctx.stroke();
      }

      // Player
      const blinking = s.invuln > 0 && Math.floor(s.invuln * 12) % 2 === 0;
      if (!blinking) {
        ctx.beginPath();
        ctx.moveTo(s.px, s.py - 11);
        ctx.lineTo(s.px - 8, s.py + 9);
        ctx.lineTo(s.px, s.py + 4);
        ctx.lineTo(s.px + 8, s.py + 9);
        ctx.closePath();
        ctx.fillStyle = '#e0f2fe';
        ctx.fill();
      }

      // Focus mode reveals the hitbox and the graze ring — the two numbers the
      // whole game is played against.
      if (s.focus) {
        ctx.beginPath();
        ctx.arc(s.px, s.py, grazeRadius(s), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(125,211,252,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(s.px, s.py, hitboxRadius(s), 0, Math.PI * 2);
      ctx.fillStyle = s.focus ? '#f472b6' : 'rgba(244,114,182,0.55)';
      ctx.fill();

      ctx.restore();

      if (paused) {
        ctx.fillStyle = 'rgba(4,6,20,0.6)';
        ctx.fillRect(0, 0, cssW, cssH);
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stateRef, paused]);

  return <canvas ref={canvasRef} className="w-full h-full block touch-none" aria-label="彈幕戰場" />;
}
