import React, { useEffect, useRef } from 'react';

interface ZenFlowWaveformProps {
  combo: number;
  isSheathed: boolean;
  isSlashing: boolean;
  reactionRank?: string | null;
  className?: string;
}

export const ZenFlowWaveform: React.FC<ZenFlowWaveformProps> = ({
  combo,
  isSheathed,
  isSlashing,
  reactionRank,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Color scheme based on combo & rank
      let strokeColor = '#10b981'; // emerald
      let glowColor = 'rgba(16, 185, 129, 0.4)';
      if (reactionRank === 'S' || combo >= 10) {
        strokeColor = '#fbbf24'; // amber gold
        glowColor = 'rgba(251, 191, 36, 0.6)';
      } else if (combo >= 6) {
        strokeColor = '#a855f7'; // purple
        glowColor = 'rgba(168, 85, 247, 0.5)';
      } else if (combo >= 3 || isSheathed) {
        strokeColor = '#06b6d4'; // cyan
        glowColor = 'rgba(6, 182, 212, 0.5)';
      }

      const midY = height / 2;
      const speed = isSlashing ? 0.35 : isSheathed ? 0.16 : 0.08 + Math.min(0.12, combo * 0.015);
      phase += speed;

      const baseAmp = isSlashing ? 18 : isSheathed ? 14 : 6 + Math.min(10, combo * 1.5);
      const freq = isSheathed ? 0.06 : 0.035 + Math.min(0.04, combo * 0.005);

      // Draw faint background grid line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();

      // Main wave
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = isSheathed || isSlashing ? 12 : 6;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSheathed ? 2.5 : 1.8;
      ctx.beginPath();

      for (let x = 0; x < width; x += 2) {
        // Envelope: dampen at edges
        const edgeFactor = Math.sin((x / width) * Math.PI);
        const y =
          midY +
          Math.sin(x * freq + phase) * baseAmp * edgeFactor +
          Math.sin(x * freq * 2.2 - phase * 1.4) * (baseAmp * 0.4) * edgeFactor;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Secondary ghost wave for depth
      ctx.strokeStyle = strokeColor;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += 3) {
        const edgeFactor = Math.sin((x / width) * Math.PI);
        const y =
          midY -
          Math.sin(x * freq * 1.3 - phase * 0.9) * (baseAmp * 0.7) * edgeFactor;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [combo, isSheathed, isSlashing, reactionRank]);

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        width={260}
        height={56}
        className="w-full h-14 block"
      />
      <div className="absolute top-1 right-2 text-[10px] font-display uppercase tracking-widest text-slate-400 pointer-events-none">
        {isSlashing ? '一閃拔刀' : isSheathed ? '蓄力凝神' : combo > 0 ? `心流 x${combo}` : '心流平靜'}
      </div>
    </div>
  );
};
