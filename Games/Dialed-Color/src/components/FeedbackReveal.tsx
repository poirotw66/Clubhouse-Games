import { motion } from 'motion/react';
import { distanceComponents, scoreBandLabel, scoreEmoji } from '../score.mjs';
import type { Color } from '../types';
import { ColorComparison } from './ColorComparison';
import { MatchParticles } from './MatchParticles';

function DiffBar({
  label,
  value,
  max,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const good = pct < 20;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--color-muted)]">{label}</span>
        <span className="font-mono tabular-nums">
          Δ{value}
          {unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full ${good ? 'bg-emerald-400' : pct < 45 ? 'bg-amber-400' : 'bg-rose-400'}`}
        />
      </div>
    </div>
  );
}

export function FeedbackReveal({
  target,
  guess,
  score,
  colorBlind,
  onContinue,
  continueLabel = '繼續',
}: {
  target: Color;
  guess: Color;
  score: number;
  colorBlind?: boolean;
  onContinue: () => void;
  continueLabel?: string;
}) {
  const d = distanceComponents(target, guess);
  const great = score >= 850;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="max-w-md w-full space-y-6 relative"
    >
      {great && <MatchParticles />}
      <div className="text-center space-y-2">
        <p className="kicker">回合回饋</p>
        <p className="brand-mark text-5xl tabular-nums">
          {scoreEmoji(score)} {score}
        </p>
        <p className="text-[var(--color-muted)] text-sm">{scoreBandLabel(score)}</p>
      </div>

      <div className="max-w-[14rem] mx-auto">
        <ColorComparison target={target} guess={guess} colorBlind={colorBlind} />
      </div>

      <div className="panel p-5 space-y-4 text-left">
        <p className="text-xs text-[var(--color-muted)] leading-relaxed">
          分數依 HSL 距離：色相（環狀）、飽和度、明度的歐氏距離越近越高。完全一致為 999。
        </p>
        <DiffBar label="色相差" value={Math.round(d.hueDeg)} max={180} unit="°" />
        <DiffBar label="飽和差" value={Math.round(d.satPct)} max={100} unit="%" />
        <DiffBar label="明度差" value={Math.round(d.lightPct)} max={100} unit="%" />
      </div>

      <button type="button" onClick={onContinue} className="btn-primary w-full">
        {continueLabel}
      </button>
    </motion.div>
  );
}
