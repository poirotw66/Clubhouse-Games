import { defineConfig } from 'vite';

export default defineConfig(() => {
  const base = process.env.BASE_URL ?? './';
  return {
    base,
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
  };
});
