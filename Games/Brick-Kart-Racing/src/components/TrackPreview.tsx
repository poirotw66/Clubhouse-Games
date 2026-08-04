import {useEffect, useRef} from 'react';
import type {TrackDef} from '../data/tracks';
import {trackControlPoints} from '../data/tracks';
import {buildCenterline} from '../engine/spline';

interface Props {
  def: TrackDef;
  size?: number;
  mirror?: boolean;
}

/** Overhead silhouette of the lap, drawn from the same spline the race uses. */
export function TrackPreview({def, size = 132, mirror = false}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, px, px);

    let pts = trackControlPoints(def);
    if (mirror) {
      // Match race mirroring (flip around world centre, then fit to preview).
      const mid =
        pts.reduce((s, p) => s + p.x, 0) / Math.max(1, pts.length);
      pts = pts.map((p) => ({x: mid * 2 - p.x, y: p.y}));
    }
    const line = buildCenterline(pts, 240);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of line.points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const pad = px * 0.12;
    const scale = Math.min((px - pad * 2) / (maxX - minX), (px - pad * 2) / (maxY - minY));
    const ox = pad + (px - pad * 2 - (maxX - minX) * scale) / 2 - minX * scale;
    const oy = pad + (px - pad * 2 - (maxY - minY) * scale) / 2 - minY * scale;

    ctx.beginPath();
    line.points.forEach((p, i) => {
      const x = ox + p.x * scale;
      const y = oy + p.y * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = px * 0.085;
    ctx.strokeStyle = def.theme.curbA;
    ctx.stroke();
    ctx.lineWidth = px * 0.055;
    ctx.strokeStyle = def.theme.road;
    ctx.stroke();

    const start = line.points[0];
    ctx.fillStyle = '#f5f6f8';
    const s = px * 0.05;
    ctx.fillRect(ox + start.x * scale - s / 2, oy + start.y * scale - s / 2, s, s);
  }, [def, size, mirror]);

  return <canvas ref={ref} style={{width: size, height: size}} aria-hidden />;
}
