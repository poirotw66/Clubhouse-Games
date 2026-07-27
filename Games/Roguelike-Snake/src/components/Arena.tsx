import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { GRID } from '../game/config';
import { drawArena } from '../render/draw';
import type { GameState } from '../game/types';

export interface ArenaHandle {
  draw: (state: GameState, alpha: number) => void;
}

/** Canvas host: owns sizing/DPR, exposes an imperative draw so the loop lives in App. */
export const Arena = forwardRef<ArenaHandle>(function Arena(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cellRef = useRef(16);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const size = Math.max(200, Math.floor(wrap.clientWidth));
      const cell = Math.floor((size / GRID) * dpr) / dpr;
      const pixel = cell * GRID;

      canvas.style.width = `${pixel}px`;
      canvas.style.height = `${pixel}px`;
      canvas.width = Math.round(pixel * dpr);
      canvas.height = Math.round(pixel * dpr);
      cellRef.current = cell;

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    draw(state, alpha) {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      drawArena(ctx, state, alpha, cellRef.current);
    },
  }));

  return (
    <div ref={wrapRef} className="w-full flex justify-center">
      <canvas
        ref={canvasRef}
        className="rounded-2xl border border-slate-700/70 shadow-[0_0_40px_rgba(15,118,110,0.15)] touch-none"
      />
    </div>
  );
});
