import { type PieceColor } from '../utils/checkersLogic';

export interface CoronationEvent {
  r: number;
  c: number;
  color: PieceColor;
}

interface CoronationOverlayProps {
  event: CoronationEvent | null;
  size: number;
}

export function CoronationOverlay({ event, size }: CoronationOverlayProps) {
  if (!event) return null;

  const topPct = ((event.r + 0.5) / size) * 100;
  const leftPct = ((event.c + 0.5) / size) * 100;
  const isBlack = event.color === 'black';

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-visible" aria-hidden>
      {/* Celestial Golden Light Beam from Above */}
      <div
        className="absolute -translate-x-1/2 bottom-0 ck-coronation-beam pointer-events-none"
        style={{
          left: `${leftPct}%`,
          height: '240%',
          bottom: `${100 - topPct}%`,
        }}
      />

      {/* Royal Floor Halo / Seal */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full ck-coronation-halo pointer-events-none"
        style={{
          top: `${topPct}%`,
          left: `${leftPct}%`,
          width: '120px',
          height: '120px',
        }}
      />

      {/* Descending Golden Crown Animation */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 ck-descending-crown pointer-events-none"
        style={{
          top: `${topPct}%`,
          left: `${leftPct}%`,
        }}
      >
        <div className="w-12 h-12 rounded-full bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-600 p-2 shadow-[0_0_25px_rgba(251,191,36,0.9)] flex items-center justify-center border-2 border-yellow-100">
          <span className="text-xl leading-none filter drop-shadow">👑</span>
        </div>
      </div>

      {/* Royal Proclamation Toast */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 ck-coronation-toast pointer-events-none">
        <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-950 via-yellow-900 to-amber-950 border-2 border-yellow-400/90 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-center">
          <div className="text-sm font-extrabold text-amber-200 tracking-wider flex items-center justify-center gap-1.5">
            <span>⚜️</span>
            <span>國王黃金加冕！{isBlack ? '黑方' : '白方'}王棋誕生</span>
            <span>⚜️</span>
          </div>
          <div className="text-[11px] text-amber-300/80 mt-0.5 font-medium">
            皇冠烙印完成 · 獲得全向斜行掌控權！
          </div>
        </div>
      </div>
    </div>
  );
}
