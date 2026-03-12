import type { SlotState } from '../utils/takoyakiLogic';
import { getProgressPercent, isInPerfectZone } from '../utils/takoyakiLogic';

interface TakoyakiBallProps {
  slot: SlotState;
  onClick: () => void;
  disabled: boolean;
}

/** Interpolate color from raw (cream) -> golden -> burnt (dark brown). */
function getBallGradient(progress: number): string {
  if (progress <= 0.35) {
    const t = progress / 0.35;
    return `radial-gradient(circle at 35% 35%, #fef3c7, #fde68a ${60 + t * 20}%, #fcd34d)`;
  }
  if (progress <= 0.7) {
    const t = (progress - 0.35) / 0.35;
    return `radial-gradient(circle at 35% 35%, #fef08a, #facc15 ${50 + t * 30}%, #eab308)`;
  }
  if (progress <= 0.88) {
    return `radial-gradient(circle at 35% 35%, #fde047, #fbbf24 50%, #f59e0b)`;
  }
  if (progress <= 1) {
    const t = (progress - 0.88) / 0.12;
    return `radial-gradient(circle at 35% 35%, #f59e0b, #d97706 ${40 + t * 30}%, #92400e)`;
  }
  return `radial-gradient(circle at 35% 35%, #78350f, #451a03)`;
}

function getResultGradient(result: 'perfect' | 'raw' | 'burnt'): string {
  switch (result) {
    case 'perfect':
      return `radial-gradient(circle at 35% 35%, #fde047, #fbbf24 50%, #f59e0b)`;
    case 'raw':
      return `radial-gradient(circle at 35% 35%, #fef9c3, #fef08a 60%, #fde68a)`;
    case 'burnt':
      return `radial-gradient(circle at 35% 35%, #78350f, #451a03 50%, #292524)`;
  }
}

export function TakoyakiBall({ slot, onClick, disabled }: TakoyakiBallProps) {
  const percent = getProgressPercent(slot);
  const progress = slot.type === 'cooking' ? slot.progress : 0;
  const inZone = percent !== null && isInPerfectZone(percent / 100);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative w-full aspect-square min-w-[72px] min-h-[72px] rounded-full border-2 border-amber-800/80 overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-950 transition-transform active:scale-95 disabled:active:scale-100"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 80%, #422006, #1c1917 70%)',
        boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      {/* Well: dark recess */}
      <div
        className="absolute inset-1 rounded-full flex items-center justify-center overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 90% 70% at 50% 60%, #292524, #0c0a09)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
        }}
      >
        {slot.type === 'empty' && (
          <span className="text-amber-800/50 text-xs font-medium">空</span>
        )}

        {slot.type === 'cooking' && (
          <>
            {/* Steam (when in perfect zone) */}
            {inZone && (
              <div className="absolute inset-0 pointer-events-none flex justify-center items-end pb-2">
                <div className="steam-container">
                  <span className="steam s1" />
                  <span className="steam s2" />
                  <span className="steam s3" />
                </div>
              </div>
            )}
            {/* Sizzle dots */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="absolute w-2 h-2 rounded-full bg-amber-500/40 animate-sizzle"
                style={{ top: '20%', left: '25%', animationDelay: '0s' }}
              />
              <div
                className="absolute w-1.5 h-1.5 rounded-full bg-amber-400/30 animate-sizzle"
                style={{ top: '30%', right: '20%', animationDelay: '0.2s' }}
              />
              <div
                className="absolute w-2 h-2 rounded-full bg-amber-600/30 animate-sizzle"
                style={{ bottom: '25%', left: '30%', animationDelay: '0.1s' }}
              />
            </div>
            {/* The ball */}
            <div
              className="absolute rounded-full animate-cook-pulse"
              style={{
                width: '72%',
                height: '72%',
                left: '14%',
                top: '14%',
                background: getBallGradient(progress),
                boxShadow: '2px 4px 8px rgba(0,0,0,0.35), inset -2px -2px 4px rgba(255,255,255,0.1)',
                transition: 'background 0.08s ease-out',
              }}
            />
            {/* Progress ring around the well */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1.5 rounded-b-full overflow-hidden bg-amber-950/80"
              style={{ margin: '0 8%' }}
            >
              <div
                className={`h-full rounded-b-full transition-all duration-75 ${inZone ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </>
        )}

        {slot.type === 'result' && (
          <>
            <div
              className="absolute rounded-full animate-result-pop"
              style={{
                width: '72%',
                height: '72%',
                left: '14%',
                top: '14%',
                background: getResultGradient(slot.result),
                boxShadow: '2px 4px 8px rgba(0,0,0,0.35)',
              }}
            />
            <span
              className={`absolute bottom-1 left-0 right-0 text-center text-xs font-bold ${
                slot.result === 'perfect'
                  ? 'text-emerald-400 drop-shadow'
                  : slot.result === 'raw'
                    ? 'text-amber-300'
                    : 'text-red-400'
              }`}
            >
              {slot.result === 'perfect' ? '完美' : slot.result === 'raw' ? '未熟' : '燒焦'}
            </span>
          </>
        )}
      </div>
    </button>
  );
}
