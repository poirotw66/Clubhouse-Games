import React from 'react';
import {
  type Board,
  type Move,
  type CheckersTacticalAnalysis,
  isDarkSquare,
} from '../utils/checkersLogic';
import { type BoardTheme } from '../types/checkersThemes';
import { PieceView } from './PieceView';
import { ShatterFx, type ShatterEvent } from './ShatterFx';
import { CoronationOverlay, type CoronationEvent } from './CoronationOverlay';
import { TrajectoryOverlay } from './TrajectoryOverlay';

function sq(r: number, c: number): string {
  return `${r},${c}`;
}

export interface Board3DProps {
  board: Board;
  size: number;
  labels: string[];
  selected: [number, number] | null;
  focusedSquare: [number, number] | null;
  landingSet: Set<string>;
  pathSet: Set<string>;
  originSet: Set<string>;
  lastMovePathSet: Set<string>;
  lastMoveDest: string | null;
  hintPathSet: Set<string>;
  hintDest: string | null;
  captureFx: Set<string>;
  hopDest: string | null;
  mustCapture: boolean;
  is3D: boolean;
  theme: BoardTheme;
  showThreatLens: boolean;
  tactics: CheckersTacticalAnalysis;
  activeMove: Move | null;
  candidateMoves: Move[];
  shatterEvents: ShatterEvent[];
  coronationEvent: CoronationEvent | null;
  onCellClick: (r: number, c: number) => void;
  onCellFocus: (r: number, c: number) => void;
  boardRef: React.RefObject<HTMLDivElement | null>;
}

