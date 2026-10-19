import { cardLabel } from './cards';
import { HUMAN } from './types';
import type { GameState, Outcome, Seat } from './types';

export interface ReviewLesson {
  title: string;
  detail: string;
}

export interface HandReview {
  winners: Seat[];
  scores: number[];
  par: number;
  deltas: number[];
  lessons: ReviewLesson[];
  highlight: string;
}

const SEAT_NAMES = ['你', '對家甲', '對家乙', '對家丙'];

/**
 * Build a short post-hand review that teaches from what just happened —
 * qualifying line, 過紅五／拼零分, and whether reds were fed to the table.
 */
export function buildHandReview(state: GameState, result: Outcome): HandReview {
  const lessons: ReviewLesson[] = [];
  const humanScore = result.scores[HUMAN];
  const humanDelta = result.deltas[HUMAN];
  const qualified = result.qualified.includes(HUMAN);

  if (result.result === 'win') {
    lessons.push({
      title: '你拿下最高分',
      detail: `本局 ${humanScore} 分（標準 ${result.par}）${qualified ? '，已合格' : ''}。籌碼 ${fmt(humanDelta)}。`,
    });
  } else if (result.result === 'draw') {
    lessons.push({
      title: '本局平手',
      detail: `你與別人同為 ${humanScore} 分。籌碼 ${fmt(humanDelta)}（相對標準分結算）。`,
    });
  } else {
    lessons.push({
      title: '這局分數落後',
      detail: `你 ${humanScore} 分／標準 ${result.par}。籌碼 ${fmt(humanDelta)}——合格線決定輸贏幅度。`,
    });
  }

  if (qualified) {
    lessons.push({
      title: '你合格了',
      detail: `超過標準分 ${result.par} 的部分會變成正籌碼；這就是系列賽要追的中期目標。`,
    });
  } else {
    lessons.push({
      title: '未過合格分',
      detail: `差 ${Math.max(0, Math.ceil(result.par - humanScore))} 分才合格。系列賽裡這條線每一局都在扣／加籌碼。`,
    });
  }

  if (result.doubleRedFiveSeat !== null) {
    const who = seatName(result.doubleRedFiveSeat);
    lessons.push({
      title: `${who}過紅五`,
      detail: '同一回合吃到兩張紅 5，其餘各家各付 20 籌碼——這是台灣常見的大分家規。',
    });
  }

  if (result.zeroScoreSeat !== null) {
    const who = seatName(result.zeroScoreSeat);
    lessons.push({
      title: `${who}拼零分`,
      detail: `整局一分未得，向其餘各家各收 ${Math.round(result.par)} 籌碼。`,
    });
  }

  const fed = state.log.filter(
    (e) => e.by === HUMAN && e.taken === null && e.source === 'hand' && e.points > 0,
  );
  if (fed.length > 0) {
    const worst = fed.reduce((a, b) => (a.points >= b.points ? a : b));
    lessons.push({
      title: '你丟過紅牌上桌',
      detail: `例如 ${cardLabel(worst.played)}（${worst.points} 分）——棄牌時優先丟黑牌，才不會餵分。`,
    });
  }

  const aceTakes = state.log.filter(
    (e) =>
      e.by === HUMAN &&
      e.taken &&
      (e.played.rank === 1 || e.taken.rank === 1) &&
      e.points >= 20,
  );
  if (aceTakes.length > 0 && result.result === 'win') {
    lessons.push({
      title: '你鎖住了 A',
      detail: '紅 A 一張 20 分，掌握 9 的人往往決定 40 分的去向。',
    });
  }

  const trimmed = lessons.slice(0, 4);
  const highlight = fmt(humanDelta);

  return {
    winners: result.winners,
    scores: result.scores,
    par: result.par,
    deltas: result.deltas,
    lessons: trimmed,
    highlight,
  };
}

function seatName(seat: Seat): string {
  return SEAT_NAMES[seat] ?? `座位${seat}`;
}

function fmt(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
