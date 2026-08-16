import React from 'react';
import { LEAGUES } from '../game/config';
import type { SeasonRecord } from '../game/types';

function avgText(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}

export function CareerTable({ history }: { history: SeasonRecord[] }): React.ReactElement {
  if (history.length === 0) {
    return <p className="px-1 py-3 text-xs text-slate-500">還沒有任何出賽紀錄。</p>;
  }

  // A two-way player has two records to show, so the table is rendered twice —
  // one pass per half — rather than trying to cram ten columns into one row.
  if (history.some((r) => r.secondary)) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="mb-1.5 text-xs font-bold text-slate-400">打擊成績</h3>
          <RoleTable history={history.map((r) => ({ ...r, secondary: undefined }))} />
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-bold text-slate-400">投球成績</h3>
          <RoleTable
            history={history
              .filter((r) => r.secondary)
              .map((r) => ({ ...r, line: r.secondary!, secondary: undefined, awards: [] }))}
          />
        </div>
      </div>
    );
  }

  return <RoleTable history={history} />;
}

function RoleTable({ history }: { history: SeasonRecord[] }): React.ReactElement {
  if (history.length === 0) {
    return <p className="px-1 py-3 text-xs text-slate-500">還沒有任何出賽紀錄。</p>;
  }

  // Within one table every row is the same kind, so one look picks the columns.
  const pitching = history[0].line.kind === 'pitcher';

  return (
    <div className="bl-scroll-x">
      <table className="w-full min-w-[34rem] border-collapse text-right text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500">
            <th className="px-2 py-2 text-left font-medium">年度</th>
            <th className="px-2 py-2 text-left font-medium">球隊</th>
            {pitching ? (
              <>
                <th className="px-2 py-2 font-medium">出賽</th>
                <th className="px-2 py-2 font-medium">局數</th>
                <th className="px-2 py-2 font-medium">勝敗</th>
                <th className="px-2 py-2 font-medium">救援</th>
                <th className="px-2 py-2 font-medium">奪三振</th>
                <th className="px-2 py-2 font-medium">防禦率</th>
              </>
            ) : (
              <>
                <th className="px-2 py-2 font-medium">出賽</th>
                <th className="px-2 py-2 font-medium">打數</th>
                <th className="px-2 py-2 font-medium">安打</th>
                <th className="px-2 py-2 font-medium">全壘打</th>
                <th className="px-2 py-2 font-medium">打點</th>
                <th className="px-2 py-2 font-medium">打率</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {history.map((record, index) => (
            <tr key={`${record.year}-${index}`} className="border-t border-slate-700/50">
              <td className="whitespace-nowrap px-2 py-1.5 text-left text-slate-300">
                {record.year}
                <span className="ml-1 text-[10px] text-slate-500">{record.age}歲</span>
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-left text-slate-400">
                <span className="text-[10px] text-slate-500">{LEAGUES[record.league].short}</span>{' '}
                {record.team}
                {record.awards.length > 0 && (
                  <span className="ml-1 text-[10px] text-amber-300">{record.awards.join('・')}</span>
                )}
              </td>
              {record.line.kind === 'pitcher' ? (
                <>
                  <td className="px-2 py-1.5 font-mono text-slate-300">{record.line.games}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-300">{record.line.ip.toFixed(1)}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-300">
                    {record.line.wins}-{record.line.losses}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-slate-300">{record.line.saves}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-300">{record.line.so}</td>
                  <td className="px-2 py-1.5 font-mono text-amber-200">{record.line.era.toFixed(2)}</td>
                </>
              ) : (
                <>
                  <td className="px-2 py-1.5 font-mono text-slate-300">{record.line.games}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-300">{record.line.ab}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-300">{record.line.hits}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-300">{record.line.hr}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-300">{record.line.rbi}</td>
                  <td className="px-2 py-1.5 font-mono text-amber-200">{avgText(record.line.avg)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
