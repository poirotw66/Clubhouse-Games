import type { ReactElement } from 'react';
import { Activity, Compass, Eye, EyeOff, Shield, ShieldAlert, Sparkles } from 'lucide-react';
import type { Board, Piece } from '../utils/reversiLogic';
import {
  calculateCornerControl,
  calculateMobility,
  calculateStability,
  getGameStage,
  type GameStage,
  type MobilityPressureStatus,
  type StabilityAnalysis,
} from '../utils/tactics';

export interface TacticalLeftWingProps {
  board: Board;
  currentTurn: Piece;
  blackCount: number;
  whiteCount: number;
  tacticalVision: boolean;
  onToggleTacticalVision: () => void;
  stabilityAnalysis?: StabilityAnalysis;
  className?: string;
}

const STAGE_LABELS: Record<GameStage, { label: string; color: string }> = {
  opening: { label: '開局佈局', color: 'bg-emerald-800/60 text-emerald-200 border-emerald-600/50' },
  midgame: { label: '中盤機動', color: 'bg-amber-800/60 text-amber-200 border-amber-600/50' },
  endgame: { label: '終局收官', color: 'bg-rose-800/60 text-rose-200 border-rose-600/50' },
};

const PRESSURE_LABELS: Record<
  MobilityPressureStatus,
  { label: string; desc: string; badgeClass: string }
> = {
  squeeze: {
    label: '逼迫 PASS 警戒！',
    desc: '對手已無退路，即將被強迫跳過回合',
    badgeClass: 'bg-rose-900/80 text-rose-200 border-rose-500 animate-pulse',
  },
  dominant: {
    label: '行動力全面壓制',
    desc: '我方選擇大幅領先，掌握盤面主動權',
    badgeClass: 'bg-emerald-900/80 text-emerald-200 border-emerald-500',
  },
  balanced: {
    label: '勢均力敵中',
    desc: '雙方機動空間接近，謹慎搶佔先機',
    badgeClass: 'bg-stone-800/80 text-stone-300 border-stone-600',
  },
  constrained: {
    label: '行動力受限告急',
    desc: '可下點少，當心被對手逼入禁著點',
    badgeClass: 'bg-amber-900/80 text-amber-200 border-amber-500',
  },
};

