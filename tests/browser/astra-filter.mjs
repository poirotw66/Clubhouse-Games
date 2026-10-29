/** Unset runs every demo locally; CI supplies a JSON array of affected IDs. */
export function includesAstra(id, raw = process.env.CI_ASTRA_FILTER) {
  if (raw === undefined || raw === '') return true;
  const ids = JSON.parse(raw);
  if (!Array.isArray(ids) || ids.some((value) => typeof value !== 'string')) {
    throw new Error('CI_ASTRA_FILTER must be a JSON array of directory names.');
  }
  return ids.includes(id);
}
