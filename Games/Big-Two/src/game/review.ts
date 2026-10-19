import { cardLabel } from './cards';
import { sizeMultiplier } from './engine';
import { TYPE_LABEL } from './plays';
import { HUMAN } from './types';
import type { GameState, Outcome, Seat, SeatScore } from './types';

export interface ReviewLesson {
  title: string;
  detail: string;
}

export interface HandReview {
  winner: Seat;
  pot: number;
  scores: SeatScore[];
  lessons: ReviewLesson[];
  highlight: string;
}

/**
 * Build a short post-hand review that teaches from what just happened — leftover
 * deuces, size-ladder spikes, and how many tricks the winner needed.
 */
export function buildHandReview(state: GameState, result: Outcome): HandReview {
  const lessons: ReviewLesson[] = [];
  const human = result.scores[HUMAN];

  if (result.winner === HUMAN) {
    lessons.push({
      title: '你出完了',
      detail: `這局收 ${result.pot} 分。對手的牌分加總就是你的獎金。`,
    });
  } else {
    lessons.push({
      title: '這局輸了',
      detail: `你賠 ${human.penalty} 分（剩 ${human.remaining} 張）。`,
    });
  }

  for (const score of result.scores) {
    if (score.seat === result.winner) continue;
    if (score.deuces > 0 && state.rules.deuceDouble) {
      const who = score.seat === HUMAN ? '你' : seatName(score.seat);
      lessons.push({
        title: `${who}留了 ${score.deuces} 張 2`,
        detail: `牌分再 ×${2 ** score.deuces}。2 是用來控場的，不是收藏品。`,
      });
    }
    if (score.remaining >= 8 && state.rules.sizeLadder) {
      const who = score.seat === HUMAN ? '你' : seatName(score.seat);
      const mult = sizeMultiplier(score.remaining, true);
      lessons.push({
        title: `${who}剩 ${score.remaining} 張`,
        detail: `觸發張數倍數 ×${mult}（8 張起跳）。越晚出完罰得越重。`,
      });
    }
  }

  const fiveCard = state.log.filter(
    (entry) => entry.play && entry.play.cards.length === 5 && entry.seat === result.winner,
  );
  if (fiveCard.length > 0) {
    const last = fiveCard[fiveCard.length - 1].play!;
    lessons.push({
      title: `贏家打過 ${TYPE_LABEL[last.type]}`,
      detail: `${last.cards.map(cardLabel).join('')} —— 五張牌一次清五張，是拆牌效率的核心。`,
    });
  }

  const plays = state.log.filter((e) => e.play !== null).length;
  lessons.push({
    title: '本局節奏',
    detail: `一共 ${plays} 手實牌（不含 Pass）。拆得越乾淨，需要的輪數就越少。`,
  });

  // Cap so the overlay stays scannable.
  const trimmed = lessons.slice(0, 4);
  const highlight =
    result.winner === HUMAN
      ? `+${result.pot}`
      : `−${human.penalty}`;

  return {
    winner: result.winner,
    pot: result.pot,
    scores: result.scores,
    lessons: trimmed,
    highlight,
  };
}

function seatName(seat: Seat): string {
  return ['你', '下家', '對家', '上家'][seat] ?? `座位${seat}`;
}

/** True when a play deserves a combo callout on the table. */
export function isFlashyPlay(play: { type: string; cards: { rank: number; suit: string }[] }): boolean {
  return (
    play.type === 'fullHouse' ||
    play.type === 'quads' ||
    play.type === 'straightFlush' ||
    play.cards.some((card) => card.rank === 2)
  );
}
