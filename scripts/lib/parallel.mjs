/**
 * Bounded-concurrency helpers for local and CI scripts.
 */

import os from 'node:os';

/**
 * @template T, R
 * @param {T[]} items
 * @param {number} jobs
 * @param {(item: T, index: number) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
export async function mapPool(items, jobs, worker) {
  if (items.length === 0) return [];
  const concurrency = Math.max(1, Math.min(jobs, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function run() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => run()));
  return results;
}

/**
 * Job count from env (default CHECK_JOBS), else CPU parallelism.
 * @param {string} [envName]
 * @returns {number}
 */
export function resolveJobCount(envName = 'CHECK_JOBS') {
  const raw = process.env[envName];
  if (raw !== undefined && raw !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed >= 1) return parsed;
  }
  if (typeof os.availableParallelism === 'function') {
    return os.availableParallelism();
  }
  return Math.max(1, os.cpus()?.length || 1);
}
