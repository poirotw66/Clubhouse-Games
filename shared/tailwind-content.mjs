import path from 'node:path';
import { clubhouseSharedRoot } from './vite-alias.mjs';

/**
 * Absolute Tailwind v3 `content` globs for scanning `@clubhouse/shared`.
 *
 * Prefer this over hard-coding `../../shared/**` — game CSS/config depth
 * differs (e.g. Instant-Flash vs `src/index.css` layouts), and relative
 * globs silently miss classes when copied wrong.
 *
 * @returns {string[]}
 */
export function clubhouseSharedTailwindContent() {
  return [path.join(clubhouseSharedRoot, '**/*.{js,ts,jsx,tsx}')];
}

/**
 * Absolute path to the v4 scan stylesheet (`@source` lives there so games
 * import one stable entry instead of counting `../` segments).
 */
export const clubhouseSharedTailwindSourceCss = path.join(
  clubhouseSharedRoot,
  'tailwind-source.css',
);
