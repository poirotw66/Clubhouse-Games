// Serve only the deployable artifact, with Pages-like paths and genuine 404s.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const prefix = `/${process.env.REPO_NAME || 'Clubhouse-Games'}/`;
const port = Number(process.env.PREVIEW_PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };

if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Run npm run build:pages first.');
const server = http.createServer((req, res) => {
  const fail = (status) => { res.writeHead(status); res.end(); };
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return fail(400); }
  if (!pathname.startsWith(prefix)) return fail(404);
  let file = path.resolve(root, pathname.slice(prefix.length));
  if (file !== path.resolve(root) && !file.startsWith(root)) return fail(404);
  try {
    if (fs.statSync(file).isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: `${pathname}/` });
        return res.end();
      }
      file = path.join(file, 'index.html');
    }
    if (!fs.statSync(file).isFile()) return fail(404);
  } catch { return fail(404); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
});
server.listen(port, '127.0.0.1', () => console.log(`Pages preview: http://127.0.0.1:${port}${prefix}`));
