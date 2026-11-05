import type { ReactElement } from 'react';
import { ATTR_LABELS } from '../game/config';
import { previewTrainingPlan } from '../game/engine';
import type { GameState, TurnReport } from '../game/types';

export const signed = (value: number): string => `${value > 0 ? '+' : ''}${value}`;

/** Visible costs come from the same cards and scaling used by the resolver. */
export function TrainingPlan({ state, optionId, onConfirm }: {
  state: GameState;
  optionId: string | null;
  onConfirm: () => void;
}): ReactElement {
  const preview = optionId ? previewTrainingPlan(state, optionId) : null;
  const fatigueWarning = state.meta.fatigue > 65;
  const lowMotivation = state.meta.motivation < 35;
  const primaryStep = state.stage === 'highschool' && !state.pendingPrimaryId && state.decision?.title.endsWith('・主課');
  return (
    <div className="bl-training-plan" data-training-workspace="true">
      <div className="bl-plan-heading">
        <span>{primaryStep ? '01 主課選擇' : state.pendingPrimaryId ? '02 副課搭配' : '本回合訓練計畫'}</span>
        <span>疲勞 {state.meta.fatigue} · 動機 {state.meta.motivation}</span>
      </div>
      <p className={`bl-condition-note ${fatigueWarning || lowMotivation ? 'is-warning' : ''}`}>
        {fatigueWarning ? '疲勞超過 65，骰運可能下降。搭配恢復課，為下次訓練留力。' : lowMotivation ? '動機低於 35，骰運可能下降。影片、筆記與恢復能找回節奏。' : primaryStep || state.pendingPrimaryId ? '先選課看負荷，再確認執行。主課＋副課共用一次訓練骰。' : '先選課看負荷，再確認執行。成長由訓練骰與球員狀態決定。'}
      </p>
      {preview ? (
        <div data-training-preview="true" aria-live="polite">
          <ol className="bl-plan-cards">
            {preview.cards.map((card, index) => <li key={`${card.id}-${index}`}>
              <span>{preview.cards.length > 1 ? index === 0 ? '主課' : '副課' : preview.needsSecondary ? '主課' : '課程'}</span>
              <strong>{card.label}</strong>
              <small>{card.recovery ? '恢復體能與動機' : card.focus.map((key) => ATTR_LABELS[key]).join('・') || '調整狀態'}</small>
            </li>)}
            {preview.needsSecondary && <li className="bl-plan-next"><span>副課</span><strong>接著安排補強或恢復</strong><small>確認主課後再選，現在不擲骰</small></li>}
          </ol>
          <div className="bl-plan-costs">
            <div><span>課表疲勞 <b className={preview.fatigueChange > 0 ? 'bl-cost-up' : 'bl-cost-down'}>{signed(preview.fatigueChange)}</b></span><strong>{state.meta.fatigue} <span aria-hidden="true">→</span> {preview.fatigueAfterCards}</strong></div>
            <div><span>基礎動機 <b className={preview.motivationChange < 0 ? 'bl-cost-up' : 'bl-cost-down'}>{signed(preview.motivationChange)}</b></span><strong>{state.meta.motivation} <span aria-hidden="true">→</span> {preview.motivationAfterCards}</strong></div>
          </div>
          <p className="bl-plan-caveat">{preview.needsSecondary ? '這是主課基礎變化；副課還能補強或抵銷疲勞。' : '這是整份課表的基礎變化；骰運、事件與回合末恢復會影響實際結果。'}</p>
          <button type="button" data-training-confirm="true" onClick={onConfirm} className="bl-plan-confirm">{preview.needsSecondary ? '排定主課，搭配副課' : '確認課表，開始訓練'} <kbd>Enter</kbd></button>
        </div>
      ) : <p className="bl-plan-empty">選一張課程卡，先看看這次投資與消耗。<br /><span>點選只預覽，確認後才會推進生涯。</span></p>}
    </div>
  );
}

/** The settled report is actual outcome, not an estimate of a hidden future roll. */
export function TrainingPayoff({ report }: { report: TurnReport }): ReactElement {
  const attributeKeys = Object.keys(ATTR_LABELS);
  const growth = Object.entries(report.deltas).reduce((sum, [key, value]) => attributeKeys.includes(key) && value && value > 0 ? sum + value : sum, 0);
  return <div className="bl-training-payoff" data-training-result="true" aria-label="本次訓練成果">
    <div><span>能力累積</span><strong>+{growth}</strong></div>
    <div><span>疲勞變化</span><strong className={(report.deltas.fatigue ?? 0) > 0 ? 'bl-cost-up' : 'bl-cost-down'}>{signed(report.deltas.fatigue ?? 0)}</strong></div>
    <div><span>動機變化</span><strong className={(report.deltas.motivation ?? 0) < 0 ? 'bl-cost-up' : 'bl-cost-down'}>{signed(report.deltas.motivation ?? 0)}</strong></div>
  </div>;
}
