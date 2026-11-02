import React from 'react';
import type { Card } from '../game/types';
import type {
  KeyCardInfo,
  ScoreLeverage,
  TableProjectionOption,
} from '../game/tactics';

interface Props {
  leverage: ScoreLeverage;
  radar: KeyCardInfo[];
  projections: TableProjectionOption[];
  selectedCard: Card | null;
  onSelectHandCard: (card: Card) => void;
  onTargetClick?: (card: Card) => void;
  isMobileDrawer?: boolean;
}

const LOCATION_STYLES: Record<
  KeyCardInfo['location'],
  { label: string; bg: string; text: string; border: string }
> = {
  mine: {
    label: '己收',
    bg: 'bg-emerald-950/80',
    text: 'text-emerald-300',
    border: 'border-emerald-500/60',
  },
  in_hand: {
    label: '在手',
    bg: 'bg-purple-950/80',
    text: 'text-purple-300',
    border: 'border-purple-500/60',
  },
  on_table: {
    label: '池中',
    bg: 'bg-amber-950/90',
    text: 'text-amber-300',
    border: 'border-amber-400',
  },
  opponent: {
    label: '敵收',
    bg: 'bg-rose-950/80',
    text: 'text-rose-300',
    border: 'border-rose-500/50',
  },
  hidden: {
    label: '深藏',
    bg: 'bg-slate-900/60',
    text: 'text-slate-400',
    border: 'border-slate-700/60',
  },
};

