import { useMemo, useState } from 'react';
import type {
  Difficulty,
  DominoesState,
  MatchState,
} from '../utils/dominoesLogic';
import type { GameMode } from '../utils/storage';
import { getOpponentDossiers } from '../utils/intelligence';
import {
  BookMarked,
  ChevronDown,
  ChevronUp,
  Cpu,
  Flame,
  Lightbulb,
  Trophy,
} from 'lucide-react';

interface CockpitRightWingProps {
  state: DominoesState;
  match: MatchState;
  gameMode: GameMode;
  difficulty: Difficulty;
  streak: number;
}

export function CockpitRightWing({
  state,
  match,
  gameMode,
  difficulty,
  streak,
}: CockpitRightWingProps) {
  const dossiers = useMemo(
    () => getOpponentDossiers(state, 0, gameMode),
    [state, gameMode],
  );

  const [expandedTip, setExpandedTip] = useState<number | null>(null);

  const strategyTips = [
    {
      title: '重牌卸除 (Heavy Offloading)',
      summary: '優先出清 6-6、5-5 等高點數雙張，避免陷入死棋結算時重罰失分。',
      detail:
        '當盤面有機會接上高點數牌時，若無需保留湊 5 的倍數，儘量提前脫手，讓手中保留 0、1、2 點為主的輕牌，以防對手隨時引發阻塞結算。',
    },
    {
      title: '斷門牽制 (Suit Starvation)',
      summary: '記錄對手跳過或抽牌時的開放點數，持續留該點數逼迫對手停滯。',
      detail:
        '當對手在某端點抽牌或跳過時，代表其極可能已無該花色。我方若能將盤面兩端之一鎖死在該點數上，對手將喪失出牌權，只能不斷抽牌摸乾牌堆。',
    },
    {
      title: '五倍數控和 (All Fives Tuning)',
      summary: '端點和湊滿 5、10、15、20 點立即得分；切記雙張在端點計雙倍點數。',
      detail:
        '出牌前計算兩端（或四端）相加後的數值。如果打出雙五 [5|5]，其端點點數視為 10 點；轉軸左右兩側接滿後，上下兩翼將解鎖，創造更多湊 5 分機會。',
    },
    {
      title: '阻塞決勝 (Calculated Blocking)',
      summary: '當我方手中總點數極低時，主動封死所有開放端點迫使阻塞。',
      detail:
        '當你手牌點數遠小於對手推估點數時，主動下出斷門牌引發阻塞是頂級牌手的致勝招式。阻塞結算直接比較雙方手牌點數和，點數少者通吃對手手牌總分！',
    },
  ];

  return (
    <aside className="w-full lg:w-80 flex flex-col gap-3 text-left">
      {/* Opponent Dossier Section */}
      <div className="rounded-xl border border-amber-500/30 bg-slate-900/85 backdrop-blur-md p-3 shadow-lg flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide text-amber-200">
              對手戰情檔案
            </h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300">
            {difficulty === 'hard'
              ? '高階推論 AI'
              : difficulty === 'normal'
                ? '標準 AI'
                : '入門 AI'}
          </span>
        </div>

        <div className="space-y-2">
          {dossiers.map((dos) => (
            <div
              key={dos.seat}
              className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  {dos.label}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 tabular-nums">
                  手牌：{dos.handCount} 張
                </span>
              </div>

              {/* Suspected Voids */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>推論缺門 (Void)：</span>
                  {dos.suspectedLacks.length === 0 ? (
                    <span className="text-slate-500">尚無缺門紀錄</span>
                  ) : (
                    <div className="flex gap-1">
                      {dos.suspectedLacks.map((p) => (
                        <span
                          key={p}
                          className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold text-[10px]"
                        >
                          缺 {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {dos.lackExplanations.map((exp, idx) => (
                  <p
                    key={idx}
                    className="text-[10px] text-rose-400/90 leading-tight pl-1 border-l-2 border-rose-700"
                  >
                    {exp}
                  </p>
                ))}
              </div>

              {/* Tactical Tip */}
              <div className="text-[11px] bg-slate-900/90 rounded p-2 text-amber-200/90 border border-amber-900/40 flex items-start gap-1.5 leading-relaxed">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{dos.tacticalTip}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Match Momentum & Series Pulse */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-lg flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            系列賽動能
          </span>
          {streak > 0 && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium">
              <Flame className="w-3 h-3 text-amber-400" />
              {streak} 連勝中
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
            <div className="text-slate-400 text-[10px]">當前賽局</div>
            <div className="text-sm font-bold text-slate-100">
              第 {match.round} 局
            </div>
          </div>
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
            <div className="text-slate-400 text-[10px]">目標分數</div>
            <div className="text-sm font-bold text-slate-100">
              {match.target === 1 ? '單局決勝' : `${match.target} 分`}
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Codex */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 shadow-lg flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <BookMarked className="w-3.5 h-3.5 text-sky-400" />
            殘局牌術錦囊
          </span>
          <span className="text-[10px] text-slate-400">點擊展開</span>
        </div>

        <div className="space-y-1.5">
          {strategyTips.map((tip, idx) => {
            const isExpanded = expandedTip === idx;
            return (
              <div
                key={idx}
                className="rounded-lg border border-slate-800/80 bg-slate-950/50 overflow-hidden text-xs"
              >
                <button
                  type="button"
                  onClick={() => setExpandedTip(isExpanded ? null : idx)}
                  className="w-full p-2 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
                >
                  <span className="font-medium text-slate-200 text-xs">
                    {tip.title}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>
                {isExpanded && (
                  <div className="p-2.5 pt-0 text-[11px] text-slate-300 leading-relaxed border-t border-slate-800/60 bg-slate-900/40">
                    <p className="font-semibold text-amber-200/90 mb-1">
                      {tip.summary}
                    </p>
                    <p className="text-slate-400">{tip.detail}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
