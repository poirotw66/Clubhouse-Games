import React, { useState } from 'react';
import { POSITION_LABELS, formatMoney, grade, gradeColor } from '../game/config';
import { ability } from '../game/players';
import type { Player, Team } from '../game/types';

function PlayerRow({ player, showBand }: { player: Player; showBand: boolean }): React.ReactElement {
  const value = ability(player);
  return (
    <tr className="border-t border-slate-700/50">
      <td className="whitespace-nowrap px-2 py-1.5 text-left text-slate-200">{player.name}</td>
      <td className="px-2 py-1.5 text-center text-[10px] text-slate-400">
        {POSITION_LABELS[player.position]}
      </td>
      <td className="px-2 py-1.5 text-center font-mono text-slate-300">{player.age}</td>
      <td className="px-2 py-1.5 text-center">
        <span className="font-bold" style={{ color: gradeColor(value) }}>
          {grade(value)}
        </span>
        <span className="ml-1 font-mono text-[10px] text-slate-500">{Math.round(value)}</span>
      </td>
      {showBand && (
        <td className="px-2 py-1.5 text-center font-mono text-[10px] text-sky-300">
          {player.band.low}–{player.band.high}
        </td>
      )}
      <td className="px-2 py-1.5 text-right font-mono text-slate-300">{formatMoney(player.salary)}</td>
      <td className="px-2 py-1.5 text-center font-mono text-[10px] text-slate-500">{player.years}</td>
    </tr>
  );
}

function Table({ players, showBand }: { players: Player[]; showBand: boolean }): React.ReactElement {
  if (players.length === 0) {
    return <p className="px-1 py-3 text-xs text-slate-500">目前沒有球員。</p>;
  }
  return (
    <div className="dy-scroll-x">
      <table className="w-full min-w-[30rem] border-collapse text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500">
            <th className="px-2 py-2 text-left font-medium">姓名</th>
            <th className="px-2 py-2 font-medium">位置</th>
            <th className="px-2 py-2 font-medium">年齡</th>
            <th className="px-2 py-2 font-medium">能力</th>
            {showBand && <th className="px-2 py-2 font-medium">潛力評估</th>}
            <th className="px-2 py-2 text-right font-medium">年薪</th>
            <th className="px-2 py-2 font-medium">年限</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <PlayerRow key={player.id} player={player} showBand={showBand} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RosterPanel({ team }: { team: Team }): React.ReactElement {
  const [tab, setTab] = useState<'major' | 'farm'>('major');
  const sorted = (level: 'major' | 'farm') =>
    team.players.filter((p) => p.level === level).sort((a, b) => ability(b) - ability(a));

  const majors = sorted('major');
  const farmhands = sorted('farm');

  return (
    <div>
      <div className="flex gap-2">
        {(['major', 'farm'] as const).map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setTab(level)}
            aria-pressed={tab === level}
            className={`min-h-11 flex-1 rounded-lg px-3 text-xs font-bold ${
              tab === level ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {level === 'major' ? `一軍 ${majors.length}` : `二軍 ${farmhands.length}`}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {/* Only prospects carry a meaningful scouting band; a 31-year-old's
            ceiling is not a mystery worth a column. */}
        <Table players={tab === 'major' ? majors : farmhands} showBand={tab === 'farm'} />
      </div>
    </div>
  );
}
