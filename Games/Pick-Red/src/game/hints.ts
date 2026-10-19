import { capturableBy, cardLabel, isRed, pointsOf } from './cards';
import { chooseMove, personalityForSeat } from './cpu';
import { HUMAN } from './types';
import type { Card, GameState, HintAdvice } from './types';

/**
 * Teachable hint: same move the sharp policy would make, plus a short reason in
 * Traditional Chinese so the player learns *why*, not only *which cards*.
 */
export function advise(state: GameState): HintAdvice {
  if (state.phase === 'pick_play' || state.phase === 'pick_flip') {
    return advisePick(state);
  }
  if (state.phase !== 'play' || state.turn !== HUMAN) {
    return { card: null, taken: null, reason: '現在還不到你出牌。' };
  }

  const suggestion = chooseMove(state, 'sharp', 0, null);
  return {
    card: suggestion.card,
    taken: suggestion.taken,
    reason: playReason(state, suggestion.card, suggestion.taken),
  };
}

function advisePick(state: GameState): HintAdvice {
  const pending = state.pending!;
  const options = capturableBy(pending, state.table);
  if (options.length === 0) {
    return { card: null, taken: null, reason: '沒有可撿的牌。' };
  }
  const blackAces = state.rules.blackAces;
  const best = [...options].sort(
    (a, b) => pointsOf(b, blackAces) - pointsOf(a, blackAces),
  )[0];
  return {
    card: null,
    taken: best,
    reason: pickReason(pending, best, options, blackAces),
  };
}

function pickReason(
  pending: Card,
  best: Card,
  options: Card[],
  blackAces: boolean,
): string {
  const pts = pointsOf(best, blackAces);
  if (options.length === 1) {
    return `只能撿 ${cardLabel(best)}${pts > 0 ? `（${pts} 分）` : ''}。`;
  }
  const worse = options.filter((c) => c.id !== best.id);
  const left = worse[0];
  if (pts > pointsOf(left, blackAces)) {
    return `選 ${cardLabel(best)}（${pts} 分）——比留下的 ${cardLabel(left)} 值錢；留在桌上的那張下家也能撿。`;
  }
  return `兩邊分數差不多；先拿 ${cardLabel(best)}，別把紅牌入口留給下家。`;
}

function playReason(state: GameState, card: Card, taken: Card | null): string {
  const blackAces = state.rules.blackAces;
  const label = cardLabel(card);

  if (taken) {
    const pts = pointsOf(card, blackAces) + pointsOf(taken, blackAces);
    const takeLabel = cardLabel(taken);
    if (card.rank === 1 || taken.rank === 1) {
      return `打 ${label} 撿 ${takeLabel}（+${pts}）——A 是全場最大分，能拿就拿。`;
    }
    if (pts >= 15) {
      return `打 ${label} 撿 ${takeLabel}（+${pts}）——這手分數高，優先鎖分。`;
    }
    if (isRed(taken) && !isRed(card)) {
      return `用黑牌 ${label} 當工具，換走紅的 ${takeLabel}（+${pts}）——黑牌本來就不計分。`;
    }
    return `打 ${label} 撿 ${takeLabel}（+${pts}）。`;
  }

  // Discard advice.
  const pts = pointsOf(card, blackAces);
  if (pts === 0) {
    return `桌上撿不到；丟 ${label}（0 分）比較安全，別把紅牌餵給下家。`;
  }
  if (pts >= 10) {
    return `桌上撿不到；不得已才丟 ${label}（${pts} 分）——這張很容易被下家吃走。`;
  }
  return `桌上撿不到；丟 ${label}（${pts} 分）。若手上有黑牌，優先丟黑的。`;
}

/** One-line seat blurb for the table chrome. */
export function seatHintBlurb(state: GameState, seat: number): string {
  const person = personalityForSeat(seat);
  if (!person) return '';
  const n = state.hands[seat]?.length ?? 0;
  if (n <= 2 && n > 0) return `${person.name}・快出完了`;
  return person.name;
}
