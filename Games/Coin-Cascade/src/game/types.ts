/**
 * Coin Cascade — pure simulation types. Nothing here touches the DOM, so
 * scripts/self-check.ts and scripts/balance.ts can import the whole engine
 * headlessly.
 */

/** The three purchasable coin kinds, plus the free trigger token. */
export type CoinKind = 'normal' | 'heavy' | 'ball' | 'trigger';

export interface Coin {
  readonly id: number;
  readonly kind: CoinKind;
  x: number;
  y: number;
  /** Set the tick a coin first overhangs the front edge, cleared once it stops. Drives the near-miss highlight. */
  teeterSince: number;
}

export type Phase = 'playing' | 'ended';

export interface PlayerInput {
  /** Horizontal chute position for this tick's drop, in shelf-space x (already clamped by the caller). */
  dropX: number;
  /** True on the single tick the player wants to drop (or fire the shake action, if `special` is 'vibrate'). Edge-triggered by the caller. */
  drop: boolean;
  /** Which purchasable kind the next drop/action uses. 'normal' costs 1 credit; the others cost more. */
  special: 'normal' | 'heavy' | 'ball' | 'vibrate';
}

export interface FallEvent {
  readonly coinId: number;
  readonly kind: CoinKind;
  readonly x: number;
}

/** One tick's worth of things that happened, for the presentation layer to react to (sound, flashes). Cleared every step. */
export interface TickEvents {
  readonly fallen: readonly FallEvent[];
  /** Size of the cascade FINALISED this tick (the stroke just ended and totalled >= CASCADE_MIN), or 0. */
  readonly cascadeFinalized: number;
  readonly jackpotBurst: number;
  readonly shook: boolean;
  readonly rejectedDrop: boolean;
}

export interface RunState {
  readonly seed: number;
  readonly seedCode: string;
  readonly tick: number;
  readonly phase: Phase;

  readonly coins: readonly Coin[];
  readonly nextCoinId: number;

  /** Ticks since the last accepted drop; a new drop is accepted once this clears the cooldown. */
  readonly cooldown: number;
  readonly ticksSinceLastDrop: number;

  readonly creditsRemaining: number;
  readonly creditsSpent: number;
  readonly coinsRecovered: number;
  readonly score: number;

  readonly pot: number;
  /** x-center of the current trigger zone; the live trigger coin should be walked here-ward and off the edge. */
  readonly triggerZoneX: number;
  readonly jackpotBursts: number;
  readonly potAwarded: number;

  readonly cascadeCount: number;
  readonly longestCascade: number;
  readonly nearMissCount: number;
  readonly shakesUsed: number;

  /**
   * A cascade is scored per push-STROKE ("推程"), not per physics tick — it
   * is vanishingly rare for 3+ coins to cross the edge in the same 1/60s
   * tick, but common for a rank of coins to all go over during one forward
   * sweep of the plate. These two fields accumulate the current forward
   * stroke's fall count; the tally is finalised (scored, and reset) the
   * moment the plate turns to retreat.
   */
  readonly strokeFallen: number;
  readonly strokeWasForward: boolean;

  /** Last tick's events, for the UI/audio layer. Deterministic like everything else, so it is still part of replay-equality. */
  readonly events: TickEvents;
}
