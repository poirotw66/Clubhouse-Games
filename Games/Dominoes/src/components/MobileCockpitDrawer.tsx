import { useState } from 'react';
import type {
  Difficulty,
  DominoesState,
  EndId,
  MatchState,
  RuleVariant,
} from '../utils/dominoesLogic';
import type { GameMode } from '../utils/storage';
import { CockpitLeftWing } from './CockpitLeftWing';
import { CockpitRightWing } from './CockpitRightWing';
import type { PipDisplayMode, TileCraftTheme } from './DominoTile';
import {
  Activity,
  UserCheck,
  X,
} from 'lucide-react';

interface MobileCockpitDrawerProps {
  state: DominoesState;
  match: MatchState;
  gameMode: GameMode;
  difficulty: Difficulty;
  ruleVariant: RuleVariant;
  streak: number;
  onSelectPlay?: (tileId: number, end: EndId) => void;
  selectedTileId: number | null;
  craft?: TileCraftTheme;
  onChangeCraft?: (craft: TileCraftTheme) => void;
  pipMode?: PipDisplayMode;
  onChangePipMode?: (mode: PipDisplayMode) => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

type MobileTab = 'radar' | 'dossier';

export function MobileCockpitDrawer({
  state,
  match,
  gameMode,
  difficulty,
  ruleVariant,
  streak,
  onSelectPlay,
  selectedTileId,
  craft,
  onChangeCraft,
  pipMode,
  onChangePipMode,
  isMuted,
  onToggleMute,
}: MobileCockpitDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MobileTab>('radar');

  const openDrawer = (tab: MobileTab) => {
    setActiveTab(tab);
    setIsOpen(true);
  };

  const handleSelectPlayInDrawer = (tileId: number, end: EndId) => {
    onSelectPlay?.(tileId, end);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Capsule Bar */}
      <div className="lg:hidden w-full max-w-md my-2 flex items-center justify-center gap-2 px-2 text-xs">
        <button
          type="button"
          onClick={() => openDrawer('radar')}
          className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-sky-500/40 bg-slate-900/80 backdrop-blur-md text-sky-200 hover:bg-slate-800 touch-manipulation transition-colors shadow-sm"
        >
          <Activity className="w-4 h-4 text-sky-400" />
          <span className="font-semibold">情資雷達 / 矩陣</span>
        </button>

        <button
          type="button"
          onClick={() => openDrawer('dossier')}
          className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/40 bg-slate-900/80 backdrop-blur-md text-amber-200 hover:bg-slate-800 touch-manipulation transition-colors shadow-sm"
        >
          <UserCheck className="w-4 h-4 text-amber-400" />
          <span className="font-semibold">對手情報 / 錦囊</span>
        </button>
      </div>

      {/* Slide-up Drawer Modal */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl max-h-[85vh] flex flex-col p-4 shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('radar')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'radar'
                      ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  牌局情資雷達
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('dossier')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'dossier'
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  對手戰情檔案
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                aria-label="關閉情報面板"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="overflow-y-auto py-3">
              {activeTab === 'radar' ? (
                <CockpitLeftWing
                  state={state}
                  ruleVariant={ruleVariant}
                  onSelectPlay={handleSelectPlayInDrawer}
                  selectedTileId={selectedTileId}
                  craft={craft}
                  onChangeCraft={onChangeCraft}
                  pipMode={pipMode}
                  onChangePipMode={onChangePipMode}
                  isMuted={isMuted}
                  onToggleMute={onToggleMute}
                />
              ) : (
                <CockpitRightWing
                  state={state}
                  match={match}
                  gameMode={gameMode}
                  difficulty={difficulty}
                  streak={streak}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
