import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

// The game lives in HTML: checking only external JS leaves its actual code unchecked.
let checked = 0;
for (const file of ['index.html', 'index-3d.html']) {
  const html = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  for (const [, attributes, source] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(attributes) || !source.trim()) continue;
    const module = /\btype\s*=\s*["']module["']/.test(attributes);
    const result = spawnSync(process.execPath, ['--check', '--input-type', module ? 'module' : 'commonjs'], {
      input: source, encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${file} inline script ${checked + 1}: ${result.stderr || result.error || 'syntax check failed'}`);
    checked++;
  }
}
assert.ok(checked >= 3, 'Expected game scripts in both HTML entry points');
const external = spawnSync(process.execPath, ['../../scripts/lint-js-syntax.mjs'], { stdio: 'inherit' });
assert.equal(external.status, 0, 'External script syntax check failed');
console.log(`Inline syntax OK: ${checked} scripts`);
