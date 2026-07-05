import React from 'react';
import { GameStats, CounterResult } from '../types';
import { RotateCcw, Award } from 'lucide-react';
import { COLOR_PERFECT, COLOR_GOOD, COLOR_FAIL } from '../constants';

interface ResultsProps {
  stats: GameStats;
  onRestart: () => void;
}

const Results: React.FC<ResultsProps> = ({ stats, onRestart }) => {
  const data = [
    { name: 'Early', count: stats.history.filter((h) => h.timing < -350).length, color: COLOR_FAIL },
    { name: 'Good', count: stats.history.filter((h) => h.result === CounterResult.GOOD).length, color: COLOR_GOOD },
    { name: 'Perfect', count: stats.history.filter((h) => h.result === CounterResult.PERFECT).length, color: COLOR_PERFECT },
    {
      name: 'Late/Miss',
      count: stats.history.filter((h) => h.result === CounterResult.LATE || h.result === CounterResult.MISS).length,
      color: COLOR_FAIL,
    },
  ];
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
        <div className="bg-slate-950 p-6 text-center border-b border-slate-700">
          <h2 className="text-3xl font-display font-bold text-white mb-2 tracking-widest">TRAINING COMPLETE</h2>
          <div className="flex justify-center gap-8 mt-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase">Total Score</p>
              <p className="text-4xl font-display font-black text-emerald-400">{stats.score.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase">Max Chain</p>
              <p className="text-4xl font-display font-black text-amber-400">{stats.maxCombo}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
            <Award size={16} /> Reaction Analysis
          </h3>
          <div className="h-48 w-full bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 flex items-end justify-around gap-3">
            {data.map((entry) => (
              <div key={entry.name} className="flex flex-col items-center flex-1 h-full justify-end">
                <span className="text-sm font-bold text-slate-200 mb-1">{entry.count}</span>
                <div
                  className="w-full max-w-14 rounded-t transition-all"
                  style={{
                    height: `${(entry.count / maxCount) * 100}%`,
                    backgroundColor: entry.color,
                    minHeight: entry.count > 0 ? '8px' : '0',
                  }}
                />
                <span className="text-xs text-slate-400 mt-2 text-center">{entry.name}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-500 mt-2">
            Perfect Window: ±150ms | Good Window: ±350ms
          </p>
        </div>

        <div className="bg-slate-900 p-6 flex justify-center gap-4">
          <button
            onClick={onRestart}
            className="flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all hover:scale-105 shadow-lg shadow-emerald-900/20"
          >
            <RotateCcw size={20} /> TRY AGAIN
          </button>
        </div>
      </div>
    </div>
  );
};

export default Results;
