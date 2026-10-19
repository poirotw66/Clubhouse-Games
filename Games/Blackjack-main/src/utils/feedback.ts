import type { Card } from '../types.ts';
import {
  recommendAction,
  STRATEGY_LABELS,
  type StrategyAction,
  type StrategyContext,
} from './basicStrategy.ts';

export interface DecisionRecord {
  phase: StrategyContext['phase'];
  playerCards: Card[];
  dealerUpcard: Card;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  /** Action the player actually took. */
  taken: StrategyAction;
}

export interface DecisionVerdict {
  taken: StrategyAction;
  recommended: StrategyAction;
  correct: boolean;
  takenLabel: string;
  recommendedLabel: string;
  summary: string;
}

/** Map UI verbs onto StrategyAction ids. */
export function asStrategyAction(
  verb:
    | 'hit'
    | 'stand'
    | 'double'
    | 'split'
    | 'surrender'
    | 'takeEvenMoney'
    | 'declineEvenMoney'
    | 'takeInsurance'
    | 'declineInsurance',
): StrategyAction {
  return verb;
}

export function evaluateDecision(record: DecisionRecord): DecisionVerdict {
  const recommended = recommendAction({
    phase: record.phase,
    playerCards: record.playerCards,
    dealerUpcard: record.dealerUpcard,
    canDouble: record.canDouble,
    canSplit: record.canSplit,
    canSurrender: record.canSurrender,
  });
  const correct = recommended === record.taken;
  const takenLabel = STRATEGY_LABELS[record.taken];
  const recommendedLabel = STRATEGY_LABELS[recommended];
  const summary = correct
    ? `正確：${takenLabel}`
    : `應為「${recommendedLabel}」，你選了「${takenLabel}」`;
  return {
    taken: record.taken,
    recommended,
    correct,
    takenLabel,
    recommendedLabel,
    summary,
  };
}

export function summarizeHandFeedback(verdicts: DecisionVerdict[]): {
  correct: number;
  total: number;
  lines: string[];
  headline: string;
} {
  const total = verdicts.length;
  const correct = verdicts.filter(v => v.correct).length;
  const lines = verdicts.map(v => v.summary);
  let headline: string;
  if (total === 0) headline = '本局無決策可評。';
  else if (correct === total) headline = '本局決策全部正確！';
  else if (correct === 0) headline = '本局決策皆偏離基本策略。';
  else headline = `本局 ${correct}/${total} 步符合基本策略。`;
  return { correct, total, lines, headline };
}
