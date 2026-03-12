import type { ScoreCard, CategoryKey } from '../utils/yahtzeeLogic';
import {
  ALL_CATEGORIES,
  LOWER_CATEGORY_LABELS,
  upperSum,
  upperBonus,
  lowerSum,
  yahtzeeBonusPoints,
  totalScore,
  isCategoryFilled,
  getScoreForCategory,
  getJokerEligibleCategories,
} from '../utils/yahtzeeLogic';

interface ScoreSheetProps {
  card: ScoreCard;
  playerIndex: number;
  dice: number[];
  isCurrentPlayer: boolean;
  phase: 'rolling' | 'choosingCategory' | 'gameOver';
  onChooseCategory: (category: CategoryKey, useJoker: boolean) => void;
}

export function ScoreSheet({
  card,
  playerIndex,
  dice,
  isCurrentPlayer,
  phase,
  onChooseCategory,
}: ScoreSheetProps) {
  const jokerCategories = phase === 'choosingCategory' ? getJokerEligibleCategories(dice, card) : [];
  const canChoose = phase === 'choosingCategory' && isCurrentPlayer;

  return (
    <div
      className={`rounded-xl border-2 p-3 min-w-[200px] ${
        isCurrentPlayer ? 'border-amber-400 bg-amber-950/30' : 'border-slate-600 bg-slate-800/50'
      }`}
    >
      <div className="font-bold text-sm mb-2 flex justify-between items-center">
        <span>玩家 {playerIndex + 1}</span>
        <span className="text-amber-300">{totalScore(card)} 分</span>
      </div>
      <table className="w-full text-left text-sm">
        <tbody>
          {ALL_CATEGORIES.map((cat) => {
            const filled = isCategoryFilled(card, cat);
            const score = filled
              ? cat.type === 'upper'
                ? card.upper[cat.value]
                : card.lower[cat.value]
              : canChoose
                ? getScoreForCategory(dice, cat, card, false)
                : null;
            const jokerScore =
              canChoose &&
              cat.type === 'lower' &&
              jokerCategories.includes(cat.value)
                ? cat.value === 'fullHouse'
                  ? 25
                  : cat.value === 'smallStraight'
                    ? 30
                    : cat.value === 'largeStraight'
                      ? 40
                      : null
                : null;
            const label =
              cat.type === 'upper' ? `${cat.value} 點` : LOWER_CATEGORY_LABELS[cat.value];
            return (
              <tr key={cat.type + (cat.type === 'upper' ? cat.value : cat.value)} className="border-b border-slate-600/50">
                <td className="py-0.5 pr-2 text-slate-300">{label}</td>
                <td className="py-0.5 text-right">
                  {filled ? (
                    <span className="text-white">
                      {cat.type === 'upper' ? card.upper[cat.value] : card.lower[cat.value]}
                    </span>
                  ) : canChoose ? (
                    <button
                      type="button"
                      onClick={() => onChooseCategory(cat, false)}
                      className="text-amber-400 hover:text-amber-300 underline"
                    >
                      {score ?? 0}
                    </button>
                  ) : (
                    <span className="text-slate-500">–</span>
                  )}
                  {jokerScore !== null && canChoose && (
                    <button
                      type="button"
                      onClick={() => onChooseCategory(cat, true)}
                      className="ml-1 text-xs text-purple-300 hover:text-purple-200"
                      title="Joker"
                    >
                      (Joker {jokerScore})
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 pt-2 border-t border-slate-600 text-xs text-slate-400 space-y-0.5">
        <div>上段小計 {upperSum(card)} · 上段加分 {upperBonus(card)}</div>
        <div>下段小計 {lowerSum(card)} · 快艇加分 {yahtzeeBonusPoints(card)}</div>
      </div>
    </div>
  );
}
