import React, { useEffect } from 'react';

export type ScoreFlashTone = 'good' | 'bad' | 'neutral';

const TONE_CLASS: Record<ScoreFlashTone, string> = {
  good: 'text-cyan-200 drop-shadow-[0_0_18px_rgba(45,212,191,0.95)]',
  bad: 'text-rose-300 drop-shadow-[0_0_18px_rgba(251,113,133,0.9)]',
  neutral: 'text-amber-200 drop-shadow-[0_0_18px_rgba(251,191,36,0.9)]',
};

interface ScoreFlashProps {
  text: string;
  tone?: ScoreFlashTone;
  flashKey: number;
  onDone?: () => void;
}

export function ScoreFlash({
  text,
  tone = 'good',
  flashKey,
  onDone,
}: ScoreFlashProps): React.ReactElement | null {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone?.(), 900);
    return () => window.clearTimeout(timer);
  }, [flashKey, onDone]);

  return (
    <div
      key={flashKey}
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      aria-live="polite"
    >
      <span
        className={`font-black text-4xl sm:text-6xl tracking-tight animate-score-pop ${TONE_CLASS[tone]}`}
      >
        {text}
      </span>
      <style>{`
        @keyframes score-pop {
          0% { opacity: 0; transform: scale(0.6) translateY(12px); }
          20% { opacity: 1; transform: scale(1.08) translateY(0); }
          100% { opacity: 0; transform: scale(1) translateY(-28px); }
        }
        .animate-score-pop { animation: score-pop 0.9s ease-out forwards; }
      `}</style>
    </div>
  );
}
