import React from 'react';
import { X } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { t } from '../utils/i18n';
import { getSoundEnabled, setSoundEnabled } from '../utils/sound';
import type { Locale } from '../utils/i18n';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { locale, setLocale } = useLocale();
  const [soundOn, setSoundOn] = React.useState(() => getSoundEnabled());

  React.useEffect(() => {
    if (isOpen) setSoundOn(getSoundEnabled());
  }, [isOpen]);

  const handleSoundToggle = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const handleLocaleChange = (next: Locale) => {
    setLocale(next);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 px-3 md:px-4 safe-top safe-bottom safe-left safe-right">
      <div className="w-full max-w-sm bg-[#2d2d44] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl relative">
        <div className="p-4 md:p-6 bg-gradient-to-r from-slate-600 to-slate-700 flex justify-between items-center">
          <h2 className="text-lg md:text-xl font-black text-white tracking-wide">{t('settings.title', locale)}</h2>
          <button
            onClick={onClose}
            className="touch-target w-9 h-9 md:w-8 md:h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 active:bg-white/20 active:text-white transition-colors touch-active"
            aria-label="Close"
          >
            <X size={20} className="md:w-[18px] md:h-[18px]" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-5 md:space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium text-sm md:text-base">{t('settings.sound', locale)}</span>
            <button
              onClick={handleSoundToggle}
              className={`touch-target px-4 md:px-5 py-2 rounded-lg md:rounded-xl font-bold text-xs md:text-sm transition-colors touch-active ${
                soundOn
                  ? 'bg-green-600/80 text-white'
                  : 'bg-white/10 text-white/60'
              }`}
            >
              {soundOn ? t('settings.sound_on', locale) : t('settings.sound_off', locale)}
            </button>
          </div>

          <div>
            <span className="text-white font-medium block mb-2 md:mb-3 text-sm md:text-base">{t('settings.language', locale)}</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleLocaleChange('zh-TW')}
                className={`touch-target flex-1 py-2.5 md:py-2 rounded-lg md:rounded-xl font-bold text-xs md:text-sm transition-colors touch-active ${
                  locale === 'zh-TW'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-white/70 active:bg-white/15'
                }`}
              >
                繁體中文
              </button>
              <button
                onClick={() => handleLocaleChange('en')}
                className={`touch-target flex-1 py-2.5 md:py-2 rounded-lg md:rounded-xl font-bold text-xs md:text-sm transition-colors touch-active ${
                  locale === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-white/70 active:bg-white/15'
                }`}
              >
                English
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="touch-target w-full py-3 bg-white/10 active:bg-white/15 rounded-lg md:rounded-xl font-bold text-white transition-colors touch-active text-sm md:text-base"
          >
            {t('settings.close', locale)}
          </button>
        </div>
      </div>
    </div>
  );
};
