#!/usr/bin/env node
/**
 * Align game package.json versions to repo baseline clusters.
 * Usage: node scripts/sync-game-versions.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = path.join(root, 'Games');

const VITE5_GAMES = new Set([
  'Checkers',
  'Connect-Four',
  'Dominoes',
  'Guess-the-Color',
  'Pachinko',
  'Reversi',
  'Slot-Cars',
  'Takoyaki',
  'Tank-Battle',
  'Tetris',
  'Toy-Football',
  'Toy-Tennis',
  'Yahtzee',
]);

const VITE5_PATCH = {
  dependencies: {
    react: '^18.3.1',
    'react-dom': '^18.3.1',
  },
  devDependencies: {
    '@types/react': '^18.3.12',
    '@types/react-dom': '^18.3.1',
    '@vitejs/plugin-react': '^4.3.4',
    typescript: '~5.6.3',
    vite: '^5.4.21',
  },
};

const VITE6_PATCH = {
  dependencies: {
    react: '^19.0.0',
    'react-dom': '^19.0.0',
  },
  devDependencies: {
    '@vitejs/plugin-react': '^5.0.4',
    typescript: '~5.8.2',
    vite: '^6.2.0',
  },
};

const EXCEPTIONS = {
  'Instant-Flash': {
    dependencies: { react: '^19.2.3', 'react-dom': '^19.2.3' },
  },
  'Block-the-smash': {
    dependencies: { react: '^19.2.0', 'react-dom': '^19.2.0' },
  },
  'Mystery-Liquid-Sort': {
    dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
  },
};

function applyPatch(pkg, patch) {
  pkg.dependencies ??= {};
  pkg.devDependencies ??= {};
  Object.assign(pkg.dependencies, patch.dependencies);
  Object.assign(pkg.devDependencies, patch.devDependencies);
}

for (const name of fs.readdirSync(gamesDir)) {
  const filePath = path.join(gamesDir, name, 'package.json');
  if (!fs.existsSync(filePath)) continue;

  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  applyPatch(pkg, VITE5_GAMES.has(name) ? VITE5_PATCH : VITE6_PATCH);
  if (EXCEPTIONS[name]) {
    applyPatch(pkg, EXCEPTIONS[name]);
  }

  fs.writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('synced', name);
}
