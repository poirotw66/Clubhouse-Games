/**
 * Every game that imports a component from /shared must also tell its CSS
 * toolchain to scan /shared for class names.
 *
 * Tailwind only generates the classes it can see in the files it scans, and
 * both versions in this repo historically scanned the game's own folder only:
 * v4 auto-detects from the project root, v3 uses the `content` globs in
 * tailwind.config. So a shared component's classes were generated only by
 * luck — when the game's own markup happened to use the very same class.
 *
 * The failure is silent and partial, which is what makes it worth a check.
 * Cyber-Neon-Rush shipped a game-over overlay that had `fixed` and `z-30` in
 * its markup but not in its stylesheet: the dialog rendered as a static block
 * underneath a full-screen canvas, so the 再試一次 button existed, was in the
 * DOM, was not disabled, and could not be seen or clicked.
 *
 * Supported scan wiring (prefer the shared helpers):
 *   - v3: `...clubhouseSharedTailwindContent()` from `@clubhouse/shared/tailwind-content`
 *   - v4: `@import '…/shared/tailwind-source.css'` (or package export)
 * Legacy relative `@source '…/shared'` / `../../shared/**` globs still pass,
 * but new games should use the helpers so path depth cannot silently drift.
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
// Only scan UI/source modules from the @clubhouse/shared package (skip helpers).
const tailwindDependent = readdirSync(SHARED_DIR)
  .filter((f) => /\.(tsx?|jsx?)$/.test(f))
  .filter((f) => /className="[^"]+"/.test(readFileSync(join(SHARED_DIR, f), 'utf8')))
  .map((f) => f.replace(/\.[jt]sx?$/, ''));

function scansSharedFromCss(css) {
  // Preferred: import the package scan stylesheet (path depth independent).
  if (/@import\s+['"][^'"]*tailwind-source\.css['"]/.test(css)) return true;
  if (/@import\s+['"]@clubhouse\/shared\/tailwind-source\.css['"]/.test(css)) return true;
  // Legacy: hand-written @source aiming at /shared.
  if (/@source\s+['"][^'"]*shared/.test(css)) return true;
  return false;
}

function scansSharedFromConfig(cfg) {
  // Preferred: absolute globs from the shared helper.
  if (/clubhouseSharedTailwindContent\s*\(/.test(cfg)) return true;
  // Legacy: relative content glob aiming at /shared.
  if (/shared\/\*\*/.test(cfg)) return true;
  return false;
}

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
      // Matches both `@clubhouse/shared/ResultOverlay` and legacy `…/shared/ResultOverlay`.
      if (new RegExp(`['"][^'"]*/shared/${name}['"]`).test(src)) imported.add(name);
    }
  }
  if (imported.size === 0) continue;

  // v4: stylesheet that imports tailwind (and should pull in the shared scan).
  const cssEntry = files.find(
    (f) => f.endsWith('.css') && /@import\s+['"]tailwindcss['"]/.test(readFileSync(f, 'utf8')),
  );
  // v3: a `content` glob in tailwind.config.*
  const config = files.find((f) => /tailwind\.config\.(js|cjs|mjs|ts)$/.test(f));

  let ok = false;
  if (cssEntry && scansSharedFromCss(readFileSync(cssEntry, 'utf8'))) ok = true;
  if (config && scansSharedFromConfig(readFileSync(config, 'utf8'))) ok = true;

  checked.push(game);
  if (!ok) {
    const where = cssEntry
      ? `add \`@import '<relative>/shared/tailwind-source.css';\` to ${relative(ROOT, cssEntry)}`
      : config
        ? `spread \`...clubhouseSharedTailwindContent()\` into content in ${relative(ROOT, config)}`
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
