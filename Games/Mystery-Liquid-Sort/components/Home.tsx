import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Zap, X, Trophy, Map, ClipboardList, Heart, Layers, Lock, Check, FlaskConical, Timer, Footprints, BookOpen } from 'lucide-react';
import { Bottle } from './Bottle';
import { Background } from './Background';
import { BottleData, Color, type QpVariant } from '../types';
import { createLayer } from '../services/gameLogic';
import { loadCoins, saveCoins } from '../services/economyService';
import { useDailyMissions } from '../hooks/useDailyMissions';
import { useDailyMissionsModal } from '../hooks/useDailyMissionsModal';
import { getSavedBackground } from '../utils/backgrounds';
import { DailyMissions } from './DailyMissions';
import {
  FirstRunGuide,
  hasSeenFirstRunGuide,
} from './FirstRunGuide';
import {
  INITIAL_COINS,
  loadQpBestMoves,
  QP_DIFFICULTY_LABELS,
  QP_MOVE_LIMITS,
  QP_TIME_LIMITS_SEC,
  qpVariantStorageId,
  type QpDifficultyId,
} from '../constants';
import {
  PUZZLE_PACK_STAGES,
  continuePackIndex,
  isPackStageUnlocked,
  loadPackProgress,
  packStageCount,
} from '../services/puzzlePack';
import {
  MIX_CHALLENGE_STAGES,
  continueMixIndex,
  isMixStageUnlocked,
  loadMixProgress,
  mixStageCount,
} from '../services/mixChallengePack';

const QP_OPTIONS: {
  id: QpDifficultyId;
  level: number;
  subLabel: string;
  color: string;
}[] = [
  { id: 'EASY', level: 4, subLabel: '3–4 色・容量 4・混色初開', color: 'bg-green-500' },
  { id: 'MEDIUM', level: 9, subLabel: '4 色・容量 5・較多 ?', color: 'bg-yellow-500' },
  { id: 'HARD', level: 15, subLabel: '5–6 色・容量 6・必混', color: 'bg-orange-500' },
  { id: 'EXPERT', level: 25, subLabel: '6–7 色・容量 6・最多 ?', color: 'bg-red-600' },
];

