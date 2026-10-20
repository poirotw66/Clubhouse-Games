import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export interface YakuCelebrationPayload {
  names: string[];
  /** True when at least one yaku was newly unlocked in the codex. */
  isNewUnlock: boolean;
}

interface YakuCelebrationProps {
  payload: YakuCelebrationPayload | null;
  onDone: () => void;
}

/**
 * Short burst when the player completes a yaku. Honors prefers-reduced-motion.
 */
export const YakuCelebration: React.FC<YakuCelebrationProps> = ({ payload, onDone }) => {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!payload) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const ms = reduceMotion ? 700 : 1100;
    const id = window.setTimeout(() => {
      setVisible(false);
      onDone();
    }, ms);
    return () => window.clearTimeout(id);
  }, [payload, onDone, reduceMotion]);

  return (
    <AnimatePresence>
      {visible && payload && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 top-[18%] z-[60] flex justify-center px-4"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.92 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: reduceMotion ? 0.2 : 0.35 }}
          role="status"
          aria-live="polite"
        >
          <div
            className={`yaku-celebrate-burst rounded-2xl border px-5 py-3 text-center shadow-xl ${
              payload.isNewUnlock
                ? 'border-gold bg-indigo-deep/90'
                : 'border-vermillion-light/70 bg-indigo-deep/85'
            }`}
          >
            <p className="font-display text-lg sm:text-xl font-bold text-gold">
              {payload.isNewUnlock ? '圖鑑解鎖！' : '組成役！'}
            </p>
            <p className="text-sm text-cream/85 mt-1">
              {payload.names.join(' · ')}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
