#!/usr/bin/env node
/**
 * Guard the local `npm run dev` MIME table.
 *
 * Regression: .mjs was served as application/octet-stream, so browsers refused
 * to load ES modules (gpt6-astra archer / train / borderland rules.mjs).
 *
 * Usage: node scripts/check-dev-server-mime.mjs
 */

import http from 'node:http';
import { MIME, requestListener } from '../server.mjs';

const REQUIRED = {
  '.mjs': 'text/javascript',
  '.js': 'application/javascript',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.webm': 'video/webm',
  '.html': 'text/html',
  '.json': 'application/json',
  '.css': 'text/css',
};

const LIVE_PATHS = [
  '/gpt6-astra/archer/rules.mjs',
  '/gpt6-astra/train/rules.mjs',
  '/gpt6-astra/borderland/rules.mjs',
];

const missing = Object.entries(REQUIRED).filter(([ext, type]) => MIME[ext] !== type);
if (missing.length > 0) {
  console.error('MIME table mismatch:');
  for (const [ext, type] of missing) {
    console.error(`  ${ext}: expected ${type}, got ${MIME[ext] ?? '(missing)'}`);
  }
  process.exit(1);
}

const server = http.createServer(requestListener);
await new Promise((resolve, reject) => {
  server.listen(0, '127.0.0.1', resolve);
  server.on('error', reject);
});
const { port } = server.address();

try {
  for (const urlPath of LIVE_PATHS) {
    const res = await fetch(`http://127.0.0.1:${port}${urlPath}`);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      throw new Error(`${urlPath}: HTTP ${res.status}`);
    }
    if (!contentType.startsWith('text/javascript')) {
      throw new Error(
        `${urlPath}: expected text/javascript*, got ${JSON.stringify(contentType)}`,
      );
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(
  `Dev server MIME ok (${Object.keys(REQUIRED).length} extensions; ${LIVE_PATHS.length} live .mjs checks).`,
);