export function TacticalLeftWing({
  leverage,
  radar,
  projections,
  selectedCard,
  onSelectHandCard,
  onTargetClick,
  isMobileDrawer = false,
}: Props): React.ReactElement {
  const {
    myScore,
    par,
    deckTotal,
    margin,
    tableRedPoints,
    opponentsTotalScore,
    remainingUnknownRedPoints,
    statusLabel,
    statusDesc,
  } = leverage;

  const myPct = Math.min(100, Math.max(0, (myScore / deckTotal) * 100));
  const oppPct = Math.min(100, Math.max(0, (opponentsTotalScore / deckTotal) * 100));
  const tablePct = Math.min(100, Math.max(0, (tableRedPoints / deckTotal) * 100));
  const unknownPct = Math.max(0, 100 - myPct - oppPct - tablePct);

  return (
    <aside
      className={`flex flex-col gap-3 text-slate-200 select-none ${
        isMobileDrawer
          ? 'w-full'
          : 'w-72 xl:w-80 shrink-0'
      }`}
      aria-label="左翼：勝勢天秤與牌情雷達"
    >
      {/* 勝勢天秤區塊 */}
      <section className="rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-lg shadow-emerald-950/20">
        <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
          <div className="flex items-center gap-1.5">
            <span className="text-base" role="img" aria-label="天秤">⚖️</span>
            <span className="text-xs font-black tracking-wide text-emerald-100">勝勢天秤</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-300/80">
            標準分 {par.toFixed(0)} / {deckTotal} 分
          </span>
        </div>

        {/* 核心指標 */}
        <div className="my-2.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">當前累積紅點</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-emerald-300 tabular-nums">{myScore}</span>
              <span className="text-xs text-slate-400">分</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400 font-medium">合格差額</div>
            <div
              className={`text-sm font-black tabular-nums mt-0.5 ${
                margin >= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {margin >= 0 ? `+${margin.toFixed(0)} 分 (已達標)` : `差 ${Math.abs(margin).toFixed(0)} 分`}
            </div>
          </div>
        </div>

        {/* 堆疊進度條 */}
        <div className="mt-2">
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex gap-0.5">
            <div
              className="bg-emerald-500 transition-all duration-300"
              style={{ width: `${myPct}%` }}
              title={`你已奪：${myScore} 分`}
            />
            <div
              className="bg-rose-500 transition-all duration-300"
              style={{ width: `${oppPct}%` }}
              title={`對手已奪：${opponentsTotalScore} 分`}
            />
            <div
              className="bg-amber-400 transition-all duration-300"
              style={{ width: `${tablePct}%` }}
              title={`桌面待撿：${tableRedPoints} 分`}
            />
            <div
              className="bg-slate-600 transition-all duration-300"
              style={{ width: `${unknownPct}%` }}
              title={`暗牌庫存：${remainingUnknownRedPoints} 分`}
            />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>你已奪 {myScore} 分</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>對手 {opponentsTotalScore} 分</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span>池中待撿 {tableRedPoints} 分</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
              <span>暗牌庫存 {remainingUnknownRedPoints} 分</span>
            </div>
          </div>
        </div>

        {/* 局勢研判摘要 */}
        <div className="mt-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20 p-2 text-[11px]">
          <div className="font-bold text-emerald-200">{statusLabel}</div>
          <div className="text-emerald-300/80 text-[10px] mt-0.5 leading-relaxed">
            {statusDesc}
          </div>
        </div>
      </section>

      {/* 大分牌透視雷達 */}
      <section className="rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-lg shadow-emerald-950/20">
        <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
          <div className="flex items-center gap-1.5">
            <span className="text-base" role="img" aria-label="雷達">🎯</span>
            <span className="text-xs font-black tracking-wide text-emerald-100">大分牌透視雷達</span>
          </div>
          <span className="text-[10px] text-slate-400">公開催牌統計</span>
        </div>

        {/* 關鍵大分網格 */}
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {radar.map((card) => {
            const loc = LOCATION_STYLES[card.location];
            const isClickable = card.location === 'on_table' && onTargetClick;
            return (
              <div
                key={card.id}
                onClick={() => {
                  if (card.location === 'on_table' && onTargetClick) {
                    onTargetClick({
                      id: card.id,
                      suit: card.suit,
                      rank: card.rank,
                    });
                  }
                }}
                className={`relative flex flex-col items-center justify-between p-1.5 rounded-lg border text-center transition-transform ${
                  loc.bg
                } ${loc.border} ${
                  isClickable ? 'cursor-pointer hover:scale-105 hover:border-amber-300 ring-1 ring-amber-400/50' : ''
                }`}
                title={`${card.label}（${card.points} 分）· 狀態：${loc.label} · 湊十需配 ${card.matchingRank}`}
              >
                <div className="flex items-center justify-between w-full text-[9px] font-bold text-slate-300 leading-none">
                  <span className={card.suit === 'hearts' || card.suit === 'diamonds' ? 'text-rose-400' : 'text-slate-300'}>
                    {card.label}
                  </span>
                  <span className="text-amber-300/90 font-black">{card.points}</span>
                </div>
                <div className={`mt-1 text-[9px] font-bold px-1 rounded ${loc.text}`}>
                  {loc.label}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-400 px-0.5">
          <span>🟢 己收</span>
          <span>🟣 在手</span>
          <span className="text-amber-300 font-semibold">🟡 池中待吃</span>
          <span>🔴 敵收</span>
          <span>⚪ 未現</span>
        </div>
      </section>

      {/* 牌池最佳吃牌組合投影 */}
      <section className="rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-lg shadow-emerald-950/20">
        <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
          <div className="flex items-center gap-1.5">
            <span className="text-base" role="img" aria-label="投影">🧮</span>
            <span className="text-xs font-black tracking-wide text-emerald-100">吃牌試算投影</span>
          </div>
          <span className="text-[10px] text-emerald-300/70">
            {projections.filter((p) => p.canCapture).length} 組可吃
          </span>
        </div>

        <div className="mt-2.5 flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-0.5">
          {projections.length === 0 && (
            <div className="text-center py-4 text-xs text-slate-500">手牌已空</div>
          )}
          {projections.map((p) => {
            const isSelected = selectedCard?.id === p.handCard.id;
            return (
              <button
                key={p.handCard.id}
                type="button"
                onClick={() => onSelectHandCard(p.handCard)}
                className={`w-full text-left rounded-xl p-2 border transition-all text-xs flex items-center justify-between ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-500/20 ring-1 ring-emerald-400'
                    : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`font-black px-1.5 py-0.5 rounded text-[11px] ${
                      p.handCard.suit === 'hearts' || p.handCard.suit === 'diamonds'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800/50'
                        : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {p.handCard.suit === 'hearts'
                      ? '♥'
                      : p.handCard.suit === 'diamonds'
                      ? '♦'
                      : p.handCard.suit === 'spades'
                      ? '♠'
                      : '♣'}
                    {p.handCard.rank === 1
                      ? 'A'
                      : p.handCard.rank === 11
                      ? 'J'
                      : p.handCard.rank === 12
                      ? 'Q'
                      : p.handCard.rank === 13
                      ? 'K'
                      : p.handCard.rank}
                  </span>

                  <div className="truncate">
                    {p.canCapture ? (
                      <span className="font-semibold text-emerald-200">
                        吃 {p.bestTarget ? `${p.bestTarget.suit === 'hearts' || p.bestTarget.suit === 'diamonds' ? '紅' : '黑'}${p.bestTarget.rank === 1 ? 'A' : p.bestTarget.rank}` : ''}
                        {p.targets.length > 1 ? ` 等 ${p.targets.length} 張` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">{p.discardSafetyLabel}</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {p.isToolConversion && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-[9px] font-black text-amber-300">
                      以黑換紅
                    </span>
                  )}
                  {p.canCapture ? (
                    <span className="font-black text-emerald-300 text-xs">
                      +{p.maxPoints}
                    </span>
                  ) : p.discardSafety === 'danger' ? (
                    <span className="text-[10px] text-rose-400 font-bold">高危</span>
                  ) : (
                    <span className="text-[10px] text-emerald-400/80 font-medium">安全</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
