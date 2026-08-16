import React, { useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import {
  ATTR_LABELS,
  POSITIONS,
  attrsForPosition,
  formatMoney,
  grade,
  gradeColor,
} from '../game/config';
import type { Achievement } from '../game/achievements';
import { pitchInfo } from '../game/pitches';
import { traitById } from '../game/traits';
import type { GameState } from '../game/types';
import { CareerTable } from './CareerTable';
import { ShareCard } from './ShareCard';

interface Props {
  state: GameState;
  unlocked: Achievement[];
  onRestart: () => void;
  onSameSeed: () => void;
}

export function SummaryScreen({ state, unlocked, onRestart, onSameSeed }: Props): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const summary = state.summary;
  if (!summary) return <p className="p-8 text-slate-300">生涯資料遺失了。</p>;

  const isTwoWay = state.position === 'TW';
  const isPitcher = state.position === 'P';
  const positionLabel = POSITIONS.find((p) => p.id === state.position)?.label ?? '';
  const shareUrl = `${window.location.origin}${window.location.pathname}?seed=${encodeURIComponent(state.seedCode)}`;

  const copyShare = () => {
    const text = `${state.name}（${positionLabel}）｜${summary.verdict}｜種子碼 ${state.seedCode}\n${shareUrl}`;
    // clipboard is unavailable over plain http and in some in-app browsers, so
    // the seed stays visible on screen as the fallback.
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false),
    );
  };

  const totals = summary.totals;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-14">
      <header className="mt-3 text-center">
        <p className="text-xs tracking-[0.3em] text-slate-500">CAREER OVER</p>
        <h1 className="mt-2 text-3xl font-black text-slate-100">
          {state.name}
          <span className="ml-2 text-base font-normal text-slate-400">{positionLabel}</span>
        </h1>
        <p className="mt-3 text-2xl font-black text-amber-300">{summary.verdict}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{summary.epitaph}</p>
        <p className="mt-3 text-xs text-slate-500">
          名人堂積分 <span className="font-mono text-slate-300">{summary.hofScore}</span>
        </p>
      </header>

      <section className="bl-card mt-6 p-4">
        <h2 className="text-sm font-bold text-slate-200">生涯通算（職業以上）</h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
          <Stat label="球季" value={String(totals.seasons)} />
          <Stat label="出賽" value={String(totals.games)} />
          {isTwoWay ? (
            <>
              <Stat label="安打" value={String(totals.hits)} />
              <Stat label="全壘打" value={String(totals.hr)} />
              <Stat label="打率" value={totals.avg.toFixed(3).replace(/^0/, '')} accent />
              <Stat label="勝-敗" value={`${totals.wins}-${totals.losses}`} />
              <Stat label="奪三振" value={String(totals.so)} />
              <Stat label="防禦率" value={totals.era.toFixed(2)} accent />
            </>
          ) : isPitcher ? (
            <>
              <Stat label="勝" value={String(totals.wins)} />
              <Stat label="敗" value={String(totals.losses)} />
              <Stat label="奪三振" value={String(totals.so)} />
              <Stat label="防禦率" value={totals.era.toFixed(2)} accent />
            </>
          ) : (
            <>
              <Stat label="安打" value={String(totals.hits)} />
              <Stat label="全壘打" value={String(totals.hr)} />
              <Stat label="打點" value={String(totals.rbi)} />
              <Stat label="打率" value={totals.avg.toFixed(3).replace(/^0/, '')} accent />
            </>
          )}
        </dl>
      </section>

      {unlocked.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-4">
          <h2 className="text-sm font-bold text-amber-200">
            解鎖成就
            <span className="ml-2 font-mono text-xs font-normal text-amber-300/70">
              +{unlocked.length}
            </span>
          </h2>
          <ul className="mt-3 space-y-2">
            {unlocked.map((achievement) => (
              <li key={achievement.id} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="text-lg leading-none">
                  🏅
                </span>
                <div>
                  <p className="text-sm font-bold text-amber-100">{achievement.label}</p>
                  <p className="text-xs text-amber-200/75">{achievement.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bl-card mt-4 p-4">
        <h2 className="text-sm font-bold text-slate-200">收入</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-center">
          <Stat label="生涯總收入" value={formatMoney(summary.earnings)} accent />
          <Stat label="生涯最高年薪" value={formatMoney(summary.peakSalary)} />
        </dl>
      </section>

      {state.milestones.length > 0 && (
        <section className="bl-card mt-4 p-4">
          <h2 className="text-sm font-bold text-slate-200">
            生涯紀錄
            <span className="ml-2 text-xs font-normal text-slate-500">{state.milestones.length} 項</span>
          </h2>
          <ul className="mt-2 space-y-1.5">
            {state.milestones.map((milestone, index) => (
              <li key={index} className="flex items-baseline gap-2 text-xs">
                <span className="shrink-0 font-mono text-slate-500">
                  {milestone.year}・{milestone.age}歲
                </span>
                <span className={milestone.kind === 'feat' ? 'text-sky-200' : 'text-slate-300'}>
                  {milestone.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.awardCounts.length > 0 && (
        <section className="bl-card mt-4 p-4">
          <h2 className="text-sm font-bold text-slate-200">獎項</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {summary.awardCounts.map((award) => (
              <li
                key={award.name}
                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200"
              >
                {award.name}
                {award.count > 1 && <span className="ml-1 font-mono">×{award.count}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bl-card mt-4 p-4">
        <h2 className="text-sm font-bold text-slate-200">隱藏特質</h2>
        {state.traits.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">這一生沒有覺醒任何特質。換個走法也許就不一樣。</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {state.traits.map((id) => {
              const trait = traitById(id);
              if (!trait) return null;
              return (
                <li key={id} className="text-xs">
                  <span className="font-bold text-amber-200">{trait.label}</span>
                  <span className="mt-0.5 block text-slate-400">{trait.desc}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="bl-card mt-4 p-4">
        <h2 className="text-sm font-bold text-slate-200">最終能力</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {attrsForPosition(state.position).map((key) => (
            <span key={key} className="rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300">
              {ATTR_LABELS[key]}
              <span className="ml-1.5 font-bold" style={{ color: gradeColor(state.attrs[key]) }}>
                {grade(state.attrs[key])}
              </span>
            </span>
          ))}
        </div>
        {state.arsenal.length > 0 && (
          <div className="mt-3 border-t border-slate-700/60 pt-3">
            <p className="text-[10px] tracking-wider text-slate-500">最終球種</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[...state.arsenal]
                .sort((a, b) => b.level - a.level)
                .map((slot) => (
                  <span
                    key={slot.id}
                    className="rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300"
                  >
                    {pitchInfo(slot.id).label}
                    <span className="ml-1.5 font-bold" style={{ color: gradeColor(slot.level) }}>
                      {grade(slot.level)}
                    </span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </section>

      <section className="bl-card mt-4 p-4">
        <h2 className="text-sm font-bold text-slate-200">逐年成績</h2>
        <div className="mt-3">
          <CareerTable history={state.history} />
        </div>
      </section>

      <ShareCard state={state} />

      <section className="bl-card mt-4 p-4">
        <h2 className="text-sm font-bold text-slate-200">分享這個世界</h2>
        <p className="mt-1 text-xs text-slate-400">
          種子碼 <span className="font-mono text-amber-300">{state.seedCode}</span>
          ，朋友用同一組種子碼開局，會遇到一模一樣的出身牌與骰運。
        </p>
        <TouchButton
          label={copied ? '已複製' : '複製種子碼與連結'}
          ariaLabel="複製種子碼與連結"
          onClick={copyShare}
          className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-800 px-4 text-sm font-bold text-slate-100"
        />
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <TouchButton
          label="用同一組種子碼重來"
          ariaLabel="用同一組種子碼重新開始"
          onClick={onSameSeed}
          className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 text-sm font-bold text-slate-100"
        />
        <TouchButton
          label="開始新的人生"
          ariaLabel="回到標題畫面開始新的人生"
          onClick={onRestart}
          className="flex-1 rounded-xl bg-amber-500 px-4 text-base font-black text-slate-950"
        />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }): React.ReactElement {
  return (
    <div>
      <dt className="text-[10px] text-slate-500">{label}</dt>
      <dd className={`font-mono text-lg font-bold ${accent ? 'text-amber-300' : 'text-slate-200'}`}>{value}</dd>
    </div>
  );
}
