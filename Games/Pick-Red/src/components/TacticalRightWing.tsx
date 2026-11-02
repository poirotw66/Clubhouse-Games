import React from 'react';
import type { MatchState } from '../game/types';
import type { GrandmasterWisdom, OpponentThreatProfile } from '../game/tactics';
import { isSeriesMode } from '../game/match';
import { HUMAN } from '../game/types';

interface Props {
  threats: OpponentThreatProfile[];
  wisdom: GrandmasterWisdom;
  match: MatchState | null;
  isMobileDrawer?: boolean;
}

const TAG_BADGES: Record<
  GrandmasterWisdom['tag'],
  { label: string; bg: string; text: string; border: string }
> = {
  alert: {
    label: '警訊',
    bg: 'bg-rose-950/80',
    text: 'text-rose-300',
    border: 'border-rose-500/50',
  },
  attack: {
    label: '搶分',
    bg: 'bg-amber-950/80',
    text: 'text-amber-300',
    border: 'border-amber-500/50',
  },
  defense: {
    label: '防守',
    bg: 'bg-emerald-950/80',
    text: 'text-emerald-300',
    border: 'border-emerald-500/50',
  },
  tactics: {
    label: '妙手',
    bg: 'bg-sky-950/80',
    text: 'text-sky-300',
    border: 'border-sky-500/50',
  },
};

export function TacticalRightWing({
  threats,
  wisdom,
  match,
  isMobileDrawer = false,
}: Props): React.ReactElement {
  const isSeries = match ? isSeriesMode(match.config.mode) : false;
  const tagInfo = TAG_BADGES[wisdom.tag];

  return (
    <aside
      className={`flex flex-col gap-3 text-slate-200 select-none ${
        isMobileDrawer
          ? 'w-full'
          : 'w-72 xl:w-80 shrink-0'
      }`}
      aria-label="右翼：對手檔案與大師錦囊"
    >
      {/* 撿紅點大師錦囊 */}
      <section className="rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-lg shadow-emerald-950/20">
        <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
          <div className="flex items-center gap-1.5">
            <span className="text-base" role="img" aria-label="錦囊">📜</span>
            <span className="text-xs font-black tracking-wide text-emerald-100">推弈大師錦囊</span>
          </div>
          <span
            className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${tagInfo.bg} ${tagInfo.border} ${tagInfo.text}`}
          >
            {tagInfo.label}
          </span>
        </div>

        <div className="mt-2.5">
          <h4 className="text-xs font-bold text-amber-300">{wisdom.title}</h4>
          <p className="mt-1 text-xs text-slate-300/90 leading-relaxed">
            {wisdom.blurb}
          </p>
        </div>
      </section>

      {/* 對手戰情檔案 Dossier */}
      <section className="rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-lg shadow-emerald-950/20">
        <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
          <div className="flex items-center gap-1.5">
            <span className="text-base" role="img" aria-label="檔案">🕵️‍♂️</span>
            <span className="text-xs font-black tracking-wide text-emerald-100">對手戰情檔案</span>
          </div>
          <span className="text-[10px] text-slate-400">進張威脅推論</span>
        </div>

        <div className="mt-2.5 flex flex-col gap-2">
          {threats.map((opp) => {
            const chips = match?.balances[opp.seat] ?? 0;
            return (
              <div
                key={opp.seat}
                className="rounded-xl border border-slate-800 bg-slate-800/40 p-2.5 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-emerald-100">{opp.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {opp.personalityName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {opp.threatLevel === 'high' ? (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-950 border border-rose-500/60 text-rose-300 animate-pulse">
                        大分警戒
                      </span>
                    ) : opp.threatLevel === 'medium' ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500/40 text-amber-300">
                        盯防中
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                        平穩
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-1">
                  <span>累積分數：<b className="text-slate-200 tabular-nums">{opp.currentScore}</b> 分</span>
                  {isSeries && (
                    <span>
                      籌碼：
                      <b
                        className={`tabular-nums ${
                          chips >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {chips >= 0 ? `+${chips}` : chips}
                      </b>
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-slate-300/80 leading-relaxed bg-slate-900/60 rounded-lg p-1.5 border border-slate-800/40">
                  {opp.threatDeduction}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 系列賽動能 */}
      {isSeries && match && (
        <section className="rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-lg shadow-emerald-950/20">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
            <div className="flex items-center gap-1.5">
              <span className="text-base" role="img" aria-label="動能">📈</span>
              <span className="text-xs font-black tracking-wide text-emerald-100">系列賽動能</span>
            </div>
            <span className="text-[10px] text-slate-400">第 {match.handIndex + 1} 局</span>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 text-[11px] block">你目前籌碼</span>
              <span
                className={`text-xl font-black tabular-nums ${
                  match.balances[HUMAN] >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {match.balances[HUMAN] >= 0
                  ? `+${match.balances[HUMAN]}`
                  : match.balances[HUMAN]}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[11px] block">領先優勢</span>
              <span className="text-sm font-bold text-amber-300 tabular-nums">
                {match.balances[HUMAN] - Math.max(...match.balances.slice(1)) >= 0
                  ? `領先 ${match.balances[HUMAN] - Math.max(...match.balances.slice(1))} 籌碼`
                  : `落後 ${Math.abs(match.balances[HUMAN] - Math.max(...match.balances.slice(1)))} 籌碼`}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 實體鍵盤導航指示面板 */}
      <section className="rounded-2xl border border-emerald-500/20 bg-slate-900/60 p-3 text-slate-300 text-xs">
        <div className="flex items-center gap-1.5 mb-2 font-bold text-emerald-300/90">
          <span>⌨️ 鍵盤快速選牌</span>
        </div>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[10px] text-slate-400">
          <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">A</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">D</kbd> 切換手牌</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">Space</kbd> 彈起出牌</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">1</kbd>～<kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">4</kbd> 指定吃目標</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">H</kbd> 大師提示</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">Z</kbd> 復原一步</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">Esc</kbd> 取消選取</div>
        </div>
      </section>
    </aside>
  );
}
