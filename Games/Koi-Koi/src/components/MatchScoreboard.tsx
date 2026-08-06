import React from 'react';
import {WIN_SCORE} from '../utils/gameLogic';

interface ScoreBarProps {
  label: string;
  score: number;
  accent: 'gold' | 'vermillion';
}

const ScoreBar: React.FC<ScoreBarProps> = ({label, score, accent}) => {
  const pct = Math.min(100, (score / WIN_SCORE) * 100);
  const barClass = accent === 'gold' ? 'bg-gold' : 'bg-vermillion-light';

  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-cream/60 mb-1">
        <span>{label}</span>
        <span>{score} / {WIN_SCORE}</span>
      </div>
      <div className="h-1.5 rounded-full bg-indigo-deep/80 overflow-hidden border border-gold/20">
        <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{width: `${pct}%`}} />
      </div>
    </div>
  );
};

interface MatchScoreboardProps {
  playerLabel: string;
  botLabel: string;
  playerScore: number;
  botScore: number;
  wins?: number;
  losses?: number;
  winStreak?: number;
}

export const MatchScoreboard: React.FC<MatchScoreboardProps> = ({
  playerLabel,
  botLabel,
  playerScore,
  botScore,
  wins,
  losses,
  winStreak,
}) => (
  <div className="flex flex-col gap-2 w-full max-w-xs">
    <div className="grid grid-cols-2 gap-4 w-full">
      <ScoreBar label={botLabel} score={botScore} accent="gold" />
      <ScoreBar label={playerLabel} score={playerScore} accent="vermillion" />
    </div>
    {wins !== undefined && losses !== undefined && (
      <p className="text-[10px] text-cream/50 text-center tracking-wide">
        戰績 {wins}勝 {losses}敗
        {winStreak !== undefined && winStreak > 0 ? ` · 連勝 ${winStreak}` : ''}
      </p>
    )}
  </div>
);
