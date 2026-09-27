import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  const base = process.env.BASE_URL ?? './';
  return {
    base,
    server: {
      port: 3000,
      host: '0.0.0.0',
      fs: { allow: [path.resolve(rootDir, '../..')] },
    },
    resolve: {
      alias: {
        '@clubhouse/shared': path.resolve(rootDir, '../../shared'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
  };
});
