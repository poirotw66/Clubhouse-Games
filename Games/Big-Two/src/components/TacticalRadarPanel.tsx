import React from 'react';
import { SUIT_SYMBOL } from '../game/cards';
import type { TacticalRadar } from '../game/tactics';
import type { Suit } from '../game/types';

interface Props {
  radar: TacticalRadar;
  seatLabel: (seat: number) => string;
  className?: string;
}

const SUIT_NAMES: Record<Suit, string> = {
  spades: '黑桃 2',
  hearts: '紅心 2',
  diamonds: '方塊 2',
  clubs: '梅花 2',
};

export function TacticalRadarPanel({
  radar,
  seatLabel,
  className = '',
}: Props): React.ReactElement {
  const {
    deuces,
    spadesTwoStatus,
    unseenDeuceCount,
    lowestCardStatus,
    monsterThreat,
    isNextSeatCritical,
    criticalSeats,
    humanTurns,
    strategyLabel,
  } = radar;

  return (
    <aside
      aria-label="戰情情報雷達"
      className={`rounded-2xl border border-indigo-500/25 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-xl flex flex-col gap-3 text-xs ${className}`}
    >
      <header className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
        <div className="flex items-center gap-1.5 font-black text-indigo-200">
          <span className="text-sm">⚡</span>
          <span className="tracking-wide">戰情情資雷達</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-400/30">
          {strategyLabel}
        </span>
      </header>

      {/* Spades 2 Supreme King Tracker */}
      <section className="rounded-xl border border-amber-400/35 bg-gradient-to-r from-amber-500/15 via-slate-900/40 to-amber-500/5 p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-amber-200">
            <span className="text-base text-amber-300">♠</span>
            <span>黑桃 2 至尊動態</span>
          </div>
          {spadesTwoStatus.status === 'inHand' && (
            <span className="text-[10px] font-black text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-400/40">
              👑 我方掌控
            </span>
          )}
          {spadesTwoStatus.status === 'played' && (
            <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
              ⚪ {seatLabel(spadesTwoStatus.playedBy ?? 0)} 已出
            </span>
          )}
          {spadesTwoStatus.status === 'unseen' && (
            <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/40 animate-pulse">
              ⚠️ 潛伏未出
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-indigo-100/60 leading-tight">
          {spadesTwoStatus.status === 'inHand'
            ? '握有全副牌最大王牌，擁有絕對奪回領出權。'
            : spadesTwoStatus.status === 'played'
              ? '至尊牌已打出，紅心 2 與方塊 2 晉升為當前最高威懾。'
              : '王牌仍在對手手中，隨時可能發動截斷攔截。'}
        </p>
      </section>

      {/* 4 Deuces Grid */}
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-indigo-200/70 font-semibold">
          <span>四張老二分佈</span>
          <span className="text-indigo-300/80">未現身 {unseenDeuceCount} 張</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {deuces.map((d) => {
            const isSpades = d.suit === 'spades';
            const isRed = d.suit === 'hearts' || d.suit === 'diamonds';
            return (
              <div
                key={d.id}
                className={`rounded-lg border p-1.5 flex flex-col items-center justify-center text-center transition-all ${
                  d.status === 'inHand'
                    ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                    : d.status === 'played'
                      ? 'border-slate-800 bg-slate-900/40 text-slate-500 opacity-60'
                      : isSpades
                        ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                        : 'border-indigo-400/30 bg-slate-800/40 text-indigo-200'
                }`}
              >
                <span className={`text-base font-bold leading-none ${isRed ? 'text-rose-400' : ''}`}>
                  {SUIT_SYMBOL[d.suit]}
                </span>
                <span className="text-[10px] font-bold mt-1">2</span>
                <span className="text-[9px] mt-0.5 scale-90">
                  {d.status === 'inHand'
                    ? '你'
                    : d.status === 'played'
                      ? '已出'
                      : '未現'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Opening ♣3 & Monster Alert */}
      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-2">
          <div className="text-[10px] text-indigo-200/60 font-semibold">♣3 開局首牌</div>
          <div className="mt-1 text-xs font-bold text-indigo-100">
            {lowestCardStatus.status === 'inHand'
              ? '你手持（首出）'
              : lowestCardStatus.status === 'played'
                ? `${seatLabel(lowestCardStatus.playedBy ?? 0)} 已出`
                : '對手持有'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-2">
          <div className="text-[10px] text-indigo-200/60 font-semibold">清空輪數預估</div>
          <div className="mt-1 text-xs font-bold text-emerald-300">
            約 {humanTurns} 輪出完
          </div>
        </div>
      </section>

      {/* Monster Risk (Quads & Straight Flush) */}
      <section
        className={`rounded-xl border p-2.5 transition-colors ${
          monsterThreat.threatLevel === 'high'
            ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
            : monsterThreat.threatLevel === 'medium'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              : 'border-slate-800 bg-slate-900/40 text-slate-400'
        }`}
      >
        <div className="flex items-center justify-between font-bold">
          <div className="flex items-center gap-1">
            <span>🛡️</span>
            <span>怪物牌型警戒</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider">
            {monsterThreat.threatLevel === 'high'
              ? '高危潛伏'
              : monsterThreat.threatLevel === 'medium'
                ? '中度注意'
                : '安全'}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed opacity-90">
          {monsterThreat.summary}
        </p>
      </section>

      {/* Taiwanese Red Alert Line: 頂大保送防禦警戒線 */}
      {isNextSeatCritical && (
        <section className="rounded-xl border-2 border-rose-500 bg-gradient-to-r from-rose-950/80 to-rose-900/60 p-2.5 shadow-lg shadow-rose-950/50 animate-pulse">
          <div className="flex items-center gap-1.5 font-black text-rose-300 text-xs">
            <span className="text-sm">🚨</span>
            <span>頂大保送防禦警戒線！</span>
          </div>
          <p className="mt-1 text-[11px] text-rose-100 font-medium leading-relaxed">
            下家僅剩 <strong className="text-amber-300 font-black">1 張牌</strong>
            ！依台灣大老二桌規，任何人領出單張或頂牌時，<strong>必須打出手中最大單張</strong>
            ，嚴禁餵牌保送！
          </p>
        </section>
      )}

      {criticalSeats.length > 0 && !isNextSeatCritical && (
        <section className="rounded-xl border border-amber-500/60 bg-amber-950/50 p-2.5 text-amber-200">
          <div className="flex items-center gap-1 font-bold text-xs">
            <span>⚠️</span>
            <span>對手臨門一腳警戒</span>
          </div>
          <p className="mt-0.5 text-[11px] text-amber-100/80 leading-relaxed">
            已有對手手牌剩 1 張，進入賽末點攻防，切勿輕易送出小單張！
          </p>
        </section>
      )}
    </aside>
  );
}
