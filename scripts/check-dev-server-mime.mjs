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
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HOST, MIME, createRequestListener, requestListener } from '../server.mjs';

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
  '/gpt6-astra/webmcp-mini-tactical-dungeon/rules.mjs',
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

// Raw HTTP paths preserve traversal payloads that fetch() would normalize away.
function request(port, urlPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'clubhouse-dev-server-'));
const fixtureRoot = path.join(fixture, 'site');
function writeFixture(relativePath, content) {
  const file = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
let fixtureServer;
try {
  writeFixture('index.html', '<h1>Fixture menu</h1>');
  writeFixture('README.md', '# Fixture specs');
  writeFixture('assets/menu.js', 'export const fixture = true;');
  writeFixture('assets/nested/index.html', '<p>Nested asset</p>');
  writeFixture('assets-private/secret.txt', 'Fixture private sibling');
  writeFixture('.env', 'FIXTURE_SECRET=do-not-serve');
  writeFixture('.git/HEAD', 'Fixture private metadata');
  writeFixture('package.json', '{}');
  writeFixture('Games/Demo/dist/index.html', '<h1>Fixture game</h1>');
  writeFixture('Games/Demo/dist/assets/app.js', 'export const game = true;');
  writeFixture('Games/Demo/dist/.env', 'FIXTURE_GAME_SECRET=do-not-serve');
  writeFixture('Games/Demo/dist-private/secret.txt', 'Fixture private build sibling');
  writeFixture('gpt6-astra/demo/index.html', '<h1>Fixture Astra</h1>');
  fs.symlinkSync('../.env', path.join(fixtureRoot, 'assets', 'secret.txt'));
  fs.symlinkSync('../assets-private/secret.txt', path.join(fixtureRoot, 'assets', 'sibling.txt'));
  fs.symlinkSync('../dist-private/secret.txt', path.join(fixtureRoot, 'Games/Demo/dist', 'sibling.txt'));
  fs.symlinkSync('menu.js', path.join(fixtureRoot, 'assets', 'local.js'));
  fs.symlinkSync('../.git', path.join(fixtureRoot, 'assets', 'git'));
  fs.symlinkSync('Demo', path.join(fixtureRoot, 'Games', 'Alias'));
  fixtureServer = http.createServer(createRequestListener(fixtureRoot, 'Fixture'));
  await new Promise((resolve, reject) => {
    fixtureServer.listen(0, '127.0.0.1', resolve);
    fixtureServer.on('error', reject);
  });
  const { port: fixturePort } = fixtureServer.address();
  for (const urlPath of [
    '/.env', '/.git/HEAD', '/%2eenv', '/Fixture/.env', '/assets/../.env',
    '/assets/%2e%2e/.env', '/assets/..%2f.env', '/assets/secret.txt',
    '/assets/sibling.txt', '/assets/git/HEAD', '/assets/../assets-private/secret.txt',
    '/Games/Demo/dist-private/secret.txt', '/Games/Demo/.env',
    '/Games/Demo/%2e%2e/dist-private/secret.txt', '/Games/Demo/sibling.txt',
    '/Games/Alias/', '/package.json', '/server.mjs', '/node_modules/example.js',
    '/Games/Demo/missing.js', '/Games/Demo/missing-route', '/Games/Missing/',
    '/assets/missing.js',
  ]) {
    assert.equal((await request(fixturePort, urlPath)).status, 404, urlPath);
  }
  for (const urlPath of ['/%ZZ', '/%E0%A4%A', '/%00', '/assets%5c..%5c.env', '//other-host/']) {
    assert.equal((await request(fixturePort, urlPath)).status, 400, urlPath);
  }
  for (const urlPath of ['/', '/Fixture/', '/README.md', '/assets/local.js', '/Games/Demo/', '/Fixture/Games/Demo/', '/gpt6-astra/demo/']) {
    assert.equal((await request(fixturePort, urlPath)).status, 200, urlPath);
  }
  const module = await request(fixturePort, '/Games/Demo/assets/app.js');
  assert.equal(module.status, 200);
  assert.match(module.headers['content-type'], /^application\/javascript/);
  assert.equal(module.body, 'export const game = true;');
  const redirect = await request(fixturePort, '/Fixture/Games/Demo?seed=demo');
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.location, '/Fixture/Games/Demo/?seed=demo');
  const nestedRedirect = await request(fixturePort, '/assets/nested');
  assert.equal(nestedRedirect.status, 301);
  assert.equal(nestedRedirect.headers.location, '/assets/nested/');
  const head = await request(fixturePort, '/assets/menu.js', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  const post = await request(fixturePort, '/', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
  assert.equal(HOST, process.env.HOST || '127.0.0.1');
} finally {
  if (fixtureServer?.listening) await new Promise((resolve) => fixtureServer.close(resolve));
  fs.rmSync(fixture, { recursive: true, force: true });
}
console.log('Dev server security ok (public routes, traversal, symlinks, malformed paths, 404s, redirects and HEAD).');
