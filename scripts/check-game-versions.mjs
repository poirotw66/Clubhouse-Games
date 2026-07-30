#!/usr/bin/env node
/**
 * Fail CI when game package.json drifts from the repo baseline clusters.
 * Usage: node scripts/check-game-versions.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = path.join(root, 'Games');

const VITE6_BASELINE = {
  react: '^19.0.0',
  'react-dom': '^19.0.0',
  vite: '^6.2.0',
  '@vitejs/plugin-react': '^5.0.4',
};

const REACT_KEYS = ['react', 'react-dom', '@vitejs/plugin-react'];

/** Games that intentionally pin a different React/Vite range. */
const EXCEPTIONS = {
  'Instant-Flash': { react: '^19.2.3', 'react-dom': '^19.2.3' },
  'Block-the-smash': { react: '^19.2.0', 'react-dom': '^19.2.0' },
  // Still on React 18 until a separate Capacitor/compat pass.
  'Mystery-Liquid-Sort': { react: '^18.3.1', 'react-dom': '^18.3.1' },
};

function readPkg(name) {
  return JSON.parse(fs.readFileSync(path.join(gamesDir, name, 'package.json'), 'utf8'));
}

function checkGame(name) {
  const pkg = readPkg(name);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  // Dependency-free static games (no React, no bundler) have nothing to pin.
  if (!deps.react && !deps.vite) return [];
  const expected = { ...VITE6_BASELINE, ...(EXCEPTIONS[name] ?? {}) };

  // Vanilla games bundle with Vite but ship no React, so only their vite pin
  // applies. Keying off "declares none of the trio" rather than "no react"
  // still catches a React game that drops one of the three.
  if (!REACT_KEYS.some((key) => deps[key])) {
    for (const key of REACT_KEYS) delete expected[key];
  }

  const mismatches = [];
  for (const [key, value] of Object.entries(expected)) {
    if (deps[key] !== value) {
      mismatches.push(`${key}: expected ${value}, got ${deps[key] ?? '(missing)'}`);
    }
  }

  return mismatches;
}

const failures = [];
for (const name of fs.readdirSync(gamesDir)) {
  if (!fs.existsSync(path.join(gamesDir, name, 'package.json'))) continue;
  const mismatches = checkGame(name);
  if (mismatches.length > 0) failures.push({ name, mismatches });
}

if (failures.length > 0) {
  console.error('Game dependency version drift detected:\n');
  for (const { name, mismatches } of failures) {
    console.error(`  ${name}:`);
    for (const line of mismatches) console.error(`    - ${line}`);
  }
  process.exit(1);
}

console.log('All game dependency versions match baseline clusters.');
