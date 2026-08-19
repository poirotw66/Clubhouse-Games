import React from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { CLUBS, EXPECTATIONS, formatMoney } from '../game/config';
import type { GameState } from '../game/types';
import { sceneBackgroundStyle } from '../sceneBackground';

interface Props {
  state: GameState;
  onRestart: () => void;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }): React.ReactElement {
  return (
    <div>
      <dt className="text-[10px] text-slate-500">{label}</dt>
      <dd className={`font-mono text-lg font-bold ${accent ? 'text-emerald-300' : 'text-slate-200'}`}>
        {value}
      </dd>
    </div>
  );
}

export function SummaryScreen({ state, onRestart }: Props): React.ReactElement {
  const summary = state.summary;
  if (!summary) return <p className="p-8 text-slate-300">任期資料遺失了。</p>;
  const club = CLUBS.find((c) => c.id === state.teamId);

  return (
    <div className="dy-title-shell min-h-screen" style={sceneBackgroundStyle()}>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-14">
      <header className="dy-title-hero mt-3 text-center">
        <p className="text-xs tracking-[0.3em] text-slate-500">TENURE OVER</p>
        <h1 className="mt-2 text-3xl font-black text-slate-100">
          {state.gmName}
          <span className="ml-2 text-base font-normal text-slate-400">{club?.name}</span>
        </h1>
        <p className="mt-3 text-2xl font-black text-emerald-300">{summary.verdict}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{summary.epitaph}</p>
        <p className="mt-3 text-xs text-slate-500">
          王朝分數 <span className="font-mono text-slate-300">{summary.score}</span>
        </p>
      </header>

      <section className="dy-card mt-6 p-4">
        <h2 className="text-sm font-bold text-slate-200">任期總計</h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center sm:grid-cols-5">
          <Stat label="在任球季" value={String(summary.seasonsServed)} />
          <Stat label="總冠軍" value={String(summary.titles)} accent />
          <Stat label="季後賽" value={String(summary.playoffs)} />
          <Stat label="自產球星" value={String(summary.homegrownStars)} />
          <Stat label="累積損益" value={formatMoney(summary.totalNet)} />
        </dl>
      </section>

      <section className="dy-card mt-4 p-4">
        <h2 className="text-sm font-bold text-slate-200">逐年紀錄</h2>
        <div className="dy-scroll-x mt-3">
          <table className="w-full min-w-[32rem] border-collapse text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-2 text-left font-medium">年度</th>
                <th className="px-2 py-2 font-medium">戰績</th>
                <th className="px-2 py-2 font-medium">名次</th>
                <th className="px-2 py-2 font-medium">季後賽</th>
                <th className="px-2 py-2 font-medium">期望</th>
                <th className="px-2 py-2 text-right font-medium">損益</th>
                <th className="px-2 py-2 font-medium">信任</th>
              </tr>
            </thead>
            <tbody>
              {state.history.map((record) => (
                <tr key={record.year} className="border-t border-slate-700/50">
                  <td className="px-2 py-1.5 text-left font-mono text-slate-300">{record.year}</td>
                  <td className="px-2 py-1.5 text-center font-mono text-slate-300">
                    {record.wins}-{record.losses}
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono text-slate-400">{record.finish}</td>
                  <td
                    className={`px-2 py-1.5 text-center ${
                      record.playoffResult === '總冠軍' ? 'font-bold text-amber-300' : 'text-slate-400'
                    }`}
                  >
                    {record.playoffResult}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={record.met ? 'text-emerald-300' : 'text-rose-300'}>
                      {EXPECTATIONS[record.expectation].label}
                      {record.met ? ' ✓' : ' ✗'}
                    </span>
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-mono ${
                      record.net >= 0 ? 'text-slate-300' : 'text-rose-300'
                    }`}
                  >
                    {formatMoney(record.net)}
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono text-slate-400">{record.trust}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dy-card mt-4 p-4">
        <h2 className="text-sm font-bold text-slate-200">分享這個聯盟</h2>
        <p className="mt-1 text-xs text-slate-400">
          種子碼 <span className="font-mono text-emerald-300">{state.seedCode}</span>
          ，朋友用同一組種子碼接手，會遇到一模一樣的聯盟、選秀梯隊與突發事件。
        </p>
      </section>

      <div className="mt-6">
        <TouchButton
          label="再接一次任期"
          ariaLabel="回到標題畫面重新開始"
          onClick={onRestart}
          className="w-full rounded-xl bg-emerald-500 px-4 text-base font-black text-slate-950"
        />
      </div>
      </div>
    </div>
  );
}
