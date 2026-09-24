#!/usr/bin/env node
/**
 * Syntax-check every .js / .mjs file under a game directory (default: cwd).
 * Used by JS-only games that cannot run `tsc --noEmit` like the React majority.
 *
 * Usage: node scripts/lint-js-syntax.mjs [relative-or-absolute-dir]
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
const SKIP = new Set(['node_modules', 'dist', '.git', 'android']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.m?js$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(root).sort();
if (files.length === 0) {
  console.error(`No .js/.mjs files under ${root}`);
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}

if (failed > 0) {
  console.error(`\nSyntax check failed in ${failed} file(s) under ${root}`);
  process.exit(1);
}

console.log(`Syntax OK: ${files.length} file(s) under ${root}`);
