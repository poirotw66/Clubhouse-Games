import { clubhouseSharedTailwindContent } from '@clubhouse/shared/tailwind-content';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // Scan @clubhouse/shared via absolute globs (see shared/tailwind-content.mjs).
    ...clubhouseSharedTailwindContent(),
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
