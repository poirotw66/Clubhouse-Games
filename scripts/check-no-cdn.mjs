#!/usr/bin/env node
/**
 * Fail if a built game would fetch code from a third-party CDN at runtime.
 *
 * This exists because of a real regression: the badminton drill pulled Three.js
 * from unpkg through an importmap, so it needed the network to start and
 * rendered a black screen without it. `npm run build` was perfectly happy —
 * bundling succeeded, the CDN reference just sat there in the output — so
 * nothing in CI noticed. This checks the artefacts instead of the sources.
 *
 * Stylesheets and fonts are allowed: they degrade to a fallback rather than
 * leaving the game unplayable. Executable code does not degrade.
 *
 * Usage: node scripts/check-no-cdn.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** Hosts that serve executable JavaScript. */
const CODE_CDN = /https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|esm\.sh|skypack\.dev|jspm\.dev|ga\.jspm\.io)\/[^\s"'`)]*/g;

/** Only these get scanned: what the browser actually loads and runs. */
const SCANNED = new Set(['.html', '.js', '.mjs']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SCANNED.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const gamesDir = path.join(root, 'Games');
if (!fs.existsSync(gamesDir)) {
  console.log('No Games/ directory.');
  process.exit(0);
}

const offenders = [];
let scannedGames = 0;

for (const name of fs.readdirSync(gamesDir)) {
  const dist = path.join(gamesDir, name, 'dist');
  if (!fs.existsSync(dist)) continue;
  scannedGames += 1;

  for (const file of walk(dist)) {
    const text = fs.readFileSync(file, 'utf8');
    const hits = [...new Set(text.match(CODE_CDN) ?? [])];
    if (hits.length > 0) {
      offenders.push({
        game: name,
        file: path.relative(root, file),
        hits: hits.slice(0, 3),
      });
    }
  }
}

if (scannedGames === 0) {
  console.log('No built games found — run a build first. Nothing to check.');
  process.exit(0);
}

if (offenders.length > 0) {
  console.error('Built games reference code on a third-party CDN:\n');
  for (const { game, file, hits } of offenders) {
    console.error(`  ${game}  ${file}`);
    for (const hit of hits) console.error(`      ${hit}`);
  }
  console.error(
    '\nBundle the dependency instead: add it to the game\'s package.json so the\n' +
      'build resolves it locally. A CDN import makes the game need the network to\n' +
      'start, and it fails silently when that network is not there.',
  );
  process.exit(1);
}

console.log(`No runtime CDN code references in ${scannedGames} built game(s).`);