export function TacticalLeftWing({
  board,
  currentTurn,
  blackCount,
  whiteCount,
  tacticalVision,
  onToggleTacticalVision,
  stabilityAnalysis,
  className = '',
}: TacticalLeftWingProps): ReactElement {
  const totalPieces = blackCount + whiteCount;
  const empties = 64 - totalPieces;
  const blackPct = totalPieces > 0 ? Math.round((blackCount / totalPieces) * 100) : 50;
  const whitePct = 100 - blackPct;

  const stage = getGameStage(board);
  const corners = calculateCornerControl(board);
  const mobility = calculateMobility(board, currentTurn);
  const pressure = PRESSURE_LABELS[mobility.pressure];
  const stability = stabilityAnalysis ?? calculateStability(board);

  return (
    <aside
      className={`flex flex-col gap-3 bg-stone-900/85 backdrop-blur-md border border-emerald-800/50 rounded-2xl p-4 shadow-xl text-left text-stone-200 ${className}`}
      aria-label="戰術情報與局勢天秤"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-700/70 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold tracking-wide text-emerald-300 uppercase">
            左翼・戰況遙測儀
          </h2>
        </div>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${STAGE_LABELS[stage].color}`}
        >
          {STAGE_LABELS[stage].label}
        </span>
      </div>

      {/* 1. 局勢天秤 (Balance of Power) */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-baseline text-xs">
          <span className="font-semibold text-stone-300">局勢天秤佔有率</span>
          <span className="text-[11px] text-stone-400">尚餘 {empties} 格</span>
        </div>
        <div className="h-3.5 w-full bg-stone-950 rounded-full overflow-hidden flex border border-stone-700">
          <div
            className="h-full bg-gradient-to-r from-stone-900 to-stone-700 transition-all duration-300 flex items-center justify-start pl-1.5 text-[9px] font-bold text-stone-300"
            style={{ width: `${blackPct}%` }}
          >
            {blackPct >= 18 && `${blackPct}%`}
          </div>
          <div
            className="h-full bg-gradient-to-r from-stone-300 to-white transition-all duration-300 flex items-center justify-end pr-1.5 text-[9px] font-bold text-stone-900"
            style={{ width: `${whitePct}%` }}
          >
            {whitePct >= 18 && `${whitePct}%`}
          </div>
        </div>
        <div className="flex justify-between text-[11px] text-stone-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-900 border border-stone-600 inline-block" />
            黑棋 {blackCount} 枚
          </span>
          <span className="flex items-center gap-1">
            白棋 {whiteCount} 枚
            <span className="w-2.5 h-2.5 rounded-full bg-stone-100 border border-stone-300 inline-block" />
          </span>
        </div>
      </div>

      {/* 2. 四角要塞掌控儀 (Corner Dominance Radar) */}
      <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-2.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-amber-300 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            四角要塞掌控儀
          </span>
          <span className="text-[11px] text-amber-200/80">
            黑 {corners.black} · 白 {corners.white} · 空 {corners.empty}
          </span>
        </div>

        {/* 2x2 Mini Corner Radar */}
        <div className="grid grid-cols-2 gap-2 bg-stone-900/60 p-2 rounded-lg border border-stone-800">
          <CornerBadge pos="A1 (左上)" cell={corners.tl} />
          <CornerBadge pos="H1 (右上)" cell={corners.tr} />
          <CornerBadge pos="A8 (左下)" cell={corners.bl} />
          <CornerBadge pos="H8 (右下)" cell={corners.br} />
        </div>
        <p className="text-[10px] text-stone-400 leading-tight">
          ★ 角地為不可逆的永久安全要塞，一旦鎖定即可築起防禦陣線。
        </p>
      </div>

      {/* 3. 穩定度與前線暴露分析 (Stability & Frontier Telemetry) */}
      <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-2.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-emerald-300 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            盤面穩定度遙測
          </span>
          <span className="text-[10px] text-stone-400">
            {stage === 'opening' ? '開局控損' : stage === 'midgame' ? '前線攻防' : '收官決算'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Stable Discs */}
          <div className="bg-stone-900/70 p-2 rounded-lg border border-stone-800">
            <div className="flex items-center justify-between text-[11px] text-amber-200">
              <span>🛡️ 永久安定子</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between font-mono">
              <span className="text-stone-300 text-xs">黑 {stability.blackStable}</span>
              <span className="text-stone-300 text-xs">白 {stability.whiteStable}</span>
            </div>
          </div>

          {/* Frontier Exposure */}
          <div className="bg-stone-900/70 p-2 rounded-lg border border-stone-800">
            <div className="flex items-center justify-between text-[11px] text-sky-200">
              <span>⚡ 前線暴露率</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between font-mono text-xs">
              <span
                className={
                  stability.blackFrontierRate > 70 ? 'text-amber-400 font-bold' : 'text-stone-300'
                }
              >
                黑 {stability.blackFrontierRate}%
              </span>
              <span
                className={
                  stability.whiteFrontierRate > 70 ? 'text-amber-400 font-bold' : 'text-stone-300'
                }
              >
                白 {stability.whiteFrontierRate}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-between text-[10px] text-stone-400 px-0.5">
          <span>內部核心子：黑 {stability.blackInterior} 枚</span>
          <span>白 {stability.whiteInterior} 枚</span>
        </div>
      </div>

      {/* 4. 行動力壓制儀 (Mobility Suppression Index) */}
      <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-2.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-sky-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            行動力壓制儀
          </span>
          <span className="text-[11px] font-mono text-sky-200">
            {mobility.currentLegalCount} vs {mobility.opponentLegalCount} 手
          </span>
        </div>

        {/* Mobility gauge bar */}
        <div className="h-2 w-full bg-stone-900 rounded-full overflow-hidden border border-stone-700/60 flex">
          <div
            className={`h-full transition-all duration-300 ${
              mobility.currentLegalCount >= mobility.opponentLegalCount
                ? 'bg-sky-400'
                : 'bg-amber-500'
            }`}
            style={{ width: `${mobility.leadRatio}%` }}
          />
        </div>

        {/* Pressure Alert Badge */}
        <div
          className={`flex items-start gap-1.5 p-2 rounded-lg border text-xs leading-snug ${pressure.badgeClass}`}
        >
          {mobility.pressure === 'squeeze' && (
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          )}
          <div>
            <p className="font-bold">{pressure.label}</p>
            <p className="text-[11px] opacity-85 mt-0.5">{pressure.desc}</p>
          </div>
        </div>
      </div>

      {/* 5. 戰術透視開關 (Tactical Vision Overlay Toggle) */}
      <button
        type="button"
        onClick={onToggleTacticalVision}
        aria-pressed={tacticalVision}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
          tacticalVision
            ? 'bg-emerald-700/50 border-emerald-400 text-emerald-100 shadow-sm'
            : 'bg-stone-800 border-stone-600 text-stone-300 hover:bg-stone-700'
        }`}
      >
        <span className="flex items-center gap-2">
          {tacticalVision ? (
            <Eye className="w-4 h-4 text-emerald-300" />
          ) : (
            <EyeOff className="w-4 h-4 text-stone-400" />
          )}
          <span>戰術透視（熱圖・安定子・危險位）</span>
        </span>
        <kbd className="px-1.5 py-0.5 text-[10px] bg-stone-900/80 rounded border border-stone-600 text-stone-300 font-mono">
          T
        </kbd>
      </button>
    </aside>
  );
}

function CornerBadge({ pos, cell }: { pos: string; cell: Piece | null }): ReactElement {
  const isClaimed = cell !== null;
  return (
    <div
      className={`flex items-center justify-between px-2 py-1 rounded border text-[11px] ${
        isClaimed
          ? 'bg-amber-950/40 border-amber-500/70 shadow-[0_0_6px_rgba(251,191,36,0.3)]'
          : 'bg-stone-800/80 border-stone-700/60'
      }`}
    >
      <span
        className={`font-mono text-[10px] ${isClaimed ? 'text-amber-300 font-bold' : 'text-stone-300'}`}
      >
        {pos}
      </span>
      {cell === 'black' ? (
        <span className="flex items-center gap-1">
          <span
            className="w-3.5 h-3.5 rounded-full bg-stone-950 border border-stone-500 shadow-sm"
            title="黑方佔領要塞"
          />
          <span className="text-[9px] text-amber-300 font-black">★</span>
        </span>
      ) : cell === 'white' ? (
        <span className="flex items-center gap-1">
          <span
            className="w-3.5 h-3.5 rounded-full bg-white border border-stone-300 shadow-sm"
            title="白方佔領要塞"
          />
          <span className="text-[9px] text-amber-300 font-black">★</span>
        </span>
      ) : (
        <span
          className="w-3 h-3 rounded-full border border-dashed border-stone-500"
          title="尚未佔領"
        />
      )}
    </div>
  );
}
