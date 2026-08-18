/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // The shared components (ResultOverlay, BackToMenu, ScoreFlash, TouchButton)
    // live outside this game's folder. Without this glob their classes are only
    // generated when this game's own markup happens to use the same ones, which
    // is how overlays ended up rendering with no `fixed`/`z-30`.
    '../../shared/**/*.{js,ts,jsx,tsx}','./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
