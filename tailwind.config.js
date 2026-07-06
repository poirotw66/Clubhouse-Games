/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './assets/menu.js'],
  theme: {
    extend: {
      colors: {
        primary: '#7C3AED',
        secondary: '#A78BFA',
        cta: '#F43F5E',
        dream: '#0F0F23',
        dreamCard: 'rgba(30, 27, 75, 0.6)',
      },
      fontFamily: {
        heading: ['Russo One', 'sans-serif'],
        body: ['Chakra Petch', 'sans-serif'],
        tc: ['Noto Sans TC', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(124, 58, 237, 0.3), 0 0 40px rgba(124, 58, 237, 0.15)',
        glowHover: '0 0 28px rgba(124, 58, 237, 0.45), 0 0 56px rgba(124, 58, 237, 0.2)',
        ctaGlow: '0 0 16px rgba(244, 63, 94, 0.4)',
      },
    },
  },
  plugins: [],
};
