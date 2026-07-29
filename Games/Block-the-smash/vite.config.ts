import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const base = process.env.BASE_URL ?? './';

  return {
    base,
    server: {
      fs: { allow: [path.resolve(__dirname, '../..')] },
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@clubhouse/shared': path.resolve(__dirname, '../../shared'),
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // The drill is a second entry, not a static file: this is what lets vite
      // bundle three from node_modules instead of the game fetching it from a
      // CDN at runtime.
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          game: path.resolve(__dirname, 'game.html'),
        },
      },
    },
  };
});
