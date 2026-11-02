import React, {useState} from 'react';
import {Card as CardType} from '../types';
import {CARD_BACK_IMAGE_URL, getCardImageUrl} from '../cardImages';

interface Props {
  card: CardType;
  onClick?: () => void;
  selected?: boolean;
  highlighted?: boolean;
  /** Soft gold ring for hint recommendations (distinct from match highlight). */
  hint?: boolean;
  hidden?: boolean;
  className?: string;
  /** Optional keyboard hotkey number (1-8) badge displayed on top-left */
  hotkeyIndex?: number;
}

export const Card: React.FC<Props> = ({
  card,
  onClick,
  selected,
  highlighted,
  hint,
  hidden,
  className = '',
  hotkeyIndex,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  if (hidden) {
    return (
      <div
        className={`w-16 h-24 sm:w-20 sm:h-32 rounded-sm border-2 border-lacquer shadow-md overflow-hidden ${className}`}
        aria-hidden="true"
      >
        <img
          src={CARD_BACK_IMAGE_URL}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
    );
  }

  const monthNames = ['松', '梅', '櫻', '藤', '菖蒲', '牡丹', '萩', '芒', '菊', '紅葉', '柳', '桐'];

  return (
    <div
      onClick={onClick}
      title={`${card.month}月 ${monthNames[card.month - 1]} · ${card.name}`}
      className={`relative w-16 h-24 sm:w-20 sm:h-32 rounded-sm border-2 overflow-hidden cursor-pointer shadow-md transition-all duration-200 bg-washi
        ${selected ? 'border-gold border-[3px] -translate-y-2 shadow-lg ring-2 ring-vermillion/50' : 'border-lacquer/80'}
        ${highlighted ? 'border-vermillion border-[3px] shadow-lg shadow-vermillion/30 animate-pulse' : ''}
        ${hint && !highlighted && !selected ? 'border-gold border-[3px] shadow-lg shadow-gold/40 ring-2 ring-gold/50 animate-pulse' : ''}
        ${className}
      `}
    >
      {hotkeyIndex !== undefined && (
        <span
          className="absolute top-0.5 left-0.5 z-10 px-1 py-0.2 rounded text-[9px] bg-black/80 text-gold font-mono font-bold border border-gold/40 shadow-xs pointer-events-none"
          title={`快捷鍵 ${hotkeyIndex}`}
        >
          {hotkeyIndex}
        </span>
      )}
      {imageFailed ? (
        <div className="flex h-full w-full flex-col items-center justify-center p-1 text-center text-[10px] font-bold leading-tight text-gray-700">
          <span>{card.month}月</span>
          <span className="mt-1">{card.name}</span>
        </div>
      ) : (
        <img
          src={getCardImageUrl(card.id)}
          alt={`${card.month}月 ${card.name}`}
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
};
