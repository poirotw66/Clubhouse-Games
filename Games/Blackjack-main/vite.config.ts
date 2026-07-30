import { createRequire } from 'node:module';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

const require = createRequire(path.resolve(__dirname, 'package.json'));
function resolvePkg(name: string): string {
  return path.dirname(require.resolve(`${name}/package.json`));
}


export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    // Prevent Vite from walking up to root postcss.config.js (Tailwind v3).
    css: { postcss: { plugins: [] } },
    base: process.env.BASE_URL || './',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@clubhouse/shared': path.resolve(__dirname, '../../shared'),
        'react': resolvePkg('react'),
        'react/jsx-runtime': path.join(resolvePkg('react'), 'jsx-runtime.js'),
        'react-dom': resolvePkg('react-dom'),
      },
    },
    server: {
      fs: { allow: [path.resolve(__dirname, '../..')] },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
