import { useMemo } from 'react';
import { motion } from 'motion/react';

/** Burst of dots for great matches (≥850). */
export function MatchParticles() {
  const bits = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * Math.PI * 2;
        const dist = 48 + (i % 5) * 18;
        return {
          id: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          hue: (i * 37) % 360,
          delay: (i % 6) * 0.03,
        };
      }),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-8 overflow-visible" aria-hidden>
      {bits.map((b) => (
        <motion.span
          key={b.id}
          className="absolute w-2 h-2 rounded-full"
          style={{ background: `hsl(${b.hue} 70% 60%)` }}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 0], x: b.x, y: b.y, scale: [0.4, 1.1, 0.2] }}
          transition={{ duration: 0.9, delay: b.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
