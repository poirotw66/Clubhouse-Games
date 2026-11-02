import { useState, type ReactElement } from 'react';
import { Activity, Compass, Eye, EyeOff, Sparkles, X } from 'lucide-react';
import type { Board, Piece, Difficulty } from '../utils/reversiLogic';
import type { SeriesMatch } from '../utils/match';
import type { OpponentDef } from '../utils/opponents';
import type { PuzzleRuntime } from '../utils/puzzles';
import { calculateCornerControl, calculateMobility } from '../utils/tactics';
import { TacticalLeftWing } from './TacticalLeftWing';
import { TacticalRightWing } from './TacticalRightWing';

export interface TacticalCapsuleBarProps {
  board: Board;
  currentTurn: Piece;
  blackCount: number;
  whiteCount: number;
  tacticalVision: boolean;
  onToggleTacticalVision: () => void;
  playMode: 'two' | 'bot' | 'ladder' | 'puzzle';
  playerSide: Piece;
  difficulty: Difficulty;
  activeOpponent?: OpponentDef;
  series: SeriesMatch | null;
  puzzle: PuzzleRuntime | null;
  puzzlePlies: number;
  onOpenShortcuts: () => void;
}

export function TacticalCapsuleBar({
  board,
  currentTurn,
  blackCount,
  whiteCount,
  tacticalVision,
  onToggleTacticalVision,
  playMode,
  playerSide,
  difficulty,
  activeOpponent,
  series,
  puzzle,
  puzzlePlies,
  onOpenShortcuts,
}: TacticalCapsuleBarProps): ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const corners = calculateCornerControl(board);
  const mobility = calculateMobility(board, currentTurn);

  return (
    <>
      {/* Mobile/Tablet Tactical Capsule Dock */}
      <div className="w-full max-w-lg lg:hidden flex items-center justify-between gap-1.5 p-2 bg-stone-900/90 backdrop-blur-md border border-emerald-800/40 rounded-xl text-xs mb-3 shadow-md">
        {/* Disc Count Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-950/80 rounded-lg border border-stone-800">
          <span className="w-2.5 h-2.5 rounded-full bg-stone-900 border border-stone-500" />
          <span className="font-mono font-bold text-stone-200">{blackCount}</span>
          <span className="text-stone-500">:</span>
          <span className="font-mono font-bold text-stone-200">{whiteCount}</span>
          <span className="w-2.5 h-2.5 rounded-full bg-stone-100 border border-stone-300" />
        </div>

        {/* Corners Pill */}
        <div className="flex items-center gap-1 px-2 py-1 bg-stone-950/80 rounded-lg border border-stone-800 text-[11px] text-amber-300">
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-mono">
            角 {corners.black + corners.white}/4
          </span>
        </div>

        {/* Mobility Pill */}
        <div className="flex items-center gap-1 px-2 py-1 bg-stone-950/80 rounded-lg border border-stone-800 text-[11px] text-sky-300">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-mono">
            機動 {mobility.currentLegalCount}
          </span>
        </div>

        {/* Quick Tactical Vision Toggle */}
        <button
          type="button"
          onClick={onToggleTacticalVision}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
            tacticalVision
              ? 'bg-emerald-700/60 border-emerald-400 text-emerald-100'
              : 'bg-stone-800 border-stone-600 text-stone-400'
          }`}
          title="切換戰術透視熱圖"
        >
          {tacticalVision ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>透視</span>
        </button>

        {/* Full Briefing Drawer Trigger */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-600/50 text-[11px] font-medium text-emerald-200 transition-colors"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>戰情</span>
        </button>
      </div>

      {/* Slide-over Mobile Tactical Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tactical-drawer-title"
        >
          <div className="w-full max-w-md h-full bg-stone-950 border-l border-emerald-800/50 flex flex-col overflow-hidden text-left shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-800 bg-stone-900/80">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <h2 id="tactical-drawer-title" className="text-base font-bold text-emerald-300">
                  黑白棋戰術情報作戰室
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 transition-colors"
                aria-label="關閉戰情作戰室"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <TacticalLeftWing
                board={board}
                currentTurn={currentTurn}
                blackCount={blackCount}
                whiteCount={whiteCount}
                tacticalVision={tacticalVision}
                onToggleTacticalVision={onToggleTacticalVision}
              />

              <TacticalRightWing
                playMode={playMode}
                playerSide={playerSide}
                difficulty={difficulty}
                activeOpponent={activeOpponent}
                series={series}
                puzzle={puzzle}
                puzzlePlies={puzzlePlies}
                onOpenShortcuts={() => {
                  setDrawerOpen(false);
                  onOpenShortcuts();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
