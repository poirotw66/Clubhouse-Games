/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // The shared components (ResultOverlay, BackToMenu, ScoreFlash, TouchButton)
    // live outside this game's folder. Without this glob their classes are only
    // generated when this game's own markup happens to use the same ones, which
    // is how overlays ended up rendering with no `fixed`/`z-30`.
    '../../shared/**/*.{js,ts,jsx,tsx}',
    './index.html',
    './*.{tsx,ts,jsx,js}',
    './components/**/*.{tsx,ts,jsx,js}',
    './context/**/*.{tsx,ts,jsx,js}',
    './utils/**/*.{tsx,ts,jsx,js}',
    './services/**/*.{tsx,ts,jsx,js}',
  ],
  theme: {
    extend: {
      animation: {
        'fade-in-down': 'fadeInDown 0.8s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'shine': 'shine 1.5s infinite',
        'bounce-short': 'bounceShort 0.5s infinite',
        'drop-in': 'dropIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shine: {
          '100%': { transform: 'translateX(100%)' },
        },
        bounceShort: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-25%)' },
        },
        dropIn: {
          '0%': { transform: 'translateY(-20px) scale(0.9)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
