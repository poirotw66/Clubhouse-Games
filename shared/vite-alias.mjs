import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path to the `@clubhouse/shared` package root. */
export const clubhouseSharedRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite `resolve.alias` entry so `@clubhouse/shared/<module>` keeps resolving
 * to source files in this package (subpath is appended by Vite).
 *
 * Prefer this helper over hard-coding `../../shared` in every game.
 */
export function clubhouseSharedAlias() {
  return {
    '@clubhouse/shared': clubhouseSharedRoot,
  };
}
