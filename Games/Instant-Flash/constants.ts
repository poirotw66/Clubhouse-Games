// Timing Windows (in milliseconds)
// The "Impact Frame" is 0. 
// Negative means early release, Positive means late.
// But for this game logic: Warning happens -> Delay -> Impact.
// Player must release closest to Impact.

export const WARNING_DURATION_MIN = 1000;
export const WARNING_DURATION_MAX = 2200;

// Projectile Flight Durations (Speed)
export const DURATION_SHURIKEN = 550; // Standard
export const DURATION_KUNAI = 380;    // FAST! Requires instant reaction
export const DURATION_BOMB = 850;     // Slow... baits early release
export const DURATION_SICKLE = 600;   // Medium

// Windows calculated as absolute difference from Impact Time
export const WINDOW_PERFECT = 120; 
export const WINDOW_GOOD = 300;    

// Gameplay
export const MAX_HP = 100;
export const DAMAGE_PLAYER_HIT = 25; 
export const DAMAGE_PLAYER_BLOCK = 5; 
export const HEAL_PERFECT = 15; 

export const SCORE_PERFECT = 1000;
export const SCORE_GOOD = 300;

// Visuals
export const HIT_STOP_DURATION = 150; 
export const SHAKE_DURATION = 300;

// Colors
export const COLOR_PERFECT = '#3b82f6'; // blue-500
export const COLOR_GOOD = '#eab308'; // yellow-500
export const COLOR_FAIL = '#ef4444'; // red-500
export const COLOR_NEUTRAL = '#94a3b8'; // slate-400