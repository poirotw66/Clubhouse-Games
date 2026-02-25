/**
 * Single dev server: serves repo root (menu, specs) and each game from Games/<name>/dist/.
 * One process for everything; build games with: npm run build:game <folder>
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html',
  '.md': 'text/markdown',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const TEXT_EXTENSIONS = new Set(['.html', '.md', '.css', '.js', '.json']);

function send(res, status, body, contentType = 'text/html') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    send(res, 404, 'Not Found', 'text/plain');
    return;
  }
  const ext = path.extname(filePath);
  let type = MIME[ext] || 'application/octet-stream';
  if (TEXT_EXTENSIONS.has(ext)) {
    type += '; charset=utf-8';
  }
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => { try { res.end(); } catch (_) {} });
  res.writeHead(200, { 'Content-Type': type });
  stream.pipe(res);
}

function serveGameDist(res, gameDir, reqPath) {
  const distDir = path.join(__dirname, 'Games', gameDir, 'dist');
  const normalized = reqPath === '/' || reqPath === '' ? '/index.html' : reqPath;
  const filePath = path.join(distDir, normalized.replace(/^\//, '').replace(/\/$/, '') || 'index.html');
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(distDir))) {
    send(res, 404, 'Not Found', 'text/plain');
    return;
  }
  if (!fs.existsSync(resolved)) {
    if (fs.existsSync(path.join(distDir, 'index.html'))) {
      serveFile(res, path.join(distDir, 'index.html'));
    } else {
      send(res, 404, 'Game not built. Run: npm run build:game ' + gameDir, 'text/plain');
    }
    return;
  }
  if (fs.statSync(resolved).isDirectory()) {
    serveFile(res, path.join(resolved, 'index.html'));
    return;
  }
  serveFile(res, resolved);
}

export const requestListener = (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const reqPath = decodeURIComponent(url.pathname);

  if (reqPath.startsWith('/Games/')) {
    const rest = reqPath.slice('/Games/'.length);
    const gameDir = rest.split('/')[0];
    if (gameDir) {
      const subPath = rest.slice(gameDir.length) || '/';
      // Redirect /Games/Blackjack-main -> /Games/Blackjack-main/ so relative paths (./assets/...) resolve correctly
      if (subPath === '/' && !reqPath.endsWith('/')) {
        const distIndex = path.join(__dirname, 'Games', gameDir, 'dist', 'index.html');
        if (fs.existsSync(distIndex)) {
          res.writeHead(301, { Location: reqPath + '/' });
          res.end();
          return;
        }
      }
      serveGameDist(res, gameDir, subPath);
      return;
    }
  }

  const rootPath = path.join(__dirname, reqPath === '/' ? 'index.html' : reqPath.replace(/^\//, ''));
  const resolved = path.resolve(rootPath);
  const rootResolved = path.resolve(__dirname);
  if (!resolved.startsWith(rootResolved) || resolved === rootResolved) {
    const index = path.join(rootResolved, 'index.html');
    if (fs.existsSync(index)) {
      serveFile(res, index);
      return;
    }
    send(res, 404, 'Not Found', 'text/plain');
    return;
  }
  if (!fs.existsSync(resolved)) {
    send(res, 404, 'Not Found', 'text/plain');
    return;
  }
  if (fs.statSync(resolved).isDirectory()) {
    const index = path.join(resolved, 'index.html');
    if (fs.existsSync(index)) {
      serveFile(res, index);
      return;
    }
    send(res, 404, 'Not Found', 'text/plain');
    return;
  }
  serveFile(res, resolved);
};

const server = http.createServer(requestListener);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Clubhouse Games: http://localhost:${PORT}`);
  console.log('  Menu & specs from root; games from Games/<name>/dist/ (build with: npm run build:game <name>)');
});
