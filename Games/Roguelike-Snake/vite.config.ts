import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
  const base = process.env.BASE_URL ?? './';

  return {
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
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
  };
});
