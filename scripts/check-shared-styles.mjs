/**
 * Every game that imports a component from /shared must also tell its CSS
 * toolchain to scan /shared for class names.
 *
 * Tailwind only generates the classes it can see in the files it scans, and
 * both versions in this repo scan the game's own folder only: v4 auto-detects
 * from the project root, v3 uses the `content` globs in tailwind.config. So a
 * shared component's classes were generated only by luck — when the game's own
 * markup happened to use the very same class.
 *
 * The failure is silent and partial, which is what makes it worth a check.
 * Cyber-Neon-Rush shipped a game-over overlay that had `fixed` and `z-30` in
 * its markup but not in its stylesheet: the dialog rendered as a static block
 * underneath a full-screen canvas, so the 再試一次 button existed, was in the
 * DOM, was not disabled, and could not be seen or clicked.
 *
 * Run: node scripts/check-shared-styles.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const GAMES_DIR = join(ROOT, 'Games');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * Which shared modules actually depend on Tailwind generating their classes.
 * Derived rather than hardcoded, so a shared component that starts using
 * utility classes later is caught without anyone remembering to update a list.
 * BackToMenu and TouchButton ship their own CSS (a <style> block / inline style
 * objects) and are therefore safe to import with no scanning config at all.
 */
const SHARED_DIR = join(ROOT, 'shared');
const tailwindDependent = readdirSync(SHARED_DIR)
  .filter((f) => /\.(tsx?|jsx?)$/.test(f))
  .filter((f) => /className="[^"]+"/.test(readFileSync(join(SHARED_DIR, f), 'utf8')))
  .map((f) => f.replace(/\.[jt]sx?$/, ''));

const failures = [];
const checked = [];

for (const game of readdirSync(GAMES_DIR)) {
  const gameDir = join(GAMES_DIR, game);
  if (!statSync(gameDir).isDirectory()) continue;

  const files = walk(gameDir);
  const imported = new Set();
  for (const f of files) {
    if (!/\.(tsx?|jsx?)$/.test(f)) continue;
    const src = readFileSync(f, 'utf8');
    for (const name of tailwindDependent) {
      if (new RegExp(`['"][^'"]*/shared/${name}['"]`).test(src)) imported.add(name);
    }
  }
  if (imported.size === 0) continue;

  // v4: `@source` in the stylesheet that imports tailwind.
  const cssEntry = files.find(
    (f) => f.endsWith('.css') && /@import\s+['"]tailwindcss['"]/.test(readFileSync(f, 'utf8')),
  );
  // v3: a `content` glob in tailwind.config.*
  const config = files.find((f) => /tailwind\.config\.(js|cjs|mjs|ts)$/.test(f));

  let ok = false;
  if (cssEntry && /@source\s+['"][^'"]*shared/.test(readFileSync(cssEntry, 'utf8'))) ok = true;
  if (config && /shared\/\*\*/.test(readFileSync(config, 'utf8'))) ok = true;

  checked.push(game);
  if (!ok) {
    const where = cssEntry
      ? `add \`@source '<relative path>/shared';\` to ${relative(ROOT, cssEntry)}`
      : config
        ? `add '../../shared/**/*.{js,ts,jsx,tsx}' to content in ${relative(ROOT, config)}`
        : 'no tailwind entry point found — check how this game builds its CSS';
    failures.push(
      `${game}: imports ${[...imported].join(', ')} from /shared but never scans it — ${where}`,
    );
  }
}

if (failures.length > 0) {
  console.error('check-shared-styles: FAILED\n');
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    `\n${failures.length} of ${checked.length} games would render shared components with missing styles.`,
  );
  process.exit(1);
}

console.log(
  `check-shared-styles: ok (${checked.length} games import ` +
    `${tailwindDependent.join('/')} from /shared, all scan it)`,
);
