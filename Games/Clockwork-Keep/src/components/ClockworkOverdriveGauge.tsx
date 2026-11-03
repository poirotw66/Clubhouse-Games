import type { ReactElement } from 'react';

interface ClockworkOverdriveGaugeProps {
  steamPressure: number;
  overdriveRemaining: number;
  currentCombo: number;
  onTriggerOverdrive: () => void;
  onWindMainspring: () => void;
}

export function ClockworkOverdriveGauge({
  steamPressure,
  overdriveRemaining,
  currentCombo,
  onTriggerOverdrive,
  onWindMainspring,
}: ClockworkOverdriveGaugeProps): ReactElement {
  const isOverdrive = overdriveRemaining > 0;
  const isReady = steamPressure >= 100;
  const percent = Math.min(100, Math.floor(steamPressure));

  return (
    <div
      className={`w-full max-w-3xl mb-2 p-2.5 rounded-xl border backdrop-blur-sm transition-all duration-300 shadow-lg ${
        isOverdrive
          ? 'bg-amber-950/85 border-amber-400 ring-2 ring-amber-500/50 shadow-amber-500/20'
          : isReady
            ? 'bg-[#1c1409]/95 border-amber-400/80 shadow-amber-600/15'
            : 'bg-[#1c1409]/90 border-amber-900/50'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Gauge title & pressure bar */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5 font-bold tracking-wide text-amber-200">
              <span className={`inline-block text-amber-400 ${isOverdrive ? 'animate-spin' : ''}`}>
                ⚙
              </span>
              發條蒸氣核心
              {isOverdrive ? (
                <span className="text-amber-300 font-mono font-bold animate-pulse">
                  🔥 超頻運轉中（攻速 +60%）
                </span>
              ) : isReady ? (
                <span className="text-emerald-400 font-semibold animate-pulse">
                  ★ 壓力蓄滿！
                </span>
              ) : (
                <span className="text-amber-200/60 text-[11px] font-normal">
                  擊殺或手動上發條蓄能
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {currentCombo >= 2 && (
                <span
                  className={`px-2 py-0.5 rounded-full font-mono font-bold text-xs shadow-sm animate-bounce ${
                    currentCombo >= 10
                      ? 'bg-rose-600 text-white border border-rose-400'
                      : currentCombo >= 5
                        ? 'bg-amber-500 text-black border border-amber-300'
                        : 'bg-sky-600 text-white border border-sky-400'
                  }`}
                >
                  ⚡ {currentCombo}x 連擊
                </span>
              )}
              <span className="font-mono font-bold text-amber-300 text-xs">
                {isOverdrive ? `${overdriveRemaining.toFixed(1)}s` : `${percent}%`}
              </span>
            </div>
          </div>

          {/* Steampunk Pressure Bar */}
          <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden border border-amber-900/40 relative">
            <div
              className={`h-full transition-all duration-150 rounded-full ${
                isOverdrive
                  ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-amber-300 animate-pulse'
                  : isReady
                    ? 'bg-gradient-to-r from-amber-500 to-emerald-400'
                    : 'bg-gradient-to-r from-amber-800 via-amber-600 to-amber-400'
              }`}
              style={{
                width: isOverdrive ? `${(overdriveRemaining / 8.0) * 100}%` : `${percent}%`,
              }}
            />
            {/* Rivet tick marks */}
            <div className="absolute inset-0 flex justify-between pointer-events-none px-2 opacity-30">
              <span className="w-px h-full bg-white" />
              <span className="w-px h-full bg-white" />
              <span className="w-px h-full bg-white" />
            </div>
          </div>
        </div>

        {/* Right: Tactile Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={isOverdrive || isReady}
            onClick={onWindMainspring}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-150 touch-manipulation flex items-center gap-1.5 active:scale-95 shadow-sm ${
              isOverdrive || isReady
                ? 'border-amber-900/30 bg-black/20 text-amber-200/30 cursor-not-allowed'
                : 'border-amber-600/70 bg-gradient-to-b from-amber-800/60 to-amber-950/80 hover:from-amber-700/70 hover:to-amber-900/90 text-amber-100'
            }`}
            title="手動上發條蓄壓 +15%（快捷鍵：W）"
            aria-label="手動上發條蓄能"
          >
            <span className="text-amber-400 text-sm">🔩</span>
            <span>上發條</span>
            <span className="hidden sm:inline font-mono text-[10px] text-amber-300/80 bg-black/40 px-1 py-0.5 rounded">
              W
            </span>
          </button>

          <button
            type="button"
            disabled={!isReady || isOverdrive}
            onClick={onTriggerOverdrive}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all duration-150 touch-manipulation flex items-center gap-1.5 active:scale-95 shadow-md ${
              isOverdrive
                ? 'border-amber-400 bg-amber-600/40 text-amber-200 animate-pulse cursor-default'
                : isReady
                  ? 'border-amber-300 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 text-white font-extrabold hover:brightness-110 animate-bounce ring-2 ring-amber-400/60'
                  : 'border-amber-900/30 bg-black/20 text-amber-200/30 cursor-not-allowed'
            }`}
            title="啟動全城發條超頻 8 秒：攻速 +60%、得分 +50%（快捷鍵：F）"
            aria-label="啟動發條超頻"
          >
            <span className="text-sm">🔥</span>
            <span>{isOverdrive ? '超頻中' : '發條超頻'}</span>
            <span
              className={`font-mono text-[10px] px-1 py-0.5 rounded ${
                isReady && !isOverdrive ? 'bg-black/50 text-amber-200' : 'bg-black/20 text-amber-300/60'
              }`}
            >
              F
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
