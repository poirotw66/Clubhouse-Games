import { type PieceColor } from '../utils/checkersLogic';
import { type BoardTheme } from '../types/checkersThemes';

interface PieceViewProps {
  color: PieceColor;
  king: boolean;
  selected: boolean;
  capturer: boolean;
  lastMoveDest: boolean;
  hopping: boolean;
  threatened?: boolean;
  keystone?: boolean;
  theme: BoardTheme;
  is3D: boolean;
}

export function PieceView({
  color,
  king,
  selected,
  capturer,
  lastMoveDest,
  hopping,
  threatened = false,
  keystone = false,
  theme,
  is3D,
}: PieceViewProps) {
  const isBlack = color === 'black';
  const palette = isBlack ? theme.blackPiece : theme.whitePiece;

  // Ring and glow states
  let ringClasses = 'ring-1';
  let glowStyle = {};

  if (selected) {
    ringClasses = 'ring-4 ring-amber-300 ring-offset-2 ring-offset-amber-900/40 animate-pulse';
    glowStyle = {
      boxShadow: '0 0 18px rgba(251, 191, 36, 0.9), 0 12px 20px rgba(0, 0, 0, 0.6)',
    };
  } else if (lastMoveDest) {
    ringClasses = 'ring-3 ring-yellow-400/90 ring-offset-1 ring-offset-amber-950/30';
    glowStyle = {
      boxShadow: '0 0 12px rgba(250, 204, 21, 0.6), 0 6px 12px rgba(0, 0, 0, 0.4)',
    };
  } else if (capturer) {
    ringClasses = 'ring-3 ring-rose-400 ring-offset-1 ring-offset-rose-950/40 animate-pulse';
    glowStyle = {
      boxShadow: '0 0 16px rgba(244, 63, 94, 0.8), 0 6px 14px rgba(0, 0, 0, 0.5)',
    };
  } else if (threatened) {
    ringClasses = 'ring-2 ring-red-500/80 ring-offset-1 ring-offset-red-950/40';
    glowStyle = {
      boxShadow: '0 0 10px rgba(239, 68, 68, 0.6)',
    };
  } else {
    ringClasses = isBlack ? 'ring-2 ring-stone-600/60' : 'ring-2 ring-amber-400/60';
  }

  return (
    <div
      className={`
        ck-piece-container relative w-[82%] h-[82%] rounded-full flex items-center justify-center
        select-none transition-all duration-200
        ${hopping ? 'ck-piece--hopping' : 'checkers-piece-enter'}
        ${is3D ? 'ck-piece--3d' : 'ck-piece--2d'}
        ${selected ? 'ck-piece--selected' : ''}
      `}
      style={{
        transformStyle: 'preserve-3d',
      }}
    >
      {/* 3D Physical Drop Shadow on Board Surface */}
      <div
        className={`
          absolute inset-0 rounded-full transition-all duration-200 pointer-events-none
          ${selected ? 'scale-110 opacity-70 blur-md' : 'opacity-85 blur-[3px]'}
        `}
        style={{
          background: 'rgba(0, 0, 0, 0.75)',
          transform: is3D
            ? selected
              ? 'translateY(16px) translateZ(-10px) scale(0.92)'
              : 'translateY(6px) translateZ(-4px) scale(0.96)'
            : 'translateY(3px)',
        }}
        aria-hidden
      />

      {/* Main Cylinder Turned-Wood Piece Body */}
      <div
        className={`
          ck-piece-disc relative w-full h-full rounded-full flex items-center justify-center
          ${ringClasses} transition-all duration-150
        `}
        style={{
          background: palette.bg,
          borderColor: palette.border,
          ...glowStyle,
        }}
      >
        {/* Concentric turned lathe groove 1 (outer rim reflection) */}
        <div
          className="absolute inset-[6%] rounded-full pointer-events-none opacity-40 border border-white/20 shadow-inner"
          aria-hidden
        />

        {/* Concentric turned lathe groove 2 (inner bevel ring) */}
        <div
          className="absolute inset-[15%] rounded-full pointer-events-none border border-black/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
          style={{
            borderColor: isBlack ? 'rgba(251, 191, 36, 0.25)' : 'rgba(180, 83, 9, 0.3)',
          }}
          aria-hidden
        />

        {/* Concave Center Dish */}
        <div
          className="absolute inset-[24%] rounded-full pointer-events-none flex items-center justify-center shadow-inner"
          style={{
            background: isBlack
              ? 'radial-gradient(circle at 45% 40%, rgba(68, 64, 60, 0.8), rgba(28, 25, 23, 0.95))'
              : 'radial-gradient(circle at 45% 40%, rgba(255, 255, 255, 0.9), rgba(254, 243, 199, 0.95))',
          }}
          aria-hidden
        >
          {/* King Crown Emblem or Checker Emboss */}
          {king ? (
            <div className="relative flex items-center justify-center animate-pulse">
              {/* Crown SVG */}
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] filter"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 18H21V19.5H3V18ZM4 16.5L6.5 8L12 12.5L17.5 8L20 16.5H4Z"
                  fill={palette.crown}
                  stroke={isBlack ? '#fef08a' : '#78350f'}
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                />
                <circle cx="6.5" cy="7.5" r="1.3" fill="#fbbf24" stroke="#78350f" strokeWidth="0.5" />
                <circle cx="12" cy="11.5" r="1.3" fill="#fbbf24" stroke="#78350f" strokeWidth="0.5" />
                <circle cx="17.5" cy="7.5" r="1.3" fill="#fbbf24" stroke="#78350f" strokeWidth="0.5" />
              </svg>
            </div>
          ) : (
            /* Regular Checker Disc turned-wood center rosette */
            <div
              className="w-2.5 h-2.5 rounded-full border border-black/30 shadow-inner"
              style={{
                backgroundColor: isBlack ? '#1c1917' : '#fef08a',
                borderColor: isBlack ? '#57534e' : '#d97706',
              }}
              aria-hidden
            />
          )}
        </div>

        {/* Specular light highlight arc across top edge */}
        <div
          className="absolute top-[4%] left-[18%] right-[18%] h-[20%] rounded-full pointer-events-none opacity-50"
          style={{
            background:
              'linear-gradient(180deg, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0) 100%)',
          }}
          aria-hidden
        />

        {/* Threat Warning Badge */}
        {threatened && !selected && (
          <div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold shadow-md animate-bounce pointer-events-none"
            title="此子正面臨敵方跳吃威脅！"
            aria-hidden
          >
            !
          </div>
        )}

        {/* Keystone Defender Shield */}
        {keystone && !threatened && !selected && (
          <div
            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-700/80 text-amber-200 flex items-center justify-center text-[9px] pointer-events-none border border-amber-400/50"
            title="底線守衛核心子"
            aria-hidden
          >
            🛡
          </div>
        )}
      </div>
    </div>
  );
}
