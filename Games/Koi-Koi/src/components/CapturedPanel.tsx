import React, { useMemo } from 'react';
import { Card as CardType, YakuId } from '../types';
import { calculateYakuDetail } from '../utils/gameLogic';
import { Card as CardComponent } from './Card';

const YAKU_ACCENT: Record<YakuId, string> = {
  gokou: 'border-gold bg-gold/10',
  shikou: 'border-gold bg-gold/10',
  ame_shikou: 'border-gold bg-gold/10',
  sankou: 'border-gold bg-gold/10',
  ino_shika_cho: 'border-emerald-400/60 bg-emerald-400/10',
  tsukimi_zake: 'border-sky-400/60 bg-sky-400/10',
  hanami_zake: 'border-pink-400/60 bg-pink-400/10',
  tane: 'border-emerald-400/60 bg-emerald-400/10',
  akatan: 'border-vermillion-light/60 bg-vermillion/10',
  aotan: 'border-blue-400/60 bg-blue-400/10',
  tanzaku: 'border-vermillion-light/60 bg-vermillion/10',
  kasu: 'border-cream/30 bg-cream/5',
};

interface CapturedPanelProps {
  captured: CardType[];
  label?: string;
  className?: string;
}

export const CapturedPanel: React.FC<CapturedPanelProps> = ({
  captured,
  label = '獲得牌',
  className = '',
}) => {
  const detail = useMemo(() => calculateYakuDetail(captured), [captured]);
  const cardById = useMemo(
    () => new Map(captured.map(card => [card.id, card])),
    [captured],
  );

  if (captured.length === 0) {
    return (
      <div className={`${className}`}>
        <p className="text-xs text-gold/70 mb-2">{label}</p>
        <p className="text-[10px] text-cream/40">尚無獲得牌</p>
      </div>
    );
  }

  const otherCards = detail.unassignedCardIds
    .map(id => cardById.get(id))
    .filter((card): card is CardType => card !== undefined);

  return (
    <div className={`${className}`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-xs text-gold/70">{label}</p>
        {detail.totalPoints > 0 && (
          <p className="text-[10px] text-vermillion-light/90 font-display">
            本局 {detail.totalPoints} 分
          </p>
        )}
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {detail.yaku.map(entry => {
          const cards = entry.cardIds
            .map(id => cardById.get(id))
            .filter((card): card is CardType => card !== undefined);

          return (
            <div
              key={entry.id}
              className={`rounded-lg border px-2 py-1.5 ${YAKU_ACCENT[entry.id]}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[10px] font-display text-cream/90 leading-tight">{entry.name}</p>
                <span className="text-[10px] text-gold shrink-0">{entry.points} 分</span>
              </div>
              <div className="flex gap-0.5 flex-wrap">
                {cards.map(card => (
                  <CardComponent
                    key={`${entry.id}-${card.id}`}
                    card={card}
                    className="scale-[0.55] origin-top-left"
                  />
                ))}
              </div>
            </div>
          );
        })}

        {otherCards.length > 0 && (
          <div className="rounded-lg border border-cream/15 bg-indigo-deep/30 px-2 py-1.5">
            <p className="text-[10px] text-cream/50 mb-1">其他（{otherCards.length} 張）</p>
            <div className="flex gap-0.5 flex-wrap">
              {otherCards.map(card => (
                <CardComponent
                  key={card.id}
                  card={card}
                  className="scale-[0.55] origin-top-left opacity-80"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