export function Board3D({
  board,
  size,
  labels,
  selected,
  focusedSquare,
  landingSet,
  pathSet,
  originSet,
  lastMovePathSet,
  lastMoveDest,
  hintPathSet,
  hintDest,
  captureFx,
  hopDest,
  mustCapture,
  is3D,
  theme,
  showThreatLens,
  tactics,
  activeMove,
  candidateMoves,
  shatterEvents,
  coronationEvent,
  onCellClick,
  onCellFocus,
  boardRef,
}: Board3DProps) {
  // Pre-calculate threat sets for O(1) cell lookup
  const threatenedPieceSet = React.useMemo(() => {
    const s = new Set<string>();
    if (showThreatLens) {
      for (const [r, c] of tactics.threatenedPieces) s.add(sq(r, c));
    }
    return s;
  }, [showThreatLens, tactics.threatenedPieces]);

  const oppThreatLandingSet = React.useMemo(() => {
    const s = new Set<string>();
    if (showThreatLens) {
      for (const [r, c] of tactics.oppLandingThreats) s.add(sq(r, c));
    }
    return s;
  }, [showThreatLens, tactics.oppLandingThreats]);

  const keystoneSet = React.useMemo(() => {
    const s = new Set<string>();
    if (showThreatLens) {
      for (const [r, c] of tactics.keystoneGuards) s.add(sq(r, c));
    }
    return s;
  }, [showThreatLens, tactics.keystoneGuards]);

  return (
    <div className="w-full max-w-[500px] flex flex-col items-center">
      {/* 3D Perspective Stage Container */}
      <div
        className={`
          ck-board-stage w-full relative transition-all duration-300
          ${is3D ? 'ck-board-stage--3d' : 'ck-board-stage--2d'}
        `}
      >
        {/* Luxury Hardwood Plinth & Beveled Frame */}
        <div
          ref={boardRef}
          data-ck-board
          className={`
            ck-board-plinth relative rounded-2xl overflow-hidden transition-all duration-300
            ${is3D ? 'ck-board-plinth--3d' : 'ck-board-plinth--2d'}
          `}
          style={{
            background: theme.rimBg,
            borderColor: theme.rimBorder,
            aspectRatio: '1',
          }}
        >
          {/* Solid Brass Filigree Corner Ornaments (Top-Left, Top-Right, Bottom-Left, Bottom-Right) */}
          <span className="ck-brass-corner ck-brass-corner--tl" aria-hidden>
            ⚜
          </span>
          <span className="ck-brass-corner ck-brass-corner--tr" aria-hidden>
            ⚜
          </span>
          <span className="ck-brass-corner ck-brass-corner--bl" aria-hidden>
            ⚜
          </span>
          <span className="ck-brass-corner ck-brass-corner--br" aria-hidden>
            ⚜
          </span>

          {/* Coordinate Rim Labels - Top Horizontal */}
          <div
            className="absolute top-1 left-7 right-7 grid pointer-events-none z-10"
            style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
            aria-hidden
          >
            {labels.map((l) => (
              <span
                key={l}
                className="text-center text-[10px] font-mono font-bold select-none"
                style={{ color: theme.rimAccent, opacity: 0.8 }}
              >
                {l}
              </span>
            ))}
          </div>

          {/* Coordinate Rim Labels - Left Vertical */}
          <div
            className="absolute top-7 bottom-7 left-1.5 flex flex-col justify-around w-4 pointer-events-none z-10"
            aria-hidden
          >
            {Array.from({ length: size }, (_, r) => (
              <span
                key={r}
                className="text-[10px] font-mono font-bold select-none text-center"
                style={{ color: theme.rimAccent, opacity: 0.8 }}
              >
                {size - r}
              </span>
            ))}
          </div>

          {/* Playable Grid Inset Area */}
          <div className="absolute inset-6 rounded-xl overflow-hidden shadow-2xl border border-black/40">
            <div
              className="grid w-full h-full relative"
              style={{
                gridTemplateColumns: `repeat(${size}, 1fr)`,
                gridTemplateRows: `repeat(${size}, 1fr)`,
                transformStyle: 'preserve-3d',
              }}
            >
              {Array.from({ length: size * size }, (_, i) => {
                const r = Math.floor(i / size);
                const c = i % size;
                const dark = isDarkSquare(r, c);
                const piece = board[r][c];
                const cellKey = sq(r, c);
                const isSelected = selected !== null && selected[0] === r && selected[1] === c;
                const isFocused =
                  focusedSquare !== null && focusedSquare[0] === r && focusedSquare[1] === c;
                const isLanding = dark && landingSet.has(cellKey);
                const isCapturer = mustCapture && originSet.has(cellKey);
                const isPath = dark && !isLanding && !isSelected && pathSet.has(cellKey);
                const isLastMovePath =
                  !isSelected && !isLanding && lastMovePathSet.has(cellKey);
                const isPieceDest = lastMoveDest === cellKey;
                const isHintPath = hintPathSet.has(cellKey);
                const isHintDest = hintDest === cellKey;
                const showFx = captureFx.has(cellKey);
                const isThreatenedPiece = piece !== null && threatenedPieceSet.has(cellKey);
                const isOppThreatLanding = oppThreatLandingSet.has(cellKey);
                const isKeystonePiece = piece !== null && keystoneSet.has(cellKey);

                return (
                  <button
                    key={cellKey}
                    type="button"
                    data-ck-cell={`${r},${c}`}
                    onClick={() => {
                      onCellFocus(r, c);
                      onCellClick(r, c);
                    }}
                    className={`
                      relative flex items-center justify-center touch-manipulation transition-colors duration-100
                      ${dark ? 'ck-square-dark' : 'ck-square-light'}
                      ${isFocused ? 'ck-square-focused' : ''}
                      ${isLanding ? 'ck-square-landing' : ''}
                      ${isSelected ? 'ck-square-selected' : ''}
                    `}
                    style={{
                      background: dark ? theme.darkSquare : theme.lightSquare,
                    }}
                    aria-label={
                      piece
                        ? `${piece.color} ${piece.king ? 'king' : 'man'} at ${labels[c]}${size - r}`
                        : dark
                          ? `Empty dark square ${labels[c]}${size - r}`
                          : `Light square ${labels[c]}${size - r}`
                    }
                  >
                    {/* Landing Square Beacon Indicator */}
                    {isLanding && !piece && (
                      <span className="ck-landing-beacon" aria-hidden />
                    )}

                    {/* Intermediate Path Waypoint */}
                    {isPath && !piece && (
                      <span
                        className="w-[22%] h-[22%] rounded-full bg-amber-400/70 pointer-events-none shadow-sm"
                        aria-hidden
                      />
                    )}

                    {/* Last Move Path Trail */}
                    {isLastMovePath && !piece && (
                      <span
                        className="w-[18%] h-[18%] rounded-full bg-amber-500/40 pointer-events-none shadow-sm"
                        aria-hidden
                      />
                    )}

                    {/* Hint Path Waypoint */}
                    {isHintPath && !piece && (
                      <span
                        className="w-[20%] h-[20%] rounded-full bg-sky-400/60 pointer-events-none shadow-sm"
                        aria-hidden
                      />
                    )}

                    {/* Opponent Jump Landing Danger Zone */}
                    {isOppThreatLanding && !piece && !isLanding && (
                      <span
                        className="ck-danger-crosshair"
                        title="敵方跳吃落點警戒區"
                        aria-hidden
                      >
                        🎯
                      </span>
                    )}

                    {/* Hint Destination Outline */}
                    {isHintDest && !isSelected && (
                      <span
                        className="absolute inset-0 ring-3 ring-sky-400 ring-inset pointer-events-none rounded-[2px]"
                        aria-hidden
                      />
                    )}

                    {/* Classic Capture Burst FX */}
                    {showFx && <span className="checkers-capture-fx" aria-hidden />}

                    {/* Tactile 3D / 2D Piece */}
                    {dark && piece && (
                      <PieceView
                        color={piece.color}
                        king={piece.king}
                        selected={isSelected}
                        capturer={isCapturer && !isSelected}
                        lastMoveDest={isPieceDest && !isSelected}
                        hopping={hopDest === cellKey}
                        threatened={isThreatenedPiece}
                        keystone={isKeystonePiece}
                        theme={theme}
                        is3D={is3D}
                      />
                    )}
                  </button>
                );
              })}

              {/* Trajectory Parabolic Jump Arcs */}
              <TrajectoryOverlay
                size={size}
                activeMove={activeMove}
                previewMoves={candidateMoves}
                is3D={is3D}
              />

              {/* Shatter Physics Particles and Floating Combo Stamps */}
              <ShatterFx events={shatterEvents} size={size} />

              {/* Golden Coronation Ceremony */}
              <CoronationOverlay event={coronationEvent} size={size} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
