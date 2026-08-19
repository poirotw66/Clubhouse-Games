import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { POSITIONS, formatMoney } from '../game/config';
import { traitById } from '../game/traits';
import type { GameState } from '../game/types';

const WIDTH = 720;
const HEIGHT = 1000;

let shareBg: HTMLImageElement | null = null;

function shareBackground(): HTMLImageElement {
  if (!shareBg) {
    shareBg = new Image();
    shareBg.decoding = 'async';
    shareBg.src = `${import.meta.env.BASE_URL}title-bg.jpg`;
  }
  return shareBg;
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const bg = shareBackground();
  if (bg.complete && bg.naturalWidth > 0) {
    const imgAspect = bg.naturalWidth / bg.naturalHeight;
    const canvasAspect = WIDTH / HEIGHT;
    if (imgAspect > canvasAspect) {
      const drawWidth = HEIGHT * imgAspect;
      ctx.drawImage(bg, (WIDTH - drawWidth) / 2, 0, drawWidth, HEIGHT);
    } else {
      const drawHeight = WIDTH / imgAspect;
      ctx.drawImage(bg, 0, (HEIGHT - drawHeight) / 2, WIDTH, drawHeight);
    }
  } else {
    const fallback = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    fallback.addColorStop(0, '#12283f');
    fallback.addColorStop(0.45, '#0a1526');
    fallback.addColorStop(1, '#070d17');
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }

  const overlay = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  overlay.addColorStop(0, 'rgba(7, 13, 23, 0.55)');
  overlay.addColorStop(0.45, 'rgba(7, 13, 23, 0.75)');
  overlay.addColorStop(1, 'rgba(7, 13, 23, 0.92)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

interface Stat {
  label: string;
  value: string;
}

function statsFor(state: GameState): Stat[] {
  const totals = state.summary!.totals;
  const avg = totals.avg.toFixed(3).replace(/^0/, '');
  if (state.position === 'TW') {
    return [
      { label: '職業球季', value: String(totals.seasons) },
      { label: '安打', value: String(totals.hits) },
      { label: '全壘打', value: String(totals.hr) },
      { label: '打率', value: avg },
      { label: '勝-敗', value: `${totals.wins}-${totals.losses}` },
      { label: '奪三振', value: String(totals.so) },
    ];
  }
  if (state.position === 'P') {
    return [
      { label: '職業球季', value: String(totals.seasons) },
      { label: '出賽', value: String(totals.games) },
      { label: '勝-敗', value: `${totals.wins}-${totals.losses}` },
      { label: '奪三振', value: String(totals.so) },
      { label: '防禦率', value: totals.era.toFixed(2) },
      { label: '救援', value: String(totals.saves) },
    ];
  }
  return [
    { label: '職業球季', value: String(totals.seasons) },
    { label: '出賽', value: String(totals.games) },
    { label: '安打', value: String(totals.hits) },
    { label: '全壘打', value: String(totals.hr) },
    { label: '打點', value: String(totals.rbi) },
    { label: '打率', value: avg },
  ];
}

/**
 * Draws the card onto a canvas rather than styling DOM, so the player gets a
 * single image file they can post anywhere — the whole point is that a run is
 * shareable without asking anyone to crop a screenshot.
 */
function draw(canvas: HTMLCanvasElement, state: GameState): void {
  const ctx = canvas.getContext('2d');
  const summary = state.summary;
  if (!ctx || !summary) return;

  const sans = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';
  const positionLabel = POSITIONS.find((p) => p.id === state.position)?.label ?? '';

  drawBackground(ctx);

  ctx.strokeStyle = 'rgba(251,191,36,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, WIDTH - 48, HEIGHT - 48);

  ctx.textAlign = 'center';

  ctx.fillStyle = '#64748b';
  ctx.font = `500 20px ${sans}`;
  ctx.fillText('B A S E B A L L   L I F E', WIDTH / 2, 96);

  ctx.fillStyle = '#f1f5f9';
  ctx.font = `800 62px ${sans}`;
  ctx.fillText(state.name, WIDTH / 2, 176);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 24px ${sans}`;
  ctx.fillText(`${positionLabel}・${state.originLabel}`, WIDTH / 2, 216);

  ctx.fillStyle = '#fbbf24';
  ctx.font = `800 44px ${sans}`;
  ctx.fillText(summary.verdict, WIDTH / 2, 296);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `400 22px ${sans}`;
  wrapText(ctx, summary.epitaph, WIDTH / 2, 344, WIDTH - 140, 34);

  // Stat grid: three columns, two rows.
  const stats = statsFor(state);
  const gridTop = 428;
  const colWidth = (WIDTH - 120) / 3;
  stats.forEach((stat, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const cx = 60 + colWidth * col + colWidth / 2;
    const cy = gridTop + row * 118;
    ctx.fillStyle = '#64748b';
    ctx.font = `500 19px ${sans}`;
    ctx.fillText(stat.label, cx, cy);
    ctx.fillStyle = '#f8fafc';
    ctx.font = `800 44px ${sans}`;
    ctx.fillText(stat.value, cx, cy + 50);
  });

  // Fixed rows below the grid rather than a flowing cursor: the content is
  // bounded, and letting it flow pushed the record line under the footer band
  // as soon as a player unlocked a few traits.
  ctx.fillStyle = 'rgba(148,163,184,0.25)';
  ctx.fillRect(60, gridTop + 218, WIDTH - 120, 1);

  const traits = state.traits.map((id) => traitById(id)?.label).filter(Boolean) as string[];
  ctx.fillStyle = '#64748b';
  ctx.font = `500 19px ${sans}`;
  ctx.fillText('隱藏特質', WIDTH / 2, 686);
  ctx.fillStyle = traits.length > 0 ? '#fcd34d' : '#475569';
  ctx.font = `700 26px ${sans}`;
  wrapText(ctx, traits.length > 0 ? traits.join('・') : '無', WIDTH / 2, 724, WIDTH - 140, 34, 2);

  const feats = state.milestones.filter((m) => m.kind === 'feat');
  ctx.fillStyle = '#64748b';
  ctx.font = `500 19px ${sans}`;
  ctx.fillText('生涯紀錄', WIDTH / 2, 794);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = `600 23px ${sans}`;
  const record = `${state.milestones.length} 項　${feats.length > 0 ? feats[0].text : `最高年薪 ${formatMoney(summary.peakSalary)}`}`;
  wrapText(ctx, record, WIDTH / 2, 830, WIDTH - 140, 32, 1);

  // Footer: the seed is the point of sharing, so it gets its own band.
  const footerY = HEIGHT - 94;
  ctx.fillStyle = 'rgba(251,191,36,0.10)';
  ctx.fillRect(24, footerY - 44, WIDTH - 48, 92);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 20px ${sans}`;
  ctx.fillText('用同一組種子碼，走出你自己的棒球人生', WIDTH / 2, footerY - 10);
  ctx.fillStyle = '#fbbf24';
  ctx.font = `800 40px ${sans}`;
  ctx.fillText(state.seedCode, WIDTH / 2, footerY + 34);
}

/**
 * Canvas has no text wrapping, and the epitaph is a full sentence. `maxLines`
 * caps the block so a long trait list cannot grow into the row beneath it;
 * the overflow is elided rather than allowed to collide.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
): void {
  const lines: string[] = [];
  let line = '';
  for (const char of [...text]) {
    const attempt = line + char;
    if (ctx.measureText(attempt).width > maxWidth && line !== '') {
      lines.push(line);
      line = char;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);

  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines && shown.length > 0) {
    shown[shown.length - 1] = `${shown[shown.length - 1].slice(0, -1)}…`;
  }
  shown.forEach((text_, index) => ctx.fillText(text_, x, y + index * lineHeight));
}

export function ShareCard({ state }: { state: GameState }): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => draw(canvas, state);
    render();

    const bg = shareBackground();
    if (!bg.complete) {
      bg.addEventListener('load', render);
      return () => bg.removeEventListener('load', render);
    }
  }, [state]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement('a');
      link.download = `baseball-life-${state.seedCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setStatus('saved');
    } catch {
      // Some in-app browsers block programmatic downloads; the card is still
      // on screen, so long-press or screenshot remains a fine fallback.
      setStatus('failed');
    }
    window.setTimeout(() => setStatus('idle'), 2400);
  }, [state.seedCode]);

  return (
    <section className="bl-card mt-4 p-4">
      <h2 className="text-sm font-bold text-slate-200">分享卡</h2>
      <p className="mt-1 text-xs text-slate-400">
        存成圖片直接貼到社群，或長按／截圖也可以。
      </p>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={`${state.name} 的生涯分享卡，結局為 ${state.summary?.verdict ?? ''}`}
        className="mt-3 w-full rounded-xl border border-slate-700"
      />
      <TouchButton
        label={status === 'saved' ? '已儲存' : status === 'failed' ? '請長按圖片儲存' : '下載分享卡'}
        ariaLabel="下載分享卡圖片"
        onClick={download}
        className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-800 px-4 text-sm font-bold text-slate-100"
      />
    </section>
  );
}
