import { useMemo, useState } from 'react';
import type {
  DominoesState,
  EndId,
  RuleVariant,
} from '../utils/dominoesLogic';
import {
  analyzeBlockadeThreat,
  analyzeChainEndsTrajectory,
  getPipSuitAnalysis,
  getTileMatrix,
  simulateAllFivesScores,
} from '../utils/intelligence';
import {
  playBoneClatter,
  playBoneyardShuffle,
  playAllFivesArpeggio,
} from '../utils/dominoAcoustics';
import type { PipDisplayMode, TileCraftTheme } from './DominoTile';
import {
  BarChart3,
  Calculator,
  Compass,
  Grid3X3,
  Palette,
  ShieldAlert,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface CockpitLeftWingProps {
  state: DominoesState;
  ruleVariant: RuleVariant;
  onSelectPlay?: (tileId: number, end: EndId) => void;
  selectedTileId: number | null;
  craft?: TileCraftTheme;
  onChangeCraft?: (craft: TileCraftTheme) => void;
  pipMode?: PipDisplayMode;
  onChangePipMode?: (mode: PipDisplayMode) => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

export function CockpitLeftWing({
  state,
  ruleVariant,
  onSelectPlay,
  selectedTileId,
  craft = 'ivory',
  onChangeCraft,
  pipMode = 'pips',
  onChangePipMode,
  isMuted = false,
  onToggleMute,
}: CockpitLeftWingProps) {
  const [activeTab, setActiveTab] = useState<'radar' | 'matrix' | 'scoring' | 'craft'>('radar');

  const matrix = useMemo(() => getTileMatrix(state, 0), [state]);
  const suitAnalysis = useMemo(() => getPipSuitAnalysis(matrix), [matrix]);
  const scoringSims = useMemo(() => {
    if (ruleVariant !== 'fives') return [];
    return simulateAllFivesScores(state.hands[0] ?? [], state.board);
  }, [ruleVariant, state.hands, state.board]);
  const threat = useMemo(() => analyzeBlockadeThreat(state, 0), [state]);
  const trajectory = useMemo(() => analyzeChainEndsTrajectory(state, 0), [state]);

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
        <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px]">
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
          <button
            type="button"
            onClick={() => setActiveTab('craft')}
            className={`flex items-center justify-center gap-1 py-1 rounded transition-colors ${
              activeTab === 'craft'
                ? 'bg-sky-500/20 text-sky-200 font-semibold border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>工藝音效</span>
          </button>
        </div>
      </div>

      {/* Tab 1: 端點警報與走向預測 */}
      {activeTab === 'radar' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex flex-col gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              端點走向與戰術引導
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
            {trajectory.length === 0 ? (
              <p className="text-xs text-slate-400">目前桌面尚未開出端點。</p>
            ) : (
              trajectory.map((tr) => {
                const endLabels: Record<EndId, string> = {
                  left: '左端',
                  right: '右端',
                  up: '上端',
                  down: '下端',
                };
                return (
                  <div
                    key={tr.end}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 font-bold text-amber-300 text-xs border border-slate-700">
                          {tr.pip}
                        </span>
                        <span className="text-slate-300 font-semibold">
                          {endLabels[tr.end]}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">
                          流通剩 <strong className="text-slate-200">{tr.unseenMatchingCount}</strong> 張
                        </span>
                        {tr.tacticalStatus === 'exploit' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                            壓制缺門
                          </span>
                        )}
                        {tr.tacticalStatus === 'secure' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                            我方掌控
                          </span>
                        )}
                        {tr.tacticalStatus === 'danger' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                            敵方高發
                          </span>
                        )}
                        {tr.tacticalStatus === 'exhausted' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            永久死端
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 leading-relaxed pl-1 border-l-2 border-sky-600">
                      {tr.recommendation}
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
                  threat.favorableBlock ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'
                }
              >
                {threat.favorableBlock ? '我方輕牌 · 佔優' : '我方重牌 · 慎防'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 tabular-nums">
              <span>我方手牌：{threat.playerHandSum} 點</span>
              <span>對手推估：約 {threat.estimatedOppHandSum} 點 ({threat.oppHandTileCount}張)</span>
            </div>
            <div className="text-[10px] text-slate-400 leading-relaxed">
              {threat.favorableBlock
                ? '若當前走入阻塞死局，我方點數較少將贏得殘局通吃！'
                : '手中有較高點數牌，儘量卸牌或保留接牌靈活性防範阻塞。'}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 骨牌透視矩陣與點數存量 */}
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

      {/* Tab 3: 五倍數即時得分試算與回防評級 */}
      {activeTab === 'scoring' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex flex-col gap-2.5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              五倍數試算與戰術評級
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
                const isSelected = selectedTileId === sim.tileId;

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
                      {sim.tacticalGrade && (
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                            sim.tacticalGrade === 'S'
                              ? 'bg-amber-500 text-slate-950'
                              : sim.tacticalGrade === 'A'
                                ? 'bg-emerald-600 text-white'
                                : sim.tacticalGrade === 'B'
                                  ? 'bg-sky-700 text-white'
                                  : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          評級 {sim.tacticalGrade}
                        </span>
                      )}
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

      {/* Tab 4: 3D 骨牌工藝與原生音效設置 */}
      {activeTab === 'craft' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex flex-col gap-3 shadow-lg text-xs">
          {/* Craft Material Theme */}
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              骨牌奢華工藝材質
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'ivory', label: '典藏象牙', desc: '溫潤骨白 · 沉香黑點' },
                  { id: 'obsidian', label: '皇家黑曜', desc: '火山玄石 · 24K金點' },
                  { id: 'walnut', label: '古董胡桃', desc: '黑胡桃木 · 珠光嵌點' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeCraft?.(m.id)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    craft === m.id
                      ? 'border-amber-400 bg-amber-950/40 text-amber-200 ring-1 ring-amber-400/50'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-xs">{m.label}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5 leading-tight">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Pip Display Mode */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800/80">
            <span className="font-semibold text-slate-200">點數呈現模式</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'pips', label: '經典點數 (Pips)' },
                  { id: 'numerals', label: '數字標籤 (Numerals)' },
                  { id: 'both', label: '雙模並存 (Hybrid)' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChangePipMode?.(p.id)}
                  className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                    pipMode === p.id
                      ? 'border-sky-400 bg-sky-950/40 text-sky-200 ring-1 ring-sky-400/50 font-semibold'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Native Web Audio Acoustics */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                原生骨牌物理音效
              </span>
              <button
                type="button"
                onClick={onToggleMute}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  isMuted
                    ? 'border-rose-700 bg-rose-950/60 text-rose-300'
                    : 'border-emerald-700 bg-emerald-950/60 text-emerald-300'
                }`}
              >
                {isMuted ? '已靜音' : '音效開啟'}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => playBoneClatter({ intensity: 1.0 })}
                className="flex-1 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors"
              >
                試聽骨牌碰撞
              </button>
              <button
                type="button"
                onClick={() => playBoneyardShuffle()}
                className="flex-1 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors"
              >
                試聽牌堆洗牌
              </button>
              <button
                type="button"
                onClick={() => playAllFivesArpeggio(15)}
                className="flex-1 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors"
              >
                試聽五倍鐘鳴
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
