import { cardLabel } from './cards';
import { sizeMultiplier } from './engine';
import { handDeltas } from './match';
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
  deltas?: number[];
  dingDaViolator?: Seat | null;
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
  const deltas = handDeltas(result);
  const humanDelta = deltas[HUMAN] ?? 0;

  if (result.winner === HUMAN) {
    lessons.push({
      title: '你出完了',
      detail:
        result.dingDaViolator != null
          ? `這局收 ${result.pot} 分（由${seatName(result.dingDaViolator)}觸發頂大包賠）。`
          : `這局收 ${result.pot} 分。對手的牌分加總就是你的獎金。`,
    });
  } else if (result.dingDaViolator === HUMAN) {
    lessons.push({
      title: '觸發頂大包賠',
      detail: `下家剩 1 張時未出手中最大單張且被完賽，你須全額包賠 ${Math.abs(humanDelta)} 分。`,
    });
  } else if (result.dingDaViolator != null) {
    lessons.push({
      title: '這局免賠',
      detail: `${seatName(result.dingDaViolator)} 違反頂大規則包賠全場，你本局免賠 0 分。`,
    });
  } else {
    lessons.push({
      title: '這局輸了',
      detail: `你賠 ${human.penalty} 分（剩 ${human.remaining} 張）。`,
    });
  }

  if (result.dingDaViolator != null && result.dingDaViolator !== HUMAN) {
    lessons.push({
      title: '頂大包賠生效',
      detail: `${seatName(result.dingDaViolator)} 未出最大單張讓下家完賽，獨自承擔全場 ${result.pot} 分；其餘敗家免賠。`,
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
      : humanDelta === 0
        ? '0'
        : `−${Math.abs(humanDelta)}`;

  return {
    winner: result.winner,
    pot: result.pot,
    scores: result.scores,
    deltas,
    dingDaViolator: result.dingDaViolator ?? null,
    lessons: trimmed,
    highlight,
  };
}

function seatName(seat: Seat): string {
  return ['你', '下家', '對家', '上家'][seat] ?? `座位${seat}`;
}

export interface PowerPlayAlertInfo {
  text: string;
  callout: string;
  tone: 'spade2' | 'bomb' | 'deuce' | 'monster';
  badgeStyle: string;
}

/**
 * Generate power play alert info for dominant card plays on the felt.
 */
export function powerPlayAlert(
  play: { type: string; cards: { rank: number; suit: string }[] } | null,
): PowerPlayAlertInfo | null {
  if (!play) return null;
  const hasSpadeTwo = play.cards.some((c) => c.rank === 2 && c.suit === 'spades');
  const deuceCount = play.cards.filter((c) => c.rank === 2).length;

  if (play.type === 'straightFlush') {
    return {
      text: '👑 同花順天霸至尊！神級牌型！',
      callout: '👑 同花順降臨！',
      tone: 'bomb',
      badgeStyle: 'bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600 text-white shadow-purple-900/50',
    };
  }
  if (play.type === 'quads') {
    return {
      text: '💣 鐵支重砲轟炸！狂暴壓境！',
      callout: '💣 鐵支強襲！',
      tone: 'bomb',
      badgeStyle: 'bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 text-white shadow-rose-900/50',
    };
  }
  if (hasSpadeTwo) {
    return {
      text: '👑 ♠2 黑桃至尊降臨！絕對壓制！',
      callout: '👑 ♠2 黑桃至尊！',
      tone: 'spade2',
      badgeStyle: 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-slate-950 shadow-amber-500/50 font-black',
    };
  }
  if (deuceCount >= 2) {
    return {
      text: '⚡ 雙老二霸氣控場！雙龍出海！',
      callout: '⚡ 雙老二控場！',
      tone: 'deuce',
      badgeStyle: 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-orange-500/40 font-black',
    };
  }
  if (deuceCount === 1) {
    return {
      text: '⚡ 老二強勢控場！壓制檯面！',
      callout: '⚡ 老二壓制！',
      tone: 'deuce',
      badgeStyle: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-amber-400/30 font-bold',
    };
  }
  if (play.type === 'fullHouse') {
    return {
      text: '💥 葫蘆重裝壓場！五張巨牌！',
      callout: '💥 葫蘆重壓！',
      tone: 'monster',
      badgeStyle: 'bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 text-white shadow-indigo-500/40 font-bold',
    };
  }
  return null;
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
