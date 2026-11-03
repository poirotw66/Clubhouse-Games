import React, { useState } from 'react';
import { CLUBS, formatMoney, grade, gradeColor } from '../game/config';
import { humanTeam } from '../game/engine';
import { ability } from '../game/players';
import { standings } from '../game/season';
import type { GameState } from '../game/types';
import { calculateLiveDynastyScore, getRosterStructure } from '../game/warRoomStats';

interface Props {
  state: GameState;
  className?: string;
}

export function GMDossier({ state, className = '' }: Props): React.ReactElement {
  const [showFullLog, setShowFullLog] = useState(false);
  const team = humanTeam(state);
  const club = CLUBS.find((c) => c.id === state.teamId);
  const dynastyRank = calculateLiveDynastyScore(state);
  const rosterStructure = getRosterStructure(team);
  const leagueStandings = standings(state.teams);

  // Career win/loss stats across past seasons + current season
  const pastWins = state.history.reduce((sum, h) => sum + h.wins, 0);
  const pastLosses = state.history.reduce((sum, h) => sum + h.losses, 0);
  const totalWins = pastWins + team.wins;
  const totalLosses = pastLosses + team.losses;
  const totalGames = totalWins + totalLosses;
  const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;

  const titles = state.history.filter((h) => h.playoffResult === '總冠軍').length;
  const playoffs = state.history.filter((h) => h.playoffResult !== '未晉級').length;

  return (
    <aside className={`flex flex-col gap-4 ${className}`} aria-label="總管大師檔案與情報監控">
      {/* 1. 總管大師檔案與即時王朝分數 */}
      <section className="dy-card p-4 border border-sky-500/25 shadow-lg bg-slate-900/85">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-sky-400" />
            <h2 className="text-xs font-black tracking-wider uppercase text-sky-300">
              總管大師檔案 (GM Dossier)
            </h2>
          </div>
          <span className="font-mono text-[11px] font-bold text-slate-400">{club?.name}</span>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-100">{state.gmName}</h3>
            <p className="text-[11px] text-slate-400">
              生涯戰績 <span className="font-mono font-bold text-slate-200">{totalWins}勝 {totalLosses}敗</span>
              <span className="ml-1 text-sky-300 font-mono">({winRate.toFixed(1)}%)</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 block">即時王朝評級</span>
            <span
              className="text-sm font-black tracking-wide"
              style={{ color: dynastyRank.badgeColor }}
            >
              {dynastyRank.verdict}
            </span>
          </div>
        </div>

        {/* Live Dynasty Score Metric Bar */}
        <div className="mt-3 rounded-lg bg-slate-950/70 p-2.5 border border-slate-800">
          <div className="flex justify-between items-baseline text-xs">
            <span className="text-slate-400">目前累積王朝分數</span>
            <span className="font-mono text-base font-extrabold text-amber-300">
              {dynastyRank.score} 分
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${dynastyRank.progressPercent}%`,
                background: dynastyRank.badgeColor,
              }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400 font-mono text-right">
            {dynastyRank.nextThreshold
              ? `距離下個評級「${
                  dynastyRank.nextThreshold === 2800
                    ? '王朝締造者'
                    : dynastyRank.nextThreshold === 1900
                    ? '名總管'
                    : dynastyRank.nextThreshold === 1100
                    ? '稱職經營者'
                    : '平淡十年'
                }」還差 ${dynastyRank.pointsToNext} 分`
              : '🌟 已奠定至高榮耀・名垂青史！'}
          </p>
        </div>

        {/* Trophy & Honors Grid */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-xs">
          <div className="rounded-lg bg-slate-950/50 p-2 border border-slate-800/80">
            <span className="text-sm">🏆</span>
            <p className="text-[10px] text-slate-500 mt-0.5">總冠軍</p>
            <p className="font-mono font-bold text-amber-300 text-sm mt-0.5">{titles} 座</p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-2 border border-slate-800/80">
            <span className="text-sm">🎖️</span>
            <p className="text-[10px] text-slate-500 mt-0.5">季後賽</p>
            <p className="font-mono font-bold text-sky-300 text-sm mt-0.5">{playoffs} 次</p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-2 border border-slate-800/80">
            <span className="text-sm">🌟</span>
            <p className="text-[10px] text-slate-500 mt-0.5">自產頂級球星</p>
            <p className="font-mono font-bold text-emerald-300 text-sm mt-0.5">
              {team.players.filter((p) => p.homegrown && ability(p) >= 70).length} 人
            </p>
          </div>
        </div>
      </section>

      {/* 2. 陣容年齡結構與合約到期雷達 */}
      <section className="dy-card p-4 border border-slate-700/70 bg-slate-900/85">
        <div className="flex items-baseline justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">👥</span>
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-200">
              陣容年齡與合約雷達
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-400">一軍 26 人主力</span>
        </div>

        {/* Age Demographics */}
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          <div className="rounded-lg bg-slate-950/60 p-1.5 border border-slate-800">
            <p className="text-[9px] text-slate-500">新秀核心 (≤23)</p>
            <p className="font-mono text-xs font-bold text-emerald-300 mt-0.5">
              {rosterStructure.youngCore.length} 人
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/60 p-1.5 border border-slate-800">
            <p className="text-[9px] text-slate-500">黃金巔峰 (24–28)</p>
            <p className="font-mono text-xs font-bold text-sky-300 mt-0.5">
              {rosterStructure.primeVeterans.length} 人
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/60 p-1.5 border border-slate-800">
            <p className="text-[9px] text-slate-500">成熟中堅 (29–31)</p>
            <p className="font-mono text-xs font-bold text-amber-300 mt-0.5">
              {rosterStructure.experienced.length} 人
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/60 p-1.5 border border-slate-800">
            <p className="text-[9px] text-slate-500">老將風險 (≥32)</p>
            <p className="font-mono text-xs font-bold text-rose-400 mt-0.5">
              {rosterStructure.agingRisk.length} 人
            </p>
          </div>
        </div>

        {/* Contract Expiration Alert */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-500 font-semibold tracking-wider">
              合約到期潮預警（剩餘 1 年）
            </p>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-bold ${
                rosterStructure.expiringContracts.length > 4
                  ? 'bg-rose-950 text-rose-300'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {rosterStructure.expiringContracts.length} 人即將約滿
            </span>
          </div>

          <div className="mt-1.5 space-y-1">
            {rosterStructure.expiringContracts.slice(0, 3).map((p) => {
              const val = ability(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded bg-slate-950/40 px-2 py-1 text-xs border border-slate-800/60"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">{p.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{p.age}歲</span>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: gradeColor(val) }}
                    >
                      {grade(val)}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-amber-300">
                    年薪 {formatMoney(p.salary)}
                  </div>
                </div>
              );
            })}
            {rosterStructure.expiringContracts.length === 0 && (
              <p className="text-xs text-slate-600">本季主力合約穩固，無即刻到期風險。</p>
            )}
          </div>
        </div>
      </section>

      {/* 3. 聯盟各隊戰績即時態勢 */}
      <section className="dy-card p-4 border border-slate-700/70 bg-slate-900/85">
        <div className="flex items-baseline justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🏆</span>
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-200">
              聯盟即時戰績態勢
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-400">CPBL 六隊競逐</span>
        </div>

        <ol className="mt-3 space-y-1.5">
          {leagueStandings.map((t, index) => {
            const isMe = t.id === state.teamId;
            const played = t.wins + t.losses;
            const pct = played > 0 ? (t.wins / played).toFixed(3).replace('0.', '.') : '.000';

            return (
              <li
                key={t.id}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1 text-xs transition-colors ${
                  isMe
                    ? 'border border-emerald-400/50 bg-emerald-950/40 font-bold text-emerald-200'
                    : 'bg-slate-950/40 text-slate-400 border border-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded font-mono text-[10px] font-bold ${
                      index === 0
                        ? 'bg-amber-400 text-slate-950'
                        : index < 4
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className={isMe ? 'text-slate-100' : 'text-slate-300'}>{t.name}</span>
                  {isMe && (
                    <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] text-emerald-300">
                      我隊
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span>
                    {t.wins}勝 {t.losses}敗
                  </span>
                  <span className="text-slate-500">{pct}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 4. 營運情報日誌流 */}
      <section className="dy-card p-4 border border-slate-700/70 bg-slate-900/85">
        <div className="flex items-baseline justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">📜</span>
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-200">
              營運決策情報日誌
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowFullLog((v) => !v)}
            className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold"
          >
            {showFullLog ? '收合' : '完整回顧'}
          </button>
        </div>

        <ol
          className={`mt-2 space-y-2 overflow-y-auto pr-1 transition-all ${
            showFullLog ? 'max-h-80' : 'max-h-40'
          }`}
        >
          {[...state.log].reverse().slice(0, showFullLog ? 50 : 6).map((entry) => (
            <li key={entry.id} className="border-l-2 border-slate-700 pl-2.5">
              <p className="text-[9px] tracking-wider text-slate-500 font-mono">{entry.label}</p>
              <p
                className={`text-[11px] leading-relaxed mt-0.5 ${
                  entry.tone === 'great'
                    ? 'text-emerald-300 font-semibold'
                    : entry.tone === 'good'
                    ? 'text-emerald-400/90'
                    : entry.tone === 'bad'
                    ? 'text-rose-300 font-semibold'
                    : 'text-slate-300'
                }`}
              >
                {entry.text}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
