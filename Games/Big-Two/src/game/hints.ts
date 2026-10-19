import { cardLabel, isDeuce } from './cards';
import { chooseMove, personalityForSeat, turnsToEmpty } from './cpu';
import { canPass, playsFor } from './engine';
import { canAnyoneBeat, finishingSeats } from './memory';
import { TYPE_LABEL } from './plays';
import type { GameState, HintAdvice, Play } from './types';

/**
 * Teachable hint: same move the hard policy would make, plus a short reason in
 * Traditional Chinese so the player learns *why*, not only *which cards*.
 */
export function advise(state: GameState): HintAdvice {
  const suggestion = chooseMove({ ...state, difficulty: 'hard' });
  if (suggestion === null) {
    return {
      play: null,
      reason: passReason(state),
    };
  }
  return {
    play: suggestion,
    reason: playReason(state, suggestion),
  };
}

function passReason(state: GameState): string {
  if (!canPass(state)) return '現在不能 Pass（你必須出牌）。';
  const options = playsFor(state);
  if (options.length === 0) return '手上壓不過這一手，只能 Pass。';
  const threat = finishingSeats(state).filter((seat) => seat !== state.turn);
  if (threat.length === 0) {
    return '可以壓，但會拆掉好牌型；這輪先放過，留著拆法比較省輪數。';
  }
  return '能壓的出法會把控場牌提早燒掉；對方還沒有立刻出完的威脅，先 Pass。';
}

function playReason(state: GameState, play: Play): string {
  const hand = state.hands[state.turn];
  if (play.cards.length === hand.length) {
    return `這手剛好出完 —— 直接清牌結束！`;
  }

  const labels = play.cards.map(cardLabel).join('');
  const type = TYPE_LABEL[play.type];
  const rest = hand.filter((card) => !play.cards.some((c) => c.id === card.id));
  const before = turnsToEmpty(hand);
  const after = turnsToEmpty(rest);
  const threat = finishingSeats(state).filter((seat) => seat !== state.turn);
  const usesDeuce = play.cards.some(isDeuce);

  if (threat.length > 0 && state.table !== null) {
    return `有人只剩很少張了：用「${type}」${labels} 壓過，別讓對方帶節奏。`;
  }

  if (state.table === null) {
    if (after < before) {
      return `你領出：打「${type}」${labels}，出手後大約還要 ${after} 輪出完（現在估 ${before} 輪）。`;
    }
    return `你領出：先打「${type}」${labels}，把規格定在你有貨的邊。`;
  }

  if (usesDeuce) {
    return `用「${type}」${labels} 換領出權 —— 2 留在手上會讓牌分翻倍，能甩掉就甩掉。`;
  }

  if (!canAnyoneBeat(state, state.turn, play)) {
    return `依已出的牌判斷，這手「${type}」${labels} 很可能沒人壓得過，適合搶回領出。`;
  }

  if (after <= before) {
    return `出「${type}」${labels}：壓過檯面，而且不太破壞拆法（估剩 ${after} 輪）。`;
  }

  return `出「${type}」${labels} 壓過這一手。`;
}

/** One-line seat blurb for the table chrome. */
export function seatHintBlurb(state: GameState, seat: number): string {
  const person = personalityForSeat(seat);
  if (!person) return '';
  const n = state.hands[seat]?.length ?? 0;
  if (n <= 2 && n > 0) return `${person.name}・快出完了！`;
  return person.name;
}
