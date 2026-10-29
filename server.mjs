/**
 * Single dev server: serves repo root (menu, specs) and each game from Games/<name>/dist/.
 * One process for everything; build games with: npm run build:game <folder>
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const REPO_NAME = process.env.REPO_NAME || 'Clubhouse-Games';
export const HOST = process.env.HOST || '127.0.0.1';

/** Exported so scripts/check-dev-server-mime.mjs can lock the table without spinning npm run dev. */
export const MIME = {
  '.html': 'text/html',
  '.md': 'text/markdown',
  '.css': 'text/css',
  '.js': 'application/javascript',
  // Browsers reject ES modules served as application/octet-stream (e.g. gpt6-astra/*/rules.mjs).
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const TEXT_EXTENSIONS = new Set([
  '.html', '.md', '.css', '.js', '.mjs', '.json', '.webmanifest', '.gltf',
]);

function send(res, status, body, contentType = 'text/html') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function serveFile(req, res, filePath) {
  const ext = path.extname(filePath);
  let type = MIME[ext] || 'application/octet-stream';
  if (TEXT_EXTENSIONS.has(ext)) {
    type += '; charset=utf-8';
  }
  res.writeHead(200, { 'Content-Type': type });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).on('error', () => res.destroy()).pipe(res);
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

const PUBLIC_DIRECTORIES = new Set([
  'assets', 'docs', 'gpt6-astra', '01-cards', '02-board', '03-tiles-dice',
  '04-sports-arcade', '05-puzzle', '06-minigames', '07-astra',
]);
const PUBLIC_FILES = new Set(['index.html', 'README.md', 'README_tw.md', 'title-image.jpg', 'data/games.json']);

/** A configurable root lets the regression check use isolated, non-secret fixtures. */
export function createRequestListener(rootDirectory = __dirname, repoName = REPO_NAME) {
  const root = fs.realpathSync(rootDirectory);
  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return send(res, 405, 'Method Not Allowed', 'text/plain');
    }
    let rawPath;
    const target = req.url || '/';
    try {
      if (!target.startsWith('/') || target.startsWith('//')) throw new URIError('Invalid request target');
      // Decode before normalization so encoded dot segments cannot bypass the guard.
      rawPath = decodeURIComponent(target.split('?')[0]);
      if (/[\u0000-\u001f\u007f\\]/.test(rawPath)) throw new URIError('Invalid path');
    } catch {
      return send(res, 400, 'Bad Request', 'text/plain');
    }
    if (rawPath.split('/').some((segment) => segment.startsWith('.') || segment === 'node_modules')) {
      return send(res, 404, 'Not Found', 'text/plain');
    }
    const repoPrefix = `/${repoName}`;
    const hasRepoPrefix = rawPath === repoPrefix || rawPath.startsWith(`${repoPrefix}/`);
    const reqPath = hasRepoPrefix ? rawPath.slice(repoPrefix.length) || '/' : rawPath;
    const relativePath = reqPath.slice(1) || 'index.html';
    const segments = relativePath.split('/');
    let mount;
    let file;
    if (segments[0] === 'Games' && segments[1]) {
      mount = path.join(root, 'Games', segments[1], 'dist');
      file = path.resolve(mount, segments.slice(2).join('/') || 'index.html');
    } else if (PUBLIC_DIRECTORIES.has(segments[0])) {
      mount = path.join(root, segments[0]);
      file = path.resolve(root, relativePath);
    } else if (PUBLIC_FILES.has(relativePath)) {
      mount = root;
      file = path.join(root, relativePath);
    } else {
      return send(res, 404, 'Not Found', 'text/plain');
    }
    try {
      if (!isWithin(mount, file) || fs.realpathSync(mount) !== mount) {
        return send(res, 404, 'Not Found', 'text/plain');
      }
      const isDirectory = fs.statSync(file).isDirectory();
      if (isDirectory) file = path.join(file, 'index.html');
      const realFile = fs.realpathSync(file);
      if (!isWithin(mount, realFile) || !isWithin(root, realFile)
        || path.relative(root, realFile).split(path.sep).some((part) => part.startsWith('.') || part === 'node_modules')
        || (mount === root && realFile !== file) || !fs.statSync(realFile).isFile()) {
        return send(res, 404, 'Not Found', 'text/plain');
      }
      // Every app uses root files or hash routes; missing files must remain 404s.
      const gameRoot = segments[0] === 'Games' && segments.length === 2;
      if ((isDirectory || gameRoot) && !rawPath.endsWith('/')) {
        const query = target.includes('?') ? target.slice(target.indexOf('?')) : '';
        const locationPath = rawPath.split('/').map(encodeURIComponent).join('/');
        res.writeHead(301, { Location: `${locationPath}/${query}` });
        return res.end();
      }
      serveFile(req, res, realFile);
    } catch {
      send(res, 404, 'Not Found', 'text/plain');
    }
  };
}

export const requestListener = createRequestListener();

const isMain =
  process.argv[1] != null && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const server = http.createServer(requestListener);
  server.listen(PORT, HOST, () => {
    console.log(`Clubhouse Games: http://${HOST}:${PORT}`);
    console.log('  Menu & specs from root; games from Games/<name>/dist/ (build with: npm run build:game <name>)');
  });
}
