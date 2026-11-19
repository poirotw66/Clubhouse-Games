import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../leaderboard.js', import.meta.url), 'utf8');
const config = { url: 'https://scores.supabase.co', key: 'test-key', table: 'scores' };
function load(fetchImpl) {
  const context = { fetch: fetchImpl, AbortController };
  vm.runInNewContext(source, context);
  return context.WallFlipLeaderboard.createClient({ getConfig: () => config, fetchImpl });
}

test('a newer leaderboard request aborts and invalidates the previous request', async () => {
  const signals = [];
  const client = load((url, options) => {
    signals.push(options.signal);
    if (signals.length === 1) return new Promise((_, reject) => options.signal.addEventListener('abort', () => {
      const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
    }));
    return Promise.resolve({ ok: true, json: async () => [{ name: 'NEW', score: 150, rolls: 2, time_sec: 8 }] });
  });
  const oldRequest = client.load(config.url);
  const newRequest = client.load(config.url);
  assert.equal(signals[0].aborted, true);
  assert.equal(await oldRequest, null);
  assert.equal(JSON.stringify((await newRequest).board), JSON.stringify([{ n: 'NEW', s: 150, r: 2, t: 8 }]));
});

test('cancelling a closed leaderboard suppresses late results', async () => {
  let resolve;
  const client = load(() => new Promise(r => { resolve = r; }));
  const request = client.load(config.url);
  client.cancel();
  resolve({ ok: true, json: async () => [{ name: 'OLD', score: 500 }] });
  assert.equal(await request, null);
});

test('submission preserves the existing Supabase and generic API contracts', async () => {
  const requests = [];
  const client = load(async (url, options = {}) => {
    requests.push({ url, options });
    return {
      ok: true,
      headers: { get: () => '0-0/4' },
      json: async () => {
        if (url.includes('/submit')) return { ok: true, rank: 3 };
        if (url.includes('/top')) return [{ n: 'ACE', s: 200, r: 1, t: 5 }];
        return [];
      },
    };
  });
  const payload = { n: 'PILOT', s: 150, r: 2, c: 0, t: 8, log: [[1, 2]] };
  assert.equal((await client.submit(config.url, payload)).rank, 5);
  assert.match(requests[0].url, /rest\/v1\/scores$/);
  assert.equal(JSON.parse(requests[0].options.body).name, 'PILOT');
  assert.equal((await client.submit('https://rank.example', payload)).rank, 3);
  assert.equal(requests[2].url, 'https://rank.example/submit');

  await client.load(config.url, 1);
  assert.match(requests[3].url, /course=eq\.1/);
  await client.load('https://rank.example', 2);
  assert.match(requests[4].url, /\/top\?c=2$/);
});
