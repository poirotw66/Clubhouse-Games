import { type CSSProperties, memo } from 'react';
import {
  FACE_EMOJI,
  FACE_TINT,
  faceUsesPhoto,
  type MemoryCard,
} from './memoryLogic';
import { type PhosphorLevel } from './brainTelemetry';

export interface TactileCardProps {
  card: MemoryCard;
  index: number;
  show: boolean;
  hinted: boolean;
  missPulse: boolean;
  matchPulse: boolean;
  disabled: boolean;
  dense?: boolean;
  focused?: boolean;
  coordinate: string;
  phosphorLevel: PhosphorLevel;
  echoReady?: boolean;
  onClick: () => void;
}

function cardFaceStyle(face: MemoryCard['face'], kind: MemoryCard['kind']): CSSProperties {
  if (faceUsesPhoto(face)) {
    return {
      backgroundColor: '#f8fafc',
      backgroundImage: [
        'linear-gradient(rgba(255,255,255,0.12), rgba(255,255,255,0.22))',
        `url(${import.meta.env.BASE_URL}faces/${face}.jpg)`,
      ].join(', '),
    };
  }
  return {
    backgroundColor:
      kind === 'insight' ? '#fff7ed' : kind === 'bomb' ? '#fee2e2' : FACE_TINT[face] ?? '#f8fafc',
  };
}

export const TactileCard = memo(function TactileCard({
  card,
  show,
  hinted,
  missPulse,
  matchPulse,
  disabled,
  dense,
  focused,
  coordinate,
  phosphorLevel,
  echoReady,
  onClick,
}: TactileCardProps) {
  const isRevealed = show || card.matched;

  const cardClasses = [
    'mm-card',
    'mm-tactile-slab',
    isRevealed ? 'is-flipped' : '',
    card.matched ? 'is-matched' : '',
    missPulse ? 'is-miss' : '',
    matchPulse ? 'is-match-pop' : '',
    focused ? 'is-focused' : '',
    echoReady && !card.matched ? 'is-echo-ready' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const phosphorTitle = echoReady
    ? '✨ 記憶殿堂：完整雙牌已定錨，可直接配對！'
    : phosphorLevel === 3
      ? '🟢 鮮活記憶：剛探索過（留存率高）'
      : phosphorLevel === 2
        ? '🔵 溫熱記憶：在工作記憶暫存區中'
        : phosphorLevel === 1
          ? '🟣 微弱餘燼：記憶開始衰退，需回想'
          : '未探索卡牌';

  return (
    <div
      className={`mm-scene ${dense ? 'aspect-square sm:aspect-[3/4]' : 'aspect-[3/4]'}`}
      data-coord={coordinate}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || card.matched}
        className={`${cardClasses} w-full h-full touch-manipulation disabled:cursor-default`}
        aria-label={isRevealed ? `${card.face} (${coordinate})` : `背面牌 ${coordinate}`}
      >
        {/* Physical 3D thickness bevel */}
        <span className="mm-card-bevel" aria-hidden />

        {/* Back face with memory palace coordinate and phosphor luminescence */}
        <span
          className="mm-face mm-face-back"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}card-back.jpg)` }}
        >
          {/* Spatial memory coordinate */}
          <span className="mm-coord-badge" aria-hidden>
            {coordinate}
          </span>

          {/* Memory Palace Phosphor Glow */}
          {phosphorLevel > 0 && !card.matched && !show && (
            <span
              className={`mm-phosphor mm-phosphor--l${phosphorLevel}${echoReady ? ' is-ready' : ''}`}
              title={phosphorTitle}
              aria-hidden
            >
              <span className="mm-phosphor-core" />
              <span className="mm-phosphor-halo" />
              {echoReady && <span className="mm-phosphor-ring" />}
            </span>
          )}

          {/* Specular sheen sweep */}
          <span className="mm-specular-sheen" aria-hidden />
        </span>

        {/* Front face with luxury foil perimeter */}
        <span
          className={`mm-face mm-face-front ${card.kind === 'insight' ? 'is-insight' : ''} ${
            card.kind === 'bomb' ? 'is-bomb' : ''
          } ${hinted ? 'mm-face--hint' : ''}`}
          style={cardFaceStyle(card.face, card.kind)}
        >
          <span className="mm-coord-badge mm-coord-badge--front" aria-hidden>
            {coordinate}
          </span>

          {!faceUsesPhoto(card.face) && (
            <span className="mm-emoji" aria-hidden>
              {FACE_EMOJI[card.face]}
            </span>
          )}

          {card.kind === 'insight' && (
            <span className="absolute bottom-0.5 right-0.5 rounded-[0.3rem] bg-amber-400 px-1 text-[9px] sm:text-[10px] font-bold text-amber-950 shadow-[0_0_10px_rgba(251,191,36,0.55)]">
              洞察
            </span>
          )}

          {card.kind === 'bomb' && (
            <span className="absolute bottom-0.5 right-0.5 rounded-[0.3rem] bg-rose-500 px-1 text-[9px] sm:text-[10px] font-bold text-rose-50 shadow-[0_0_10px_rgba(244,63,94,0.55)]">
              炸彈
            </span>
          )}

          {/* Front specular highlight */}
          <span className="mm-specular-sheen" aria-hidden />
        </span>

        {matchPulse && <span className="mm-burst" aria-hidden />}
      </button>
    </div>
  );
});
