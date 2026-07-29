#!/usr/bin/env node
/**
 * Run an npm script in every game that defines it, and fail if any of them do.
 * Games without the script are skipped, not treated as failures — not every
 * game has a typecheck or a logic check.
 *
 * Usage: node scripts/run-in-games.mjs <script-name>
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const scriptName = process.argv[2];
if (!scriptName) {
  console.error('Usage: node scripts/run-in-games.mjs <script-name>');
  process.exit(1);
}

const gamesDir = path.join(root, 'Games');
if (!fs.existsSync(gamesDir)) {
  console.log('No Games/ directory.');
  process.exit(0);
}

const games = fs.readdirSync(gamesDir).filter((name) => {
  const pkgPath = path.join(gamesDir, name, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return Boolean(pkg.scripts?.[scriptName]);
  } catch {
    return false;
  }
});

if (games.length === 0) {
  console.log(`No game defines an npm "${scriptName}" script.`);
  process.exit(0);
}

console.log(`Running "${scriptName}" in ${games.length} game(s): ${games.join(', ')}\n`);

const failed = [];
for (const name of games) {
  console.log(`=== ${name}: npm run ${scriptName} ===`);
  const result = spawnSync('npm', ['run', scriptName], {
    cwd: path.join(gamesDir, name),
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) failed.push(name);
}

if (failed.length > 0) {
  console.error(`\n"${scriptName}" failed in: ${failed.join(', ')}`);
  process.exit(1);
}

console.log(`\nDone. "${scriptName}" passed in ${games.length} game(s).`);
