#!/usr/bin/env node
/* rank-server.mjs — zero-dependency reference leaderboard server for the
   Wall Flip 2D online ranking (wall-flip/index.html).

   Usage:
     node rank-server.mjs [port]        # default port 8787

   Storage: rank-data.json, created beside this file ({ "c0": [...], "c1": [...] }).

   API (CORS: *, so a GitHub-Pages site can call it directly):
     GET  /top?c=N -> { board: [{ n, s, r, t }, ...] }      top 10 for course N
     POST /submit  body { n, s, r, c, t, log }
       -> 200 { ok: true, rank: <1-based rank of the inserted entry> }
       -> 4xx { ok: false, error: "..." } on invalid input

   Validation:
     n   string, trimmed 1-10 chars, basic profanity/URL filter
     s   integer 0-5000 (total score)
     r   integer 0-99 (rolls)
     c   integer 0-9 (course index)
     t   finite number >= 0 (run time, seconds)
     log array of <= 12000 pairs [int >= 0, int 0-15] — the input bitmask log
         used for future server-side replay verification (the game's physics
         is deterministic at 240 Hz, so a run can be re-simulated from it)

   Boards are sorted desc by score and capped at 100 entries per course.
   Score anti-cheat is best-effort only; see dev/README.md.
*/
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 8787;
const DATA_FILE = join(dirname(fileURLToPath(import.meta.url)), 'rank-data.json');
const MAX_LOG_PAIRS = 12000;
const MAX_BODY = 1 << 20; // 1 MiB

const loadDB = () => {
  try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')); } catch (e) { return {}; }
};
const saveDB = db => {
  try { writeFileSync(DATA_FILE, JSON.stringify(db)); }
  catch (e) { console.error('rank-server: save failed:', e.message); }
};

// basic profanity / spam-URL filter for names (best effort, not exhaustive)
const BAD_NAME = /(fuck|shit|bitch|cunt|nigg|fagg|rape|porn|nazi|hitler|https?:|www\.|\.com|\.net|\.org|\.ru|\.xyz)/i;

function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'body must be a JSON object';
  const n = typeof body.n === 'string' ? body.n.trim().slice(0, 10) : '';
  if (n.length < 1 || n.length > 10) return 'n must be a 1-10 char string';
  if (BAD_NAME.test(n)) return 'n rejected';
  if (!Number.isInteger(body.s) || body.s < 0 || body.s > 5000) return 's must be an integer 0-5000';
  if (!Number.isInteger(body.r) || body.r < 0 || body.r > 99) return 'r must be an integer 0-99';
  if (!Number.isInteger(body.c) || body.c < 0 || body.c > 9) return 'c must be an integer 0-9';
  if (typeof body.t !== 'number' || !Number.isFinite(body.t) || body.t < 0) return 't must be a finite number >= 0';
  if (!Array.isArray(body.log) || body.log.length > MAX_LOG_PAIRS) return 'log must be an array of <= ' + MAX_LOG_PAIRS + ' pairs';
  for (const p of body.log) {
    if (!Array.isArray(p) || p.length !== 2 ||
        !Number.isInteger(p[0]) || p[0] < 0 ||
        !Number.isInteger(p[1]) || p[1] < 0 || p[1] > 15) {
      return 'log pairs must be [int >= 0, int 0-15]';
    }
  }
  return { n, s: body.s, r: body.r, c: body.c, t: body.t, log: body.log };
}

function send(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(obj));
}

const db = loadDB();
const server = createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }

  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch (e) { send(res, 400, { ok: false, error: 'bad url' }); return; }

  if (req.method === 'GET' && url.pathname === '/top') {
    const cRaw = Number(url.searchParams.get('c'));
    const c = Number.isInteger(cRaw) && cRaw >= 0 && cRaw <= 9 ? cRaw : 0; // missing/invalid c defaults to course 0
    const list = Array.isArray(db['c' + c]) ? db['c' + c] : [];
    send(res, 200, { board: list.slice(0, 10) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/submit') {
    const chunks = [];
    let size = 0, aborted = false;
    req.on('data', chunk => {
      if (aborted) return;
      size += chunk.length;
      if (size > MAX_BODY) {
        aborted = true;
        send(res, 413, { ok: false, error: 'body too large' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch (e) { send(res, 400, { ok: false, error: 'invalid JSON' }); return; }
      const v = validate(body);
      if (typeof v === 'string') { send(res, 400, { ok: false, error: v }); return; }
      const key = 'c' + v.c;
      const board = Array.isArray(db[key]) ? db[key] : [];
      const entry = { n: v.n, s: v.s, r: v.r, t: v.t };
      board.push(entry);
      board.sort((a, b) => b.s - a.s);
      const rank = board.indexOf(entry) + 1; // position before the cap (0 if it never makes the cut)
      if (board.length > 100) board.length = 100;
      db[key] = board;
      saveDB(db);
      console.log(`rank-server: /submit course ${v.c} "${v.n}" score ${v.s} -> rank ${rank}`);
      send(res, 200, { ok: true, rank });
    });
    return;
  }

  send(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`rank-server: listening on http://127.0.0.1:${PORT} (data: ${DATA_FILE})`);
});
