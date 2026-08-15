import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Zap, X, Trophy, Map, ClipboardList, Heart } from 'lucide-react';
import { Bottle } from './Bottle';
import { Background } from './Background';
import { BottleData, Color } from '../types';
import { createLayer } from '../services/gameLogic';
import { loadCoins, saveCoins } from '../services/economyService';
import { useDailyMissions } from '../hooks/useDailyMissions';
import { useDailyMissionsModal } from '../hooks/useDailyMissionsModal';
import { getSavedBackground } from '../utils/backgrounds';
import { DailyMissions } from './DailyMissions';
import { INITIAL_COINS, loadQpBestMoves, QP_DIFFICULTY_LABELS, type QpDifficultyId } from '../constants';

const QP_OPTIONS: {
  id: QpDifficultyId;
  level: number;
  subLabel: string;
  color: string;
}[] = [
  { id: 'EASY', level: 4, subLabel: '3 色・容量 4・少量 ?', color: 'bg-green-500' },
  { id: 'MEDIUM', level: 9, subLabel: '4 色・容量 5・較多 ?', color: 'bg-yellow-500' },
  { id: 'HARD', level: 15, subLabel: '5 色・容量 6・大量 ?', color: 'bg-orange-500' },
  { id: 'EXPERT', level: 25, subLabel: '6 色・容量 6・最多 ?', color: 'bg-red-600' },
];

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);

    // --- Missions & Coins State ---
    const [coins, setCoins] = useState<number>(() => loadCoins(INITIAL_COINS));
    const { missions, hasNotifications, claimMission } = useDailyMissions({ currentCoins: coins });
    const { isOpen: isMissionModalOpen, open: openMissionModal, close: closeMissionModal } = useDailyMissionsModal();

    const handleClaimMission = (missionId: string) => {
        const coinsDelta = claimMission(missionId);
        if (coinsDelta > 0) {
            const newCoins = coins + coinsDelta;
            setCoins(newCoins);
            saveCoins(newCoins);
        }
    };

  // Get saved level for "Continue" text
  const savedLevel = parseInt(localStorage.getItem('mls_level') || '1', 10);
  const qpBests = useMemo(() => loadQpBestMoves(), [showDifficultyModal]);

  // Decorative bottles data
  const decorativeBottles: BottleData[] = [
    {
        id: 'dec-1',
        capacity: 4,
        isCompleted: true,
        layers: [
            createLayer(Color.PURPLE),
            createLayer(Color.PURPLE),
            createLayer(Color.PURPLE),
            createLayer(Color.PURPLE)
        ]
    },
    {
        id: 'dec-2',
        capacity: 4,
        isCompleted: false,
        layers: [
            createLayer(Color.BLUE),
            createLayer(Color.RED),
            createLayer(Color.YELLOW),
            createLayer(Color.GREEN)
        ]
    },
    {
        id: 'dec-3',
        capacity: 4,
        isCompleted: true,
        layers: [
            createLayer(Color.CYAN),
            createLayer(Color.CYAN),
            createLayer(Color.CYAN),
            createLayer(Color.CYAN)
        ]
    }
  ];

  const handleAdventureClick = () => {
      navigate('/game', { state: { mode: 'adventure' } });
  };

  const handleQuickPlayClick = (difficultyLevel: number, id: QpDifficultyId) => {
      navigate('/game', { state: { mode: 'quick_play', difficultyLevel, difficultyLabel: id } });
  };

  // Get saved background preference
  const currentBackground = useMemo(() => getSavedBackground(), []);

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center text-white overflow-hidden font-sans">
        
        {/* Dynamic Background */}
        <Background background={currentBackground} />

        {/* --- Top Right UI (Coins & Missions) - Mobile Optimized --- */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-50 flex items-center gap-2 md:gap-3 safe-top safe-right">
             {/* Coins Badge */}
             <div className="flex items-center bg-black/30 backdrop-blur-md rounded-full pl-1 md:pl-1.5 pr-3 md:pr-4 py-1 md:py-1.5 border border-white/10 shadow-lg animate-fade-in-down">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full flex items-center justify-center mr-1.5 md:mr-2 shadow-inner border border-yellow-200">
                   <Heart className="w-3.5 h-3.5 md:w-4 md:h-4 text-white fill-white drop-shadow-sm" />
                </div>
                <span className="text-white font-bold text-base md:text-lg tabular-nums tracking-wide">{coins}</span>
              </div>

              {/* Missions Button */}
              <button 
                  onClick={openMissionModal}
                  className="touch-target w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg border border-white/20 relative active:scale-95 transition-transform animate-fade-in-down touch-active"
                  style={{ animationDelay: '0.1s' }}
                  aria-label="每日任務"
              >
                  <ClipboardList size={20} className="md:w-5 md:h-5" />
                  {hasNotifications && (
                      <span className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#1a1a2e] animate-pulse"></span>
                  )}
              </button>
        </div>

        <div className="z-10 flex flex-col items-center space-y-8 w-full max-w-md px-4">
            
            {/* Title Section - Mobile Optimized */}
            <div className="text-center space-y-1 md:space-y-2 animate-fade-in-down px-2">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] tracking-tight">
                    神秘液體排序
                </h1>
                <h2 className="text-sm md:text-base font-bold text-white/70 tracking-[0.2em] drop-shadow-md">
                    MYSTERY LIQUID SORT
                </h2>
            </div>

            {/* Visual Showcase (Smaller on mobile) */}
            <div className="flex items-end justify-center gap-6 py-4 animate-float scale-75 md:scale-100">
                <div className="transform scale-90 -rotate-6 opacity-80 blur-[1px]">
                     <Bottle bottle={decorativeBottles[0]} isSelected={false} onClick={() => {}} />
                </div>
                <div className="transform scale-110 z-10 drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]">
                    <Bottle bottle={decorativeBottles[1]} isSelected={false} onClick={() => {}} />
                </div>
                <div className="transform scale-90 rotate-6 opacity-80 blur-[1px]">
                    <Bottle bottle={decorativeBottles[2]} isSelected={false} onClick={() => {}} />
                </div>
            </div>

            {/* Main Action Buttons */}
            <div className="w-full space-y-4 animate-fade-in-up">
                
                {/* Adventure Mode Button - Mobile Optimized */}
                <button 
                    onClick={handleAdventureClick}
                    className="touch-target w-full group relative px-4 md:px-6 py-4 md:py-5 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl md:rounded-2xl flex items-center justify-between shadow-[0_3px_0_#1e3a8a] md:shadow-[0_4px_0_#1e3a8a] active:shadow-none active:translate-y-0.5 md:active:translate-y-1 transition-all touch-active"
                >
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="bg-white/20 p-2.5 md:p-3 rounded-lg md:rounded-xl">
                            <Map className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-lg md:text-xl font-bold tracking-wide text-white">冒險模式</span>
                            <span className="text-blue-200 text-[10px] md:text-xs">
                                {savedLevel > 1 ? `繼續第 ${savedLevel} 關` : '開始旅程'}
                            </span>
                        </div>
                    </div>
                    <Play className="w-5 h-5 md:w-6 md:h-6 text-white/50 group-active:text-white transition-colors" />
                </button>

                {/* Quick Play Button - Mobile Optimized */}
                <button 
                    onClick={() => setShowDifficultyModal(true)}
                    className="touch-target w-full group relative px-4 md:px-6 py-4 md:py-5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl md:rounded-2xl flex items-center justify-between shadow-[0_3px_0_#047857] md:shadow-[0_4px_0_#047857] active:shadow-none active:translate-y-0.5 md:active:translate-y-1 transition-all touch-active"
                >
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="bg-white/20 p-2.5 md:p-3 rounded-lg md:rounded-xl">
                            <Zap className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-lg md:text-xl font-bold tracking-wide text-white">快速遊玩</span>
                            <span className="text-emerald-100 text-[10px] md:text-xs">選擇難度</span>
                        </div>
                    </div>
                    <Play className="w-5 h-5 md:w-6 md:h-6 text-white/50 group-active:text-white transition-colors" />
                </button>

            </div>

            {/* Footer */}
            <div className="absolute bottom-4 text-white/20 text-xs">
                v1.1.0
            </div>
        </div>

        {/* --- MODALS --- */}
        
        {/* Daily Missions Modal */}
        <DailyMissions 
            isOpen={isMissionModalOpen}
            onClose={closeMissionModal}
            missions={missions}
            onClaim={handleClaimMission}
        />

        {/* Difficulty Selection Modal */}
        {showDifficultyModal && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mls-diff-title"
            >
                <div className="w-full max-w-sm bg-[#2d2d44] border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    
                    {/* Close Button */}
                    <button 
                        type="button"
                        onClick={() => setShowDifficultyModal(false)}
                        className="absolute top-4 right-4 min-h-[44px] min-w-[44px] text-white/40 hover:text-white transition-colors touch-manipulation"
                        aria-label="關閉"
                    >
                        <X size={24} />
                    </button>

                    <h3 id="mls-diff-title" className="text-2xl font-black text-white mb-6 text-center">選擇難度</h3>

                    <div className="space-y-3">
                        {QP_OPTIONS.map((opt) => (
                          <DifficultyOption
                            key={opt.id}
                            label={QP_DIFFICULTY_LABELS[opt.id]}
                            subLabel={opt.subLabel}
                            color={opt.color}
                            bestMoves={qpBests[opt.id]}
                            onClick={() => handleQuickPlayClick(opt.level, opt.id)}
                          />
                        ))}
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

const DifficultyOption: React.FC<{ 
    label: string, 
    subLabel: string, 
    color: string,
    bestMoves?: number,
    onClick: () => void 
}> = ({ label, subLabel, color, bestMoves, onClick }) => (
    <button 
        onClick={onClick}
        className="w-full group flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all active:scale-95"
    >
        <div className="flex items-center gap-4">
            <div className={`w-3 h-12 rounded-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}></div>
            <div className="text-left">
                <div className="text-lg font-bold text-white group-hover:text-yellow-300 transition-colors">{label}</div>
                <div className="text-xs text-white/40 font-mono">{subLabel}</div>
                {bestMoves != null && bestMoves > 0 && (
                  <div className="text-[10px] text-emerald-300/80 mt-0.5">
                    最佳 {bestMoves} 步
                  </div>
                )}
            </div>
        </div>
        <Trophy size={18} className="text-white/20 group-hover:text-white/80 transition-colors" />
    </button>
);