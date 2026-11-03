import React, { useEffect, useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { TEAMS, formatMoney, grade, gradeColor, overall } from '../game/config';
import {
  playCameraShutter,
  playCrowdCheer,
  playDraftGavel,
} from '../game/baseballAudio';
import type { GameState, Position } from '../game/types';

interface DraftShowcaseProps {
  state: GameState;
  onDismiss: () => void;
}

const TEAM_THEMES: Record<
  string,
  { primary: string; secondary: string; badge: string; city: string }
> = {
  南方猛獅: { primary: '#ea580c', secondary: '#1c1917', badge: '🦁', city: '台南/南部' },
  桃園天使: { primary: '#0284c7', secondary: '#0f172a', badge: '👼', city: '桃園' },
  台中巨砲: { primary: '#dc2626', secondary: '#78350f', badge: '💥', city: '台中' },
  台南飛鷹: { primary: '#15803d', secondary: '#ca8a04', badge: '🦅', city: '台南' },
  新北海豚: { primary: '#0d9488', secondary: '#1e293b', badge: '🐬', city: '新北' },
  高雄火山: { primary: '#b91c1c', secondary: '#450a0a', badge: '🌋', city: '高雄' },
};

function getTeamTheme(name: string) {
  return TEAM_THEMES[name] ?? { primary: '#ca8a04', secondary: '#1e293b', badge: '⚾', city: '中職' };
}

export function DraftShowcase({ state, onDismiss }: DraftShowcaseProps): React.ReactElement {
  const [revealed, setRevealed] = useState(false);
  const [activeTab, setActiveTab] = useState<'card' | 'board'>('card');
  const [flashActive, setFlashActive] = useState(false);

  const isDrafted = state.pendingDraftRank !== null && state.pendingDraftRank > 0;
  const rank = state.pendingDraftRank ?? 0;
  const rating = overall(state.attrs, state.position);
  const theme = getTeamTheme(state.team);
  const income = state.report?.income ?? 0;

  // Trigger celebration sounds & camera flash when revealed
  const handleReveal = () => {
    setRevealed(true);
    setFlashActive(true);
    playDraftGavel();
    playCameraShutter();
    if (isDrafted) {
      playCrowdCheer(1.2);
    }
    window.setTimeout(() => setFlashActive(false), 350);
  };

  useEffect(() => {
    // Auto-reveal slightly for instant thrill, but provide interactive feel
    const timer = window.setTimeout(() => {
      handleReveal();
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  const rankLabel =
    rank === 1 && rating >= 75
      ? '第一輪 第 1 指名（選秀狀元）'
      : rank === 1
        ? '第一輪指名（首輪即戰力）'
        : rank === 2
          ? '第二輪指名（潛力新星）'
          : rank === 4
            ? '中段輪次指名'
            : rank === 9
              ? '育成選秀指名'
              : '本次選秀落選';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md transition-all duration-300"
      role="dialog"
      aria-modal="true"
      aria-label="選秀指名大會現場實況"
    >
      {/* Camera Flash Screen Overlay */}
      {flashActive && (
        <div className="pointer-events-none absolute inset-0 z-50 bg-white/75 transition-opacity duration-200" />
      )}

      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 shadow-2xl">
        {/* Top Broadcast Ticker Header */}
        <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-mono text-xs font-black tracking-widest text-amber-300">
              CPBL DRAFT LIVE · 年度新人球員選拔會
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('card')}
              className={`rounded px-2.5 py-1 text-xs font-bold transition ${
                activeTab === 'card'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              指名公布
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('board')}
              className={`rounded px-2.5 py-1 text-xs font-bold transition ${
                activeTab === 'board'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              六隊選秀榜
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {activeTab === 'card' ? (
            <div>
              {/* Draft Envelope & Announcement Card */}
              <div
                className="relative overflow-hidden rounded-2xl border p-6 text-center shadow-lg transition-all"
                style={{
                  borderColor: isDrafted ? theme.primary : '#64748b',
                  background: isDrafted
                    ? `radial-gradient(ellipse at top, ${theme.primary}25 0%, #090e17 80%)`
                    : 'rgba(30, 41, 59, 0.4)',
                }}
              >
                {/* Team Badge Glow */}
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-amber-400/50 bg-slate-900/90 text-4xl shadow-md">
                  {isDrafted ? theme.badge : '📋'}
                </div>

                <div className="mt-4">
                  <span
                    className="inline-block rounded-full px-3 py-1 font-mono text-xs font-black tracking-wider shadow-sm"
                    style={{
                      background: isDrafted ? theme.primary : '#475569',
                      color: '#ffffff',
                    }}
                  >
                    {isDrafted ? `${state.team} · ${rankLabel}` : '選秀結果公布'}
                  </span>
                </div>

                <h2 className="mt-3 text-3xl font-black text-slate-100 sm:text-4xl">
                  {state.name}
                  <span className="ml-2 text-lg font-bold text-amber-300">
                    {state.age} 歲 · {state.position}
                  </span>
                </h2>

                <p className="mt-2 text-sm text-slate-300">
                  {state.originLabel} 出身 · 綜合評價{' '}
                  <span className="font-mono font-bold" style={{ color: gradeColor(rating) }}>
                    {grade(rating)} ({rating.toFixed(0)})
                  </span>
                </p>

                {/* Draft Result Details Banner */}
                {isDrafted ? (
                  <div className="mt-6 rounded-xl border border-amber-500/30 bg-slate-900/70 p-4">
                    <div className="flex flex-wrap items-center justify-around gap-4 text-center">
                      <div>
                        <p className="text-[11px] text-slate-400">指名球團</p>
                        <p className="text-base font-bold text-amber-200">
                          {state.team} ({theme.city})
                        </p>
                      </div>
                      <div className="h-8 w-px bg-slate-700/60" />
                      <div>
                        <p className="text-[11px] text-slate-400">指名順位</p>
                        <p className="text-base font-bold text-sky-300">{rankLabel}</p>
                      </div>
                      {income > 0 && (
                        <>
                          <div className="h-8 w-px bg-slate-700/60" />
                          <div>
                            <p className="text-[11px] text-slate-400">簽約金</p>
                            <p className="font-mono text-base font-black text-emerald-300">
                              {formatMoney(income)}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="mt-4 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-300">
                      {state.report?.lines.map((line, idx) => (
                        <p key={idx} className="mt-1">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-left">
                    <h3 className="font-bold text-rose-300">名字未被唱名</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      從第一輪坐到最後一輪，舞台上的鎂光燈始終沒有落在你身上。
                      但這不是棒球路的終點——前往業餘社會人或大學隊伍持續鍛鍊，下一次選秀見真章！
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Six Teams Draft Matrix Board */
            <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <h3 className="text-sm font-bold text-amber-300">中華職棒各球團指名總覽</h3>
              <p className="mt-1 text-xs text-slate-400">
                本屆新人選拔會各輪次各球團名單
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TEAMS.cpbl.map((teamName) => {
                  const t = getTeamTheme(teamName);
                  const isPlayerTeam = state.team === teamName && isDrafted;
                  return (
                    <div
                      key={teamName}
                      className={`rounded-xl border p-3 transition ${
                        isPlayerTeam
                          ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-lg'
                          : 'border-slate-800 bg-slate-950/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{t.badge}</span>
                        <div>
                          <p className="text-xs font-bold text-slate-200">{teamName}</p>
                          <p className="text-[10px] text-slate-500">{t.city}</p>
                        </div>
                      </div>
                      <div className="mt-2 border-t border-slate-800/80 pt-1.5 text-[11px]">
                        {isPlayerTeam ? (
                          <p className="font-bold text-amber-300">
                            ★ {rankLabel.split('（')[0]}：{state.name}
                          </p>
                        ) : (
                          <p className="text-slate-400">第 1 輪指名完畢</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Action Controls */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReveal}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              📸 重溫現場鎂光燈
            </button>

            <TouchButton
              label={isDrafted ? '穿上球衣，展開職業球季！' : '收拾球具，前往下一個戰場！'}
              ariaLabel="繼續遊戲"
              onClick={onDismiss}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-sm font-black text-slate-950 shadow-lg hover:from-amber-400 hover:to-amber-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
