import React from 'react';
import { type PieceColor } from '../utils/checkersLogic';

export interface ShatterParticle {
  id: number;
  dx: number;
  dy: number;
  rot: number;
  size: number;
  color: string;
}

export interface ShatterEvent {
  id: string;
  r: number;
  c: number;
  color: PieceColor;
  combo: number;
  particles: ShatterParticle[];
}

const COMBO_TITLES: Record<number, string> = {
  1: '連環飛跳！',
  2: '雙重絕殺！',
  3: '橫掃千軍！',
  4: '神乎其技！',
  5: '天下無雙！',
};

export function createShatterEvent(
  r: number,
  c: number,
  color: PieceColor,
  combo = 1,
): ShatterEvent {
  const isBlack = color === 'black';
  const colors = isBlack
    ? ['#292524', '#44403c', '#78716c', '#fbbf24', '#1c1917']
    : ['#fef3c7', '#fde68a', '#d97706', '#b45309', '#fffbeb'];

  const count = 12;
  const particles: ShatterParticle[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.5;
    const speed = 40 + Math.random() * 65;
    particles.push({
      id: i,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed - 15, // slight upward bias
      rot: (Math.random() - 0.5) * 720,
      size: 5 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  return {
    id: `shatter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    r,
    c,
    color,
    combo,
    particles,
  };
}

interface ShatterFxProps {
  events: ShatterEvent[];
  size: number;
}

export function ShatterFx({ events, size }: ShatterFxProps) {
  if (events.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-30" aria-hidden>
      {events.map((ev) => {
        const topPct = ((ev.r + 0.5) / size) * 100;
        const leftPct = ((ev.c + 0.5) / size) * 100;
        const title = COMBO_TITLES[Math.min(ev.combo, 5)] || `${ev.combo} 連跳絕殺！`;

        return (
          <React.Fragment key={ev.id}>
            {/* Center Explosion Shockwave Ring */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400 ck-shockwave-ring"
              style={{
                top: `${topPct}%`,
                left: `${leftPct}%`,
                width: '70px',
                height: '70px',
              }}
            />

            {/* Shattered Wooden Splinters */}
            {ev.particles.map((p) => (
              <div
                key={p.id}
                className="absolute ck-shatter-splinter rounded-[1px] shadow-sm"
                style={{
                  top: `${topPct}%`,
                  left: `${leftPct}%`,
                  width: `${p.size}px`,
                  height: `${Math.round(p.size * 0.65)}px`,
                  backgroundColor: p.color,
                  '--dx': `${p.dx}px`,
                  '--dy': `${p.dy}px`,
                  '--rot': `${p.rot}deg`,
                } as React.CSSProperties}
              />
            ))}

            {/* Floating Combo Badge */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 ck-combo-stamp"
              style={{
                top: `${topPct}%`,
                left: `${leftPct}%`,
              }}
            >
              <div className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 text-amber-100 font-extrabold text-xs tracking-wider shadow-lg border border-amber-300/80 whitespace-nowrap flex items-center gap-1">
                <span>💥</span>
                <span>{title}</span>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
