/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        sizzle: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.2)' },
        },
        'cook-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
        'result-pop': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '60%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        steam: {
          '0%': { opacity: '0', transform: 'translateY(0) scale(0.5)' },
          '50%': { opacity: '0.5' },
          '100%': { opacity: '0', transform: 'translateY(-12px) scale(1.2)' },
        },
      },
      animation: {
        sizzle: 'sizzle 0.6s ease-in-out infinite',
        'cook-pulse': 'cook-pulse 1.2s ease-in-out infinite',
        'result-pop': 'result-pop 0.35s ease-out forwards',
        steam: 'steam 1.5s ease-out infinite',
      },
    },
  },
  plugins: [],
};
