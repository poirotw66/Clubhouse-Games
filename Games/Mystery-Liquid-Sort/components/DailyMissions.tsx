import React from 'react';
import { DailyMission } from '../types';
import { Check, Gift, X, Star } from 'lucide-react';
import { sounds } from '../utils/sound';
import { useLocale } from '../context/LocaleContext';
import { t } from '../utils/i18n';

interface DailyMissionsProps {
  isOpen: boolean;
  onClose: () => void;
  missions: DailyMission[];
  onClaim: (missionId: string) => void;
}

export const DailyMissions: React.FC<DailyMissionsProps> = ({ isOpen, onClose, missions, onClaim }) => {
  const { locale } = useLocale();
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 px-3 md:px-4 safe-top safe-bottom safe-left safe-right">
      <div className="w-full max-w-sm bg-[#2d2d44] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh] md:max-h-[80vh]">
        
        {/* Header - Mobile Optimized */}
        <div className="p-4 md:p-6 bg-gradient-to-r from-blue-600 to-indigo-700 flex justify-between items-center shadow-lg z-10">
           <div className="flex items-center gap-2 md:gap-3">
              <div className="bg-white/20 p-1.5 md:p-2 rounded-lg md:rounded-xl">
                 <Gift className="text-yellow-300 w-5 h-5 md:w-6 md:h-6 animate-bounce-short" />
              </div>
              <div>
                  <h2 className="text-lg md:text-xl font-black text-white tracking-wide">{t('mission.daily_title', locale)}</h2>
                  <p className="text-blue-100 text-[10px] md:text-xs font-mono">DAILY MISSIONS</p>
              </div>
           </div>
           <button 
             onClick={onClose}
             className="touch-target w-9 h-9 md:w-8 md:h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 active:bg-white/20 active:text-white transition-colors touch-active"
             aria-label="Close"
           >
             <X size={20} className="md:w-[18px] md:h-[18px]" />
           </button>
        </div>

        {/* List - Mobile Optimized */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2.5 md:space-y-3 no-scrollbar">
            {missions.map(mission => {
                const isCompleted = mission.progress >= mission.target;
                const percent = Math.min(100, (mission.progress / mission.target) * 100);

                return (
                    <div 
                        key={mission.id} 
                        className={`
                            relative p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all
                            ${mission.isClaimed 
                                ? 'bg-black/20 border-white/5 opacity-60' 
                                : 'bg-white/5 border-white/10 active:bg-white/10'}
                        `}
                    >
                        <div className="flex justify-between items-start mb-1.5 md:mb-2">
                             <div className="flex-1 min-w-0 pr-2">
                                 <div className="font-bold text-white mb-0.5 text-sm md:text-base">{t(mission.descriptionKey, locale)}</div>
                                 <div className="text-[10px] md:text-xs text-white/50 font-mono">
                                     {t('mission.progress', locale)}: <span className={isCompleted ? "text-green-400" : "text-white"}>{mission.progress}</span> / {mission.target}
                                 </div>
                             </div>
                             
                             {/* Reward Badge */}
                             <div className="flex items-center gap-1 bg-black/30 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md md:rounded-lg border border-white/5 flex-shrink-0">
                                 <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-yellow-400 rounded-full shadow-[0_0_5px_rgba(250,204,21,0.8)]"></div>
                                 <span className="text-yellow-100 font-bold text-xs md:text-sm">+{mission.reward}</span>
                             </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden mb-3">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${percent}%` }}
                            ></div>
                        </div>

                        {/* Action Button - Mobile Optimized */}
                        {mission.isClaimed ? (
                             <div className="w-full py-2 md:py-2.5 flex items-center justify-center gap-2 text-white/30 font-bold text-xs md:text-sm bg-black/20 rounded-lg md:rounded-xl">
                                 <Check size={14} className="md:w-4 md:h-4" /> {t('mission.claimed', locale)}
                             </div>
                        ) : isCompleted ? (
                             <button 
                                onClick={() => {
                                    sounds.win(); // Re-use win sound for claiming
                                    onClaim(mission.id);
                                }}
                                className="touch-target w-full py-2.5 md:py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg md:rounded-xl font-bold text-white shadow-lg shadow-orange-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 animate-pulse touch-active"
                             >
                                <Star size={14} className="md:w-4 md:h-4" fill="white" /> <span className="text-xs md:text-sm">{t('mission.claim_reward', locale)}</span>
                             </button>
                        ) : (
                             <div className="w-full py-2 md:py-2.5 text-center text-white/30 font-bold text-xs md:text-sm border border-white/5 rounded-lg md:rounded-xl">
                                 {t('mission.in_progress', locale)}
                             </div>
                        )}
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};
