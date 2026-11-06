import { useEffect } from 'react';
import type { GameState } from '../types';

export interface KeyboardActions {
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onSurrender: () => void;
  onDeal: () => void;
  onResetRound: () => void;
  onClearBet: () => void;
  onMinBet: () => void;
  onUndoBet: () => void;
  onHint: () => void;
  onPlaceChipIndex: (index: number) => void;
  onTakeInsurance: () => void;
  onDeclineInsurance: () => void;
  onTakeEvenMoney: () => void;
  onDeclineEvenMoney: () => void;
  onToggleShortcuts: () => void;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  canDeal: boolean;
  canResetRound: boolean;
  canUndoBet: boolean;
  canHint: boolean;
  gameState: GameState;
  hasOpenModal: boolean;
}

export function useKeyboardControls(actions: KeyboardActions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // One physical press performs one action; browser shortcuts keep their native behavior.
      if (e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const shortcutTarget = e.target instanceof HTMLElement ? e.target : null;
      if (shortcutTarget?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if ((e.key === ' ' || e.key === 'Enter') && shortcutTarget?.closest('button, a, [role="button"]')) return;
      // Ignore if user is typing in an input or contenteditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Do not intercept if browser modifier keys are held
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const key = e.key.toLowerCase();

      // Shortcuts modal toggle [K] works anytime unless typing
      if (key === 'k') {
        e.preventDefault();
        actions.onToggleShortcuts();
        return;
      }

      // If a modal or dialog is open, do not trigger game board actions
      if (actions.hasOpenModal) {
        return;
      }

      // Space or Enter: Deal or Next Round
      if (e.key === ' ' || e.key === 'Enter') {
        if (actions.gameState === 'betting' && actions.canDeal) {
          e.preventDefault();
          actions.onDeal();
          return;
        }
        if (actions.gameState === 'gameOver' && actions.canResetRound) {
          e.preventDefault();
          actions.onResetRound();
          return;
        }
      }

      // Playing phase hotkeys
      if (actions.gameState === 'playing') {
        if (key === 'h' && actions.canHit) {
          e.preventDefault();
          actions.onHit();
          return;
        }
        if (key === 's' && actions.canStand) {
          e.preventDefault();
          actions.onStand();
          return;
        }
        if (key === 'd' && actions.canDouble) {
          e.preventDefault();
          actions.onDouble();
          return;
        }
        if (key === 'p' && actions.canSplit) {
          e.preventDefault();
          actions.onSplit();
          return;
        }
        if (key === 'r' && actions.canSurrender) {
          e.preventDefault();
          actions.onSurrender();
          return;
        }
      }

      // Betting phase hotkeys
      if (actions.gameState === 'betting') {
        if (key === 'c') {
          e.preventDefault();
          actions.onClearBet();
          return;
        }
        if (key === 'm') {
          e.preventDefault();
          actions.onMinBet();
          return;
        }
        if (key === 'z' && actions.canUndoBet) {
          e.preventDefault();
          actions.onUndoBet();
          return;
        }
        if (['1', '2', '3', '4', '5'].includes(key)) {
          const index = parseInt(key, 10) - 1;
          e.preventDefault();
          actions.onPlaceChipIndex(index);
          return;
        }
      }

      // Insurance phase hotkeys
      if (actions.gameState === 'insurance') {
        if (key === 'i' || key === 'y') {
          e.preventDefault();
          actions.onTakeInsurance();
          return;
        }
        if (key === 'n') {
          e.preventDefault();
          actions.onDeclineInsurance();
          return;
        }
        if (key === 'r' && actions.canSurrender) {
          e.preventDefault();
          actions.onSurrender();
          return;
        }
      }

      // Even money phase hotkeys
      if (actions.gameState === 'evenMoney') {
        if (key === 'y') {
          e.preventDefault();
          actions.onTakeEvenMoney();
          return;
        }
        if (key === 'n') {
          e.preventDefault();
          actions.onDeclineEvenMoney();
          return;
        }
      }

      // Strategy hint hotkey
      if ((key === 't' || e.key === '?') && actions.canHint) {
        e.preventDefault();
        actions.onHint();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
