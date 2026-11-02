import React from 'react';
import type { Card, GameState, PlayerHand } from '../types';
import type { ShoeState } from '../utils/shoe';
import { cardsRemaining, dealtRatio } from '../utils/shoe';
import {
  calculateBustProbability,
  getDealerBustProbability,
  calculatePlayerEdge,
  calculateShoeDensity,
  getStreakPrestige,
} from '../utils/telemetry';
import { recommendAction, STRATEGY_LABELS } from '../utils/basicStrategy';
import { Activity, Sparkles, ChevronDown, ChevronUp, Keyboard, Flame, Compass } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* LEFT WING: SHOE & COUNT RADAR                                              */
/* -------------------------------------------------------------------------- */
export interface ShoeCountRadarWingProps {
  shoe: ShoeState;
  runningHiLo: number;
  trueCountVal: number;
  showCountSetting: boolean;
}

export const ShoeCountRadarWing: React.FC<ShoeCountRadarWingProps> = ({
  shoe,
  runningHiLo,
  trueCountVal,
  showCountSetting,
}) => {
  const playerEdge = calculatePlayerEdge(trueCountVal);
  const shoeDensity = calculateShoeDensity(shoe.cards);
  const totalCards = cardsRemaining(shoe);
  const penetrationPct = Math.round(dealtRatio(shoe) * 100);

  return (
    <aside className="hidden xl:flex flex-col w-64 h-[calc(100vh-2rem)] max-h-[860px] p-3.5 bg-black/45 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl z-20 shrink-0 text-white justify-between">
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/20 border border-sky-400/30">
              <Compass className="w-4 h-4 text-sky-300" />
            </div>
            <span className="text-xs font-black tracking-wider text-sky-200">
              算牌與牌靴雷達
            </span>
          </div>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-white/50 border border-white/5">
            Hi-Lo
          </span>
        </div>

        {/* Running & True Count */}
        <div className="bg-black/40 rounded-xl p-2.5 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-white/60">
            <span>算牌數值</span>
            <span className="text-[9px] text-white/40">
              {showCountSetting ? '即時透視' : '已隱藏（盲測）'}
            </span>
          </div>
          {showCountSetting ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-lg p-2 text-center border border-white/5">
                <div className="text-[10px] text-white/45 font-bold">流水數 (RC)</div>
                <div className="text-lg font-black font-mono text-sky-300">
                  {runningHiLo >= 0 ? `+${runningHiLo}` : runningHiLo}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center border border-white/5">
                <div className="text-[10px] text-white/45 font-bold">真實數 (TC)</div>
                <div className="text-lg font-black font-mono text-amber-300">
                  {trueCountVal >= 0 ? `+${trueCountVal}` : trueCountVal}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-2.5 text-center text-xs text-white/40 font-bold bg-white/5 rounded-lg border border-white/5">
              練習模式：計數已隱藏
            </div>
          )}
        </div>

        {/* Player Advantage Gauge */}
        {showCountSetting && (
          <div className="bg-black/40 rounded-xl p-2.5 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-white/60">玩家期望值優勢</span>
              <span
                className={`text-xs font-black ${
                  playerEdge.tone === 'player'
                    ? 'text-emerald-400'
                    : playerEdge.tone === 'neutral'
                      ? 'text-amber-300'
                      : 'text-rose-400'
                }`}
              >
                {playerEdge.edge >= 0 ? `+${playerEdge.edge}%` : `${playerEdge.edge}%`}
              </span>
            </div>
            <div className="text-[10px] font-bold text-white/45">{playerEdge.label}</div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-300 ${
                  playerEdge.edge >= 0 ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(10, ((playerEdge.edge + 2) / 4) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Shoe Composition */}
        <div className="bg-black/40 rounded-xl p-2.5 border border-white/10 space-y-2">
          <div className="flex justify-between items-center text-[11px] font-bold text-white/60">
            <span>剩餘牌面分佈</span>
            <span className="text-[9px] text-white/40">餘 {totalCards} 張</span>
          </div>

          <div className="space-y-1.5 text-[10px]">
            <div>
              <div className="flex justify-between text-white/50 font-bold mb-0.5">
                <span className="text-sky-300">大牌 (10-A)</span>
                <span className="font-mono text-white/70">
                  {shoeDensity.high}張 ({shoeDensity.highPct}%)
                </span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${shoeDensity.highPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-white/50 font-bold mb-0.5">
                <span className="text-amber-200">中性牌 (7-9)</span>
                <span className="font-mono text-white/70">{shoeDensity.mid}張</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400/80 transition-all duration-300"
                  style={{
                    width: `${shoeDensity.total ? (shoeDensity.mid / shoeDensity.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-white/50 font-bold mb-0.5">
                <span className="text-emerald-300">小牌 (2-6)</span>
                <span className="font-mono text-white/70">
                  {shoeDensity.low}張 ({shoeDensity.lowPct}%)
                </span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-300"
                  style={{ width: `${shoeDensity.lowPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shoe Penetration Status */}
      <div className="bg-black/30 rounded-xl p-2.5 border border-white/5 space-y-1 text-[10px]">
        <div className="flex justify-between text-white/45 font-bold">
          <span>穿透進度</span>
          <span className="text-amber-300">{penetrationPct}%</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full ${shoe.needsReshuffle ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`}
            style={{ width: `${penetrationPct}%` }}
          />
        </div>
        <div className="text-[9px] text-white/40 pt-0.5">
          {shoe.needsReshuffle ? '⚠️ 切牌已過，下一手洗靴' : `洗牌切點：${Math.round(shoe.penetration * 100)}%`}
        </div>
      </div>
    </aside>
  );
};

/* -------------------------------------------------------------------------- */
/* RIGHT WING: TACTICAL & ODDS ADVISOR                                         */
/* -------------------------------------------------------------------------- */
export interface TacticalOddsWingProps {
  shoe: ShoeState;
  dealerCards: Card[];
  playerHands: PlayerHand[];
  activeHandIndex: number;
  gameState: GameState;
  streak: number;
  trueCountVal: number;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  onOpenShortcuts: () => void;
}

export const TacticalOddsWing: React.FC<TacticalOddsWingProps> = ({
  shoe,
  dealerCards,
  playerHands,
  activeHandIndex,
  gameState,
  streak,
  trueCountVal,
  canDouble,
  canSplit,
  canSurrender,
  onOpenShortcuts,
}) => {
  const activeHand = playerHands[activeHandIndex];
  const dealerUpcard = dealerCards[0];
  const isPlaying = gameState === 'playing';

  const bustChance = isPlaying && activeHand
    ? calculateBustProbability(activeHand.cards, shoe.cards)
    : 0;

  const dealerBustChance = dealerUpcard
    ? getDealerBustProbability(dealerUpcard, trueCountVal)
    : 0;

  const streakPrestige = getStreakPrestige(streak);

  let liveRecommendation: string | null = null;
  if (isPlaying && activeHand && dealerUpcard) {
    const action = recommendAction({
      phase: 'playing',
      playerCards: activeHand.cards,
      dealerUpcard,
      canDouble,
      canSplit,
      canSurrender,
    });
    liveRecommendation = STRATEGY_LABELS[action];
  }

  const bustToneClass =
    bustChance === 0
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : bustChance < 35
        ? 'text-sky-300 bg-sky-500/10 border-sky-500/30'
        : bustChance < 65
          ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
          : 'text-rose-400 bg-rose-500/15 border-rose-500/40 animate-pulse';

  const bustBarColor =
    bustChance < 35 ? 'bg-emerald-400' : bustChance < 65 ? 'bg-amber-400' : 'bg-rose-500';

  return (
    <aside className="hidden xl:flex flex-col w-64 h-[calc(100vh-2rem)] max-h-[860px] p-3.5 bg-black/45 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl z-20 shrink-0 text-white justify-between">
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-400/30">
              <Activity className="w-4 h-4 text-amber-300" />
            </div>
            <span className="text-xs font-black tracking-wider text-amber-200">
              即時機率與戰術顧問
            </span>
          </div>
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        </div>

        {/* Bust Risk Meter */}
        <div className="bg-black/40 rounded-xl p-3 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/60">要牌爆牌機率</span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-md border ${bustToneClass}`}>
              {isPlaying ? `${bustChance}%` : '—'}
            </span>
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full ${bustBarColor} transition-all duration-300`}
              style={{ width: `${bustChance}%` }}
            />
          </div>
          <p className="text-[9px] text-white/40">
            {isPlaying
              ? bustChance === 0
                ? '安全點數，補牌絕不爆牌'
                : bustChance > 60
                  ? '爆牌風險極高，需謹慎要牌'
                  : '標準博弈區間，參考基本策略'
              : '發牌後即時測算剩餘牌靴爆率'}
          </p>
        </div>

        {/* Dealer Bust Odds */}
        {dealerUpcard && (
          <div className="bg-black/40 rounded-xl p-3 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white/60">莊家爆牌預估</span>
              <span className="text-xs font-black text-amber-300 font-mono">
                {dealerBustChance}%
              </span>
            </div>
            <p className="text-[9px] text-white/40 leading-relaxed">
              莊家明牌 {dealerUpcard.rank}，
              {['4', '5', '6'].includes(dealerUpcard.rank)
                ? '屬弱勢牌，停牌勝率顯著提升'
                : '屬中強牌，需依策略積極爭取點數'}
            </p>
          </div>
        )}

        {/* Live Strategy Advice Badge */}
        {isPlaying && liveRecommendation && (
          <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-400/30 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
              AI 戰術顧問推薦
            </div>
            <div className="text-sm font-black text-amber-200">
              建議：{liveRecommendation}
            </div>
            <p className="text-[9px] text-white/50 leading-relaxed">
              依據數億手模擬之標準數學期望值最佳行動
            </p>
          </div>
        )}

        {/* Win Streak Prestige */}
        <div className="bg-black/40 rounded-xl p-2.5 border border-white/10 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>連勝光環</span>
            </div>
            <span className="text-[10px] font-black text-amber-300 font-mono">
              {streakPrestige.multiplierLabel}
            </span>
          </div>
          <div className="text-xs font-black text-white/90">
            {streakPrestige.title}（{streak} 連勝）
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Trigger */}
      <button
        type="button"
        onClick={onOpenShortcuts}
        className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between text-xs font-bold text-white/70 hover:text-white transition-all touch-manipulation group"
      >
        <div className="flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
          <span>實體鍵盤戰術熱鍵</span>
        </div>
        <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono font-bold">
          K
        </kbd>
      </button>
    </aside>
  );
};

/* -------------------------------------------------------------------------- */
/* MOBILE TELEMETRY CAPSULE & DRAWER                                          */
/* -------------------------------------------------------------------------- */
export interface MobileTelemetryCapsuleProps {
  shoe: ShoeState;
  dealerCards: Card[];
  playerHands: PlayerHand[];
  activeHandIndex: number;
  gameState: GameState;
  showCountSetting: boolean;
  trueCountVal: number;
  mobileDrawerOpen: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  onToggleMobileDrawer: () => void;
  onOpenShortcuts: () => void;
}

export const MobileTelemetryCapsule: React.FC<MobileTelemetryCapsuleProps> = ({
  shoe,
  dealerCards,
  playerHands,
  activeHandIndex,
  gameState,
  showCountSetting,
  trueCountVal,
  mobileDrawerOpen,
  canDouble,
  canSplit,
  canSurrender,
  onToggleMobileDrawer,
  onOpenShortcuts,
}) => {
  const activeHand = playerHands[activeHandIndex];
  const dealerUpcard = dealerCards[0];
  const isPlaying = gameState === 'playing';

  const bustChance = isPlaying && activeHand
    ? calculateBustProbability(activeHand.cards, shoe.cards)
    : 0;

  const dealerBustChance = dealerUpcard
    ? getDealerBustProbability(dealerUpcard, trueCountVal)
    : 0;

  const playerEdge = calculatePlayerEdge(trueCountVal);
  const shoeDensity = calculateShoeDensity(shoe.cards);

  let liveRecommendation: string | null = null;
  if (isPlaying && activeHand && dealerUpcard) {
    const action = recommendAction({
      phase: 'playing',
      playerCards: activeHand.cards,
      dealerUpcard,
      canDouble,
      canSplit,
      canSurrender,
    });
    liveRecommendation = STRATEGY_LABELS[action];
  }

  const bustToneClass =
    bustChance === 0
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : bustChance < 35
        ? 'text-sky-300 bg-sky-500/10 border-sky-500/30'
        : bustChance < 65
          ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
          : 'text-rose-400 bg-rose-500/15 border-rose-500/40 animate-pulse';

  return (
    <div className="xl:hidden w-full max-w-xl z-20 shrink-0 px-1">
      <button
        type="button"
        onClick={onToggleMobileDrawer}
        className="w-full flex items-center justify-between bg-black/60 hover:bg-black/75 px-3 py-1.5 rounded-xl border border-amber-400/25 backdrop-blur-md shadow-md text-white touch-manipulation transition-all"
      >
        <div className="flex items-center gap-2 text-xs font-bold min-w-0">
          <Activity className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span className="text-amber-200 truncate">戰情遙測儀</span>
          {isPlaying && (
            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${bustToneClass}`}>
              爆率 {bustChance}%
            </span>
          )}
          {showCountSetting && (
            <span className="text-[10px] font-mono text-sky-300 hidden sm:inline">
              TC {trueCountVal >= 0 ? `+${trueCountVal}` : trueCountVal}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/50 shrink-0">
          <span>{mobileDrawerOpen ? '收起' : '展開數據'}</span>
          {mobileDrawerOpen ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {mobileDrawerOpen && (
        <div className="mt-1 bg-black/85 rounded-xl border border-white/15 p-3 backdrop-blur-lg shadow-2xl space-y-2.5 text-white animate-in slide-in-from-top duration-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-center">
              <div className="text-[9px] text-white/40 font-bold">要牌爆率</div>
              <div className="text-sm font-black text-amber-300">{isPlaying ? `${bustChance}%` : '—'}</div>
            </div>
            <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-center">
              <div className="text-[9px] text-white/40 font-bold">莊家爆牌預估</div>
              <div className="text-sm font-black text-sky-300">
                {dealerUpcard ? `${dealerBustChance}%` : '—'}
              </div>
            </div>
            <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-center">
              <div className="text-[9px] text-white/40 font-bold">Hi-Lo 真數 (TC)</div>
              <div className="text-sm font-black font-mono text-emerald-300">
                {showCountSetting ? (trueCountVal >= 0 ? `+${trueCountVal}` : trueCountVal) : '已隱藏'}
              </div>
            </div>
            <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-center">
              <div className="text-[9px] text-white/40 font-bold">玩家期望優勢</div>
              <div className="text-sm font-black text-amber-200">
                {showCountSetting ? `${playerEdge.edge >= 0 ? `+${playerEdge.edge}%` : `${playerEdge.edge}%`}` : '—'}
              </div>
            </div>
          </div>

          {isPlaying && liveRecommendation && (
            <div className="bg-amber-500/15 p-2 rounded-lg border border-amber-400/30 flex items-center justify-between text-xs">
              <span className="text-amber-300 font-bold">戰術顧問建議：</span>
              <span className="font-black text-white bg-amber-500/30 px-2 py-0.5 rounded">
                {liveRecommendation}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-1 border-t border-white/10 text-[10px] text-white/40">
            <span>剩餘大牌 10-A：{shoeDensity.high} 張 ({shoeDensity.highPct}%)</span>
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="text-amber-300 underline font-bold touch-manipulation"
            >
              查看實體鍵盤熱鍵 [K]
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
