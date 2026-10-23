/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './assets/menu.js'],
  theme: {
    extend: {
      colors: {
        /* Mist-neon arcade: deep ink + cyan mist (avoid AI violet defaults). */
        primary: '#2DD4BF',
        secondary: '#67E8F9',
        cta: '#FB7185',
        dream: '#06080F',
        dreamCard: 'rgba(10, 16, 32, 0.78)',
        mist: '#A5F3FC',
        aurora: '#F472B6',
      },
      fontFamily: {
        heading: ['Russo One', 'sans-serif'],
        body: ['Chakra Petch', 'sans-serif'],
        tc: ['Noto Sans TC', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 22px rgba(45, 212, 191, 0.28), 0 0 48px rgba(103, 232, 249, 0.12)',
        glowHover: '0 0 28px rgba(45, 212, 191, 0.42), 0 0 64px rgba(244, 114, 182, 0.16)',
        ctaGlow: '0 0 18px rgba(251, 113, 133, 0.42)',
      },
    },
  },
  plugins: [],
};
