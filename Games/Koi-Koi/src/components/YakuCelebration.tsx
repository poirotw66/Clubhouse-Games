import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export interface YakuCelebrationPayload {
  names: string[];
  yakuId?: string;
  /** True when at least one yaku was newly unlocked in the codex. */
  isNewUnlock: boolean;
}

const YAKU_BANNER_IDS = new Set([
  'gokou',
  'shikou',
  'ame_shikou',
  'sankou',
  'ino_shika_cho',
  'hanami_zake',
  'tsukimi_zake',
  'akatan',
  'aotan',
]);

interface YakuCelebrationProps {
  payload: YakuCelebrationPayload | null;
  onDone: () => void;
}

/**
 * Cut-in presentation when the player completes an iconic yaku.
 * Features authentic Ukiyo-e banners and honors prefers-reduced-motion.
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
    const ms = reduceMotion ? 900 : 1600;
    const id = window.setTimeout(() => {
      setVisible(false);
      onDone();
    }, ms);
    return () => window.clearTimeout(id);
  }, [payload, onDone, reduceMotion]);

  const hasBanner = payload?.yakuId && YAKU_BANNER_IDS.has(payload.yakuId);
  const bannerUrl = hasBanner ? `${import.meta.env.BASE_URL}textures/yaku/${payload.yakuId}.jpg` : null;

  return (
    <AnimatePresence>
      {visible && payload && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 top-[16%] z-[60] flex flex-col items-center justify-center px-4"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.9 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.95 }}
          transition={{ duration: reduceMotion ? 0.2 : 0.4, ease: 'easeOut' }}
          role="status"
          aria-live="polite"
        >
          {bannerUrl ? (
            <div className="relative max-w-lg w-full overflow-hidden rounded-2xl border-2 border-gold shadow-[0_10px_35px_rgba(0,0,0,0.8)] bg-stone-950">
              <img
                src={bannerUrl}
                alt={payload.names.join(' · ')}
                className="w-full h-auto object-cover block"
              />
              <div className="absolute top-2 left-3 bg-black/75 backdrop-blur-sm px-2.5 py-1 rounded-md border border-gold/60 text-xs font-bold text-gold flex items-center gap-1.5 shadow">
                <span>✦</span>
                <span>{payload.isNewUnlock ? '圖鑑新解鎖' : '役成'}</span>
              </div>
            </div>
          ) : (
            <div
              className={`yaku-celebrate-burst rounded-2xl border px-6 py-3.5 text-center shadow-2xl backdrop-blur-sm ${
                payload.isNewUnlock
                  ? 'border-gold bg-indigo-deep/95'
                  : 'border-vermillion-light/70 bg-indigo-deep/90'
              }`}
            >
              <p className="font-display text-lg sm:text-xl font-bold text-gold">
                {payload.isNewUnlock ? '圖鑑解鎖！' : '組成役！'}
              </p>
              <p className="text-sm text-cream/90 mt-1 font-medium">
                {payload.names.join(' · ')}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
