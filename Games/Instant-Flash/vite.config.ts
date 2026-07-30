import { createRequire } from 'node:module';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const require = createRequire(path.resolve(__dirname, 'package.json'));
function resolvePkg(name: string): string {
  return path.dirname(require.resolve(`${name}/package.json`));
}


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const base = process.env.BASE_URL ?? './';

  return {

    // Prevent Vite from walking up to root postcss.config.js (Tailwind v3).

    css: { postcss: { plugins: [] } },
    base,
    server: {
      fs: { allow: [path.resolve(__dirname, '../..')] },
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@clubhouse/shared': path.resolve(__dirname, '../../shared'),
        'react': resolvePkg('react'),
        'react/jsx-runtime': path.join(resolvePkg('react'), 'jsx-runtime.js'),
        'react-dom': resolvePkg('react-dom'),
        tailwindcss: resolvePkg('tailwindcss'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
  };
});
