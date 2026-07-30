import { createRequire } from 'node:module';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const require = createRequire(path.resolve(__dirname, 'package.json'));
function resolvePkg(name: string): string {
  return path.dirname(require.resolve(`${name}/package.json`));
}


export default defineConfig(() => {
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
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@clubhouse/shared': path.resolve(__dirname, '../../shared'),
        'react': resolvePkg('react'),
        'react/jsx-runtime': path.join(resolvePkg('react'), 'jsx-runtime.js'),
        'react-dom': resolvePkg('react-dom'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
  };
});