const QP_VARIANT_OPTIONS: { id: QpVariant; label: string; blurb: string; icon: 'zap' | 'steps' | 'timer' }[] = [
  { id: 'normal', label: '自由', blurb: '無倒次／時間上限', icon: 'zap' },
  { id: 'moves', label: '限步', blurb: '倒次上限・分軌最佳', icon: 'steps' },
  { id: 'timed', label: '限時', blurb: '倒數交單・分軌最佳', icon: 'timer' },
];

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [showPackModal, setShowPackModal] = useState(false);
  const [showMixModal, setShowMixModal] = useState(false);
  const [qpVariant, setQpVariant] = useState<QpVariant>('normal');
  const [showFirstRun, setShowFirstRun] = useState(() => !hasSeenFirstRunGuide());

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
  const packProgress = useMemo(() => loadPackProgress(), [showPackModal]);
  const packTotal = packStageCount();
  const packContinue = continuePackIndex(packProgress.clearedCount);
  const packSubtitle =
    packProgress.clearedCount >= packTotal
      ? `已完成 ${packTotal}/${packTotal}`
      : packProgress.clearedCount > 0
        ? `進度 ${packProgress.clearedCount}/${packTotal}・繼續`
        : `手編 ${packTotal} 關・開始`;

  const mixProgress = useMemo(() => loadMixProgress(), [showMixModal]);
  const mixTotal = mixStageCount();
  const mixContinue = continueMixIndex(mixProgress.clearedCount);
  const mixSubtitle =
    mixProgress.clearedCount >= mixTotal
      ? `已完成 ${mixTotal}/${mixTotal}`
      : mixProgress.clearedCount > 0
        ? `進度 ${mixProgress.clearedCount}/${mixTotal}・繼續`
        : `必混 ${mixTotal} 關・開始`;

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
      const storageId =
        qpVariant === 'normal' ? id : qpVariantStorageId(id, qpVariant);
      navigate('/game', {
        state: {
          mode: 'quick_play',
          difficultyLevel,
          difficultyLabel: storageId,
          qpVariant,
          moveLimit: qpVariant === 'moves' ? QP_MOVE_LIMITS[id] : undefined,
          timeLimitSec: qpVariant === 'timed' ? QP_TIME_LIMITS_SEC[id] : undefined,
        },
      });
  };

  const handlePackStageClick = (stageIndex: number) => {
      if (!isPackStageUnlocked(stageIndex, packProgress.clearedCount)) return;
      navigate('/game', { state: { mode: 'puzzle_pack', packStageIndex: stageIndex } });
  };

  const handleMixStageClick = (stageIndex: number) => {
      if (!isMixStageUnlocked(stageIndex, mixProgress.clearedCount)) return;
      navigate('/game', { state: { mode: 'mix_challenge', mixStageIndex: stageIndex } });
  };

  const handleMixTutorial = () => {
      navigate('/game', { state: { mode: 'mix_challenge', mixStageIndex: 0 } });
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

              <button
                  type="button"
                  onClick={() => setShowFirstRun(true)}
                  className="touch-target w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white shadow-lg border border-white/20 relative active:scale-95 transition-transform animate-fade-in-down touch-active"
                  style={{ animationDelay: '0.05s' }}
                  aria-label="遊戲說明"
              >
                  <BookOpen size={20} className="md:w-5 md:h-5" />
              </button>

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

        <div className="z-10 flex flex-col items-center space-y-6 w-full max-w-md px-4 overflow-y-auto max-h-[100dvh] py-16 no-scrollbar">
            
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
            <div className="flex items-end justify-center gap-6 py-2 animate-float scale-75 md:scale-100">
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
            <div className="w-full space-y-3 animate-fade-in-up">
                
                {/* Adventure Mode Button - Mobile Optimized */}
                <button 
                    type="button"
                    onClick={handleAdventureClick}
                    aria-label="冒險模式"
                    className="touch-target w-full group relative px-4 md:px-6 py-4 md:py-5 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl md:rounded-2xl flex items-center justify-between shadow-[0_3px_0_#1e3a8a] md:shadow-[0_4px_0_#1e3a8a] active:shadow-none active:translate-y-0.5 md:active:translate-y-1 transition-all touch-active"
                >
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="bg-white/20 p-2.5 md:p-3 rounded-lg md:rounded-xl">
                            <Map className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-lg md:text-xl font-bold tracking-wide text-white">冒險模式</span>
                            <span className="text-blue-200 text-[10px] md:text-xs">
                                {savedLevel > 1 ? `繼續第 ${savedLevel} 關` : '開始旅程・第 4 關起混色'}
                            </span>
                        </div>
                    </div>
                    <Play className="w-5 h-5 md:w-6 md:h-6 text-white/50 group-active:text-white transition-colors" />
                </button>

                {/* Quick Play Button - Mobile Optimized */}
                <button 
                    type="button"
                    onClick={() => setShowDifficultyModal(true)}
                    aria-label="快速遊玩"
                    className="touch-target w-full group relative px-4 md:px-6 py-4 md:py-5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl md:rounded-2xl flex items-center justify-between shadow-[0_3px_0_#047857] md:shadow-[0_4px_0_#047857] active:shadow-none active:translate-y-0.5 md:active:translate-y-1 transition-all touch-active"
                >
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="bg-white/20 p-2.5 md:p-3 rounded-lg md:rounded-xl">
                            <Zap className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-lg md:text-xl font-bold tracking-wide text-white">快速遊玩</span>
                            <span className="text-emerald-100 text-[10px] md:text-xs">難度・限步／限時挑戰</span>
                        </div>
                    </div>
                    <Play className="w-5 h-5 md:w-6 md:h-6 text-white/50 group-active:text-white transition-colors" />
                </button>

                {/* Mix Challenge Pack */}
                <button
                    type="button"
                    onClick={() => setShowMixModal(true)}
                    className="touch-target w-full group relative px-4 md:px-6 py-4 md:py-5 bg-gradient-to-r from-orange-500 to-rose-600 rounded-xl md:rounded-2xl flex items-center justify-between shadow-[0_3px_0_#9a3412] md:shadow-[0_4px_0_#9a3412] active:shadow-none active:translate-y-0.5 md:active:translate-y-1 transition-all touch-active"
                    aria-label="混合墨水挑戰"
                >
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="bg-white/20 p-2.5 md:p-3 rounded-lg md:rounded-xl">
                            <FlaskConical className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-lg md:text-xl font-bold tracking-wide text-white">混合墨水挑戰</span>
                            <span className="text-orange-100 text-[10px] md:text-xs">{mixSubtitle}</span>
                        </div>
                    </div>
                    <Play className="w-5 h-5 md:w-6 md:h-6 text-white/50 group-active:text-white transition-colors" />
                </button>

                {/* Puzzle Pack Button */}
                <button
                    type="button"
                    onClick={() => setShowPackModal(true)}
                    className="touch-target w-full group relative px-4 md:px-6 py-4 md:py-5 bg-gradient-to-r from-violet-500 to-fuchsia-600 rounded-xl md:rounded-2xl flex items-center justify-between shadow-[0_3px_0_#6b21a8] md:shadow-[0_4px_0_#6b21a8] active:shadow-none active:translate-y-0.5 md:active:translate-y-1 transition-all touch-active"
                    aria-label="關卡包"
                >
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="bg-white/20 p-2.5 md:p-3 rounded-lg md:rounded-xl">
                            <Layers className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-lg md:text-xl font-bold tracking-wide text-white">關卡包</span>
                            <span className="text-violet-100 text-[10px] md:text-xs">{packSubtitle}</span>
                        </div>
                    </div>
                    <Play className="w-5 h-5 md:w-6 md:h-6 text-white/50 group-active:text-white transition-colors" />
                </button>

            </div>

            {/* Footer */}
            <div className="text-white/20 text-xs pb-2">
                v1.2.0
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

        {showFirstRun && (
          <FirstRunGuide
            onClose={() => setShowFirstRun(false)}
            onStartMixTutorial={handleMixTutorial}
          />
        )}

        {/* Difficulty Selection Modal */}
        {showDifficultyModal && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mls-diff-title"
            >
                <div className="w-full max-w-sm bg-[#2d2d44] border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden max-h-[85vh] flex flex-col">
                    
                    {/* Close Button */}
                    <button 
                        type="button"
                        onClick={() => setShowDifficultyModal(false)}
                        className="absolute top-4 right-4 min-h-[44px] min-w-[44px] text-white/40 hover:text-white transition-colors touch-manipulation z-10"
                        aria-label="關閉"
                    >
                        <X size={24} />
                    </button>

                    <h3 id="mls-diff-title" className="text-2xl font-black text-white mb-2 text-center">選擇難度</h3>

                    <div className="flex gap-2 mb-4">
                      {QP_VARIANT_OPTIONS.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setQpVariant(v.id)}
                          className={`flex-1 rounded-xl px-2 py-2 border text-center transition-all min-h-[44px] ${
                            qpVariant === v.id
                              ? 'bg-emerald-500/30 border-emerald-400/50 text-white'
                              : 'bg-white/5 border-white/10 text-white/60'
                          }`}
                          aria-pressed={qpVariant === v.id}
                          aria-label={v.label}
                        >
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            {v.icon === 'timer' ? <Timer size={14} /> : v.icon === 'steps' ? <Footprints size={14} /> : <Zap size={14} />}
                            <span className="text-xs font-bold">{v.label}</span>
                          </div>
                          <div className="text-[9px] opacity-70 leading-tight">{v.blurb}</div>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                        {QP_OPTIONS.map((opt) => {
                          const bestKey =
                            qpVariant === 'normal' ? opt.id : qpVariantStorageId(opt.id, qpVariant);
                          const limitBlurb =
                            qpVariant === 'moves'
                              ? `上限 ${QP_MOVE_LIMITS[opt.id]} 步`
                              : qpVariant === 'timed'
                                ? `${QP_TIME_LIMITS_SEC[opt.id]} 秒`
                                : opt.subLabel;
                          return (
                            <DifficultyOption
                              key={`${opt.id}-${qpVariant}`}
                              label={QP_DIFFICULTY_LABELS[opt.id]}
                              subLabel={limitBlurb}
                              color={opt.color}
                              bestMoves={qpBests[bestKey]}
                              onClick={() => handleQuickPlayClick(opt.level, opt.id)}
                            />
                          );
                        })}
                    </div>
                </div>
            </div>
        )}

        {/* Mix Challenge Stage List */}
        {showMixModal && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mls-mix-title"
            >
                <div className="w-full max-w-sm bg-[#2d2d44] border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden max-h-[85vh] flex flex-col">
                    <button
                        type="button"
                        onClick={() => setShowMixModal(false)}
                        className="absolute top-4 right-4 min-h-[44px] min-w-[44px] text-white/40 hover:text-white transition-colors touch-manipulation z-10"
                        aria-label="關閉"
                    >
                        <X size={24} />
                    </button>

                    <h3 id="mls-mix-title" className="text-2xl font-black text-white mb-1 text-center">混合墨水挑戰</h3>
                    <p className="text-center text-white/50 text-xs mb-4">
                      必混配方關・進度獨立（不覆寫關卡包）
                    </p>

                    <button
                      type="button"
                      onClick={() => handleMixStageClick(mixContinue)}
                      className="mb-4 w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 font-bold text-white shadow-lg active:scale-[0.98] transition-transform"
                    >
                      {mixProgress.clearedCount >= mixTotal ? '重玩最終關' : mixProgress.clearedCount > 0 ? `繼續・${MIX_CHALLENGE_STAGES[mixContinue]?.name}` : '開始第一關'}
                    </button>

                    <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                      {MIX_CHALLENGE_STAGES.map((stage, index) => {
                        const unlocked = isMixStageUnlocked(index, mixProgress.clearedCount);
                        const cleared = index < mixProgress.clearedCount;
                        const best = mixProgress.bestMoves[stage.id];
                        return (
                          <button
                            key={stage.id}
                            type="button"
                            disabled={!unlocked}
                            onClick={() => handleMixStageClick(index)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left
                              ${unlocked
                                ? 'bg-white/5 hover:bg-white/10 border-white/10 active:scale-[0.98]'
                                : 'bg-black/20 border-white/5 opacity-50 cursor-not-allowed'}
                            `}
                            aria-label={`${stage.name}${unlocked ? '' : '（未解鎖）'}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cleared ? 'bg-emerald-500/30 text-emerald-300' : unlocked ? 'bg-orange-500/30 text-orange-200' : 'bg-white/5 text-white/30'}`}>
                                {cleared ? <Check size={16} /> : unlocked ? <span className="text-xs font-black">{index + 1}</span> : <Lock size={14} />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-white truncate">{stage.name}</div>
                                <div className="text-[10px] text-white/40 font-mono truncate">{stage.blurb}</div>
                                {best != null && (
                                  <div className="text-[10px] text-emerald-300/80 mt-0.5">最佳 {best} 步</div>
                                )}
                              </div>
                            </div>
                            {unlocked && <Play size={16} className="text-white/30 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                </div>
            </div>
        )}

        {/* Puzzle Pack Stage List */}
        {showPackModal && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mls-pack-title"
            >
                <div className="w-full max-w-sm bg-[#2d2d44] border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden max-h-[85vh] flex flex-col">
                    <button
                        type="button"
                        onClick={() => setShowPackModal(false)}
                        className="absolute top-4 right-4 min-h-[44px] min-w-[44px] text-white/40 hover:text-white transition-colors touch-manipulation z-10"
                        aria-label="關閉"
                    >
                        <X size={24} />
                    </button>

                    <h3 id="mls-pack-title" className="text-2xl font-black text-white mb-1 text-center">關卡包</h3>
                    <p className="text-center text-white/50 text-xs mb-4">
                      手編固定盤面・進度獨立於冒險／快速遊玩
                    </p>

                    <button
                      type="button"
                      onClick={() => handlePackStageClick(packContinue)}
                      className="mb-4 w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 font-bold text-white shadow-lg active:scale-[0.98] transition-transform"
                    >
                      {packProgress.clearedCount >= packTotal ? '重玩最終關' : packProgress.clearedCount > 0 ? `繼續・${PUZZLE_PACK_STAGES[packContinue]?.name}` : '開始第一關'}
                    </button>

                    <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                      {PUZZLE_PACK_STAGES.map((stage, index) => {
                        const unlocked = isPackStageUnlocked(index, packProgress.clearedCount);
                        const cleared = index < packProgress.clearedCount;
                        const best = packProgress.bestMoves[stage.id];
                        return (
                          <button
                            key={stage.id}
                            type="button"
                            disabled={!unlocked}
                            onClick={() => handlePackStageClick(index)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left
                              ${unlocked
                                ? 'bg-white/5 hover:bg-white/10 border-white/10 active:scale-[0.98]'
                                : 'bg-black/20 border-white/5 opacity-50 cursor-not-allowed'}
                            `}
                            aria-label={`${stage.name}${unlocked ? '' : '（未解鎖）'}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cleared ? 'bg-emerald-500/30 text-emerald-300' : unlocked ? 'bg-violet-500/30 text-violet-200' : 'bg-white/5 text-white/30'}`}>
                                {cleared ? <Check size={16} /> : unlocked ? <span className="text-xs font-black">{index + 1}</span> : <Lock size={14} />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-white truncate">{stage.name}</div>
                                <div className="text-[10px] text-white/40 font-mono truncate">{stage.blurb}</div>
                                {best != null && (
                                  <div className="text-[10px] text-emerald-300/80 mt-0.5">最佳 {best} 步</div>
                                )}
                              </div>
                            </div>
                            {unlocked && <Play size={16} className="text-white/30 flex-shrink-0" />}
                          </button>
                        );
                      })}
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
