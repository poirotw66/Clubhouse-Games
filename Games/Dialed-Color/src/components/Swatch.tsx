import { motion } from 'motion/react';
import { colorToCss, huePatternId, huePatternLabel } from '../colors.mjs';
import type { Color } from '../types';

export function Swatch({
  color,
  colorBlind,
  className = '',
  animate = true,
  label,
}: {
  color: Color;
  colorBlind?: boolean;
  className?: string;
  animate?: boolean;
  label?: string;
}) {
  const pattern = huePatternId(color.h);
  const body = (
    <div
      className={`swatch relative overflow-hidden ${className}`}
      style={{ backgroundColor: colorToCss(color) }}
      role="img"
      aria-label={
        label ??
        (colorBlind
          ? `色票 H${color.h} S${color.s} L${color.l}，圖樣 ${huePatternLabel(color.h)}`
          : `色票 H${color.h} S${color.s} L${color.l}`)
      }
    >
      {colorBlind && <span className={`cb-pattern cb-pattern-${pattern}`} aria-hidden />}
      {colorBlind && (
        <span className="absolute bottom-2 left-2 right-2 text-center font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white/90 tabular-nums">
          H{color.h} · {huePatternLabel(color.h)}
        </span>
      )}
    </div>
  );

  if (!animate) return body;

  return (
    <motion.div
      key={`${color.h}-${color.s}-${color.l}`}
      initial={{ scale: 0.94, opacity: 0.85 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
    >
      {body}
    </motion.div>
  );
}
