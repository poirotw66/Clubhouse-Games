import { useMemo, useState } from 'react';
import type {
  DominoesState,
  EndId,
  RuleVariant,
} from '../utils/dominoesLogic';
import {
  analyzeBlockadeThreat,
  getPipSuitAnalysis,
  getTileMatrix,
  simulateAllFivesScores,
} from '../utils/intelligence';
import {
  BarChart3,
  Calculator,
  Grid3X3,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

interface CockpitLeftWingProps {
  state: DominoesState;
  ruleVariant: RuleVariant;
  onSelectPlay?: (tileId: number, end: EndId) => void;
  selectedTileId: number | null;
}

export function CockpitLeftWing({
  state,
  ruleVariant,
  onSelectPlay,
  selectedTileId,
}: CockpitLeftWingProps) {
  const [activeTab, setActiveTab] = useState<'matrix' | 'scoring' | 'radar'>('radar');

  const matrix = useMemo(() => getTileMatrix(state, 0), [state]);
  const suitAnalysis = useMemo(() => getPipSuitAnalysis(matrix), [matrix]);
  const scoringSims = useMemo(() => {
    if (ruleVariant !== 'fives') return [];
    return simulateAllFivesScores(state.hands[0] ?? [], state.board);
  }, [ruleVariant, state.hands, state.board]);
  const threat = useMemo(() => analyzeBlockadeThreat(state, 0), [state]);

  const unseenTotal = useMemo(
    () => matrix.filter((m) => m.status === 'unseen').length,
    [matrix],
  );

  return (
    <aside className="w-full lg:w-80 flex flex-col gap-3 text-left">
      {/* Wing Header Capsule */}
      <div className="rounded-xl border border-sky-500/30 bg-slate-900/85 backdrop-blur-md p-3 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            <h2 className="text-sm font-bold tracking-wide text-sky-200">
              牌局情資雷達
            </h2>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 tabular-nums">
            未現身牌：{unseenTotal} 張
          </span>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('radar')}
            className={`flex items-center justify-center gap-1 py-1 rounded transition-colors ${
              activeTab === 'radar'
                ? 'bg-sky-500/20 text-sky-200 font-semibold border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>端點警報</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center justify-center gap-1 py-1 rounded transition-colors ${
              activeTab === 'matrix'
                ? 'bg-sky-500/20 text-sky-200 font-semibold border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>骨牌矩陣</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scoring')}
            className={`flex items-center justify-center gap-1 py-1 rounded transition-colors ${
              activeTab === 'scoring'
                ? 'bg-sky-500/20 text-sky-200 font-semibold border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>得分試算</span>
          </button>
        </div>
      </div>

      {/* Tab 1: 端點警報與封鎖死棋預警 */}
      {activeTab === 'radar' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex flex-col gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              開放端點存量分析
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                threat.isLocked
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {threat.isLocked ? '全線死棋' : '暢通中'}
            </span>
          </div>

          <div className="space-y-2">
            {threat.openEnds.length === 0 ? (
              <p className="text-xs text-slate-400">目前桌面尚未開出端點。</p>
            ) : (
              threat.openEnds.map((oe) => {
                const endLabels: Record<EndId, string> = {
                  left: '左端',
                  right: '右端',
                  up: '上端',
                  down: '下端',
                };
                return (
                  <div
                    key={oe.end}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 font-bold text-amber-300 text-xs border border-slate-700">
                        {oe.pip}
                      </span>
                      <span className="text-slate-300 font-medium">
                        {endLabels[oe.end]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px]">
                        剩餘 <strong className="text-slate-200 font-semibold">{oe.unseenCount}</strong> 張
                      </span>
                      {oe.isDead ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800">
                          斷門死端
                        </span>
                      ) : oe.playerCanPlay ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          可接
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          手中無
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Blockade Pip Differential Gauge */}
          <div className="mt-1 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[11px] text-slate-300 font-medium">
              <span>阻塞點數結算預演</span>
              <span
                className={
                  threat.favorableBlock ? 'text-emerald-400' : 'text-amber-400'
                }
              >
                {threat.favorableBlock ? '我方點數輕 · 佔優' : '我方點數重 · 慎防'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 tabular-nums">
              <span>我方手牌：{threat.playerHandSum} 點</span>
              <span>對手推估：約 {threat.estimatedOppHandSum} 點 ({threat.oppHandTileCount}張)</span>
            </div>
            <div className="text-[10px] text-slate-400 leading-relaxed">
              {threat.favorableBlock
                ? '若當前走入阻塞死局，我方點數較少將贏得殘局加分！'
                : '注意手中有較高點數牌，盡量避免觸發全員過牌阻塞。'}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 骨牌池透視矩陣與點數存量 */}
      {activeTab === 'matrix' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex flex-col gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Grid3X3 className="w-3.5 h-3.5 text-sky-400" />
              28 張骨牌池全覽
            </span>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-300">
                <span className="w-2 h-2 rounded bg-emerald-500/80 inline-block" />
                已出
              </span>
              <span className="flex items-center gap-1 text-amber-300">
                <span className="w-2 h-2 rounded bg-amber-500/80 inline-block" />
                手中
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded bg-slate-700 inline-block" />
                未現
              </span>
            </div>
          </div>

          {/* 7x7 Mini Triangular Grid */}
          <div className="grid grid-cols-7 gap-1 p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
            {Array.from({ length: 7 }, (_, row) =>
              Array.from({ length: 7 }, (_, col) => {
                if (col < row) {
                  return <div key={`${row}-${col}`} className="w-full aspect-square opacity-10" />;
                }
                const item = matrix.find(
                  (m) =>
                    (m.tile.left === row && m.tile.right === col) ||
                    (m.tile.left === col && m.tile.right === row),
                );
                if (!item) return <div key={`${row}-${col}`} />;

                const statusBg =
                  item.status === 'board'
                    ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/60 font-bold'
                    : item.status === 'hand'
                      ? 'bg-amber-500/30 text-amber-200 border-amber-400/80 font-bold'
                      : 'bg-slate-800/40 text-slate-400 border-slate-700/40';

                return (
                  <div
                    key={`${row}-${col}`}
                    title={`[${row}|${col}] - ${
                      item.status === 'board'
                        ? '已出在桌面'
                        : item.status === 'hand'
                          ? '在你手牌'
                          : '未現身（牌堆或對手）'
                    }`}
                    className={`aspect-square rounded border flex items-center justify-center text-[10px] tabular-nums select-none ${statusBg}`}
                  >
                    {row}{col}
                  </div>
                );
              }),
            )}
          </div>

          {/* Suit Pip Inventory */}
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-sky-400" />
              點數存量進度 (0～6 各 7 張)
            </span>
            <div className="grid grid-cols-7 gap-1 text-center">
              {suitAnalysis.map((s) => (
                <div
                  key={s.pip}
                  className={`p-1 rounded bg-slate-950/60 border ${
                    s.isDead
                      ? 'border-rose-800/80 bg-rose-950/30'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-200">{s.pip}點</div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {s.unseen}張
                  </div>
                  <div
                    className={`text-[9px] mt-0.5 rounded px-0.5 ${
                      s.isDead
                        ? 'bg-rose-900/60 text-rose-300'
                        : s.unseen <= 1
                          ? 'bg-amber-900/50 text-amber-300'
                          : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {s.isDead ? '已空' : s.unseen <= 1 ? '告急' : '充裕'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: 五倍數即時得分試算表 */}
      {activeTab === 'scoring' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex flex-col gap-2.5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              五倍數（All Fives）即時試算
            </span>
            <span className="text-[10px] text-emerald-400/90 font-medium">
              點擊直接鎖定
            </span>
          </div>

          {ruleVariant !== 'fives' ? (
            <p className="text-xs text-slate-400 py-3">
              目前模式為「{ruleVariant === 'draw' ? '摸牌制' : '封鎖制'}」，端點不計中途分；僅出完手牌或阻塞時結算對手點數。
            </p>
          ) : scoringSims.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">
              目前手牌無合法可出的接點，或尚未擺放開局骨牌。
            </p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {scoringSims.map((sim) => {
                const endLabels: Record<EndId, string> = {
                  left: '左端',
                  right: '右端',
                  up: '上端',
                  down: '下端',
                };
                const isSelected =
                  selectedTileId === sim.tileId;

                return (
                  <button
                    key={`${sim.tileId}-${sim.end}`}
                    type="button"
                    onClick={() => onSelectPlay?.(sim.tileId, sim.end)}
                    className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between touch-manipulation ${
                      sim.isScoring
                        ? 'border-emerald-500/50 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-100'
                        : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 text-slate-300'
                    } ${isSelected ? 'ring-2 ring-amber-400' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-xs border border-slate-700">
                        [{sim.tile.left}|{sim.tile.right}]
                      </span>
                      <span className="text-xs text-slate-300 font-medium">
                        接{endLabels[sim.end]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        和={sim.resultingSum}
                      </span>
                      {sim.isScoring ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-xs shadow">
                          +{sim.score}分
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          無得分
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
