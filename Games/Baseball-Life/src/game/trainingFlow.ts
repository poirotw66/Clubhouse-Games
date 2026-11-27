export interface TrainingSelectionInput {
  optionId: string;
  selectedOptionId: string | null;
  quickConfirm: boolean;
  canPreview: boolean;
}

export type TrainingSelectionAction =
  | { action: 'ignore'; nextSelectedId: string | null }
  | { action: 'preview'; nextSelectedId: string }
  | { action: 'commit'; optionId: string; nextSelectedId: null };

/**
 * Resolves a click or hotkey pick on a training option card.
 *
 * When quick-confirm is enabled, any valid option commits in one step (matching
 * event/clutch pacing). Otherwise, the first click previews the workload in the
 * TrainingPlan panel and a second click on the same card (or Confirm/Enter) commits.
 */
export function stepTrainingSelection(input: TrainingSelectionInput): TrainingSelectionAction {
  if (!input.canPreview) {
    return { action: 'ignore', nextSelectedId: input.selectedOptionId };
  }
  if (input.quickConfirm || input.selectedOptionId === input.optionId) {
    return { action: 'commit', optionId: input.optionId, nextSelectedId: null };
  }
  return { action: 'preview', nextSelectedId: input.optionId };
}
