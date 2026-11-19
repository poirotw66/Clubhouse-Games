/* Network boundary for Wall Flip rankings. UI state and storage stay with the game. */
globalThis.WallFlipLeaderboard = Object.freeze({
  createClient({ getConfig, fetchImpl = globalThis.fetch.bind(globalThis) }) {
    let controller = null;
    let requestId = 0;

    function isSupabase(base, config) {
      return !!config && (base.startsWith(config.url.replace(/\/+$/, '')) || base.includes('.supabase.co'));
    }
    async function response(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }
    function headers(config) {
      return { apikey: config.key, Authorization: 'Bearer ' + config.key };
    }
    function normalize(payload, base, config) {
      const supabase = isSupabase(base, config);
      const list = supabase ? payload : Array.isArray(payload) ? payload : payload?.board;
      if (!Array.isArray(list)) throw new Error('unexpected payload');
      return list.slice(0, 10).flatMap(entry => {
        const item = supabase
          ? { n: entry?.name, s: entry?.score, r: Number(entry?.rolls) || 0, t: Number(entry?.time_sec) || 0 }
          : { n: entry?.n, s: entry?.s, r: entry?.r, t: Number.isFinite(entry?.t) ? entry.t : 0 };
        if (typeof item.n !== 'string' || !Number.isFinite(item.s) || !Number.isFinite(item.r)) return [];
        return [item];
      });
    }
    return {
      async load(base, course = 0) {
        controller?.abort();
        controller = new AbortController();
        const id = ++requestId;
        const config = getConfig();
        const supabase = isSupabase(base, config);
        try {
          const url = supabase
            ? base + '/rest/v1/' + (config.table || 'wallflip_scores') + '?select=name,score,rolls,time_sec,created_at&course=eq.' + course + '&order=score.desc,time_sec.asc&limit=10'
            : base + '/top?c=' + course;
          const result = normalize(await response(await fetchImpl(url, {
            signal: controller.signal,
            ...(supabase ? { headers: headers(config) } : {}),
          })), base, config);
          if (id !== requestId) return null;
          return { board: result };
        } catch (error) {
          if (id !== requestId || error.name === 'AbortError') return null;
          throw error;
        }
      },
      cancel() {
        requestId++;
        controller?.abort();
        controller = null;
      },
      async submit(base, payload) {
        const config = getConfig();
        const supabase = isSupabase(base, config);
        if (!supabase) {
          const result = await response(await fetchImpl(base + '/submit', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          }));
          if (!result || result.ok !== true || !Number.isFinite(result.rank)) throw new Error('unexpected response');
          return { rank: result.rank };
        }
        const table = config.table || 'wallflip_scores';
        await response(await fetchImpl(base + '/rest/v1/' + table, {
          method: 'POST',
          headers: { ...headers(config), 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ name: payload.n, score: payload.s, rolls: payload.r, course: payload.c, time_sec: payload.t }),
        }));
        let rank = 1;
        try {
          const result = await fetchImpl(base + '/rest/v1/' + table + '?course=eq.' + payload.c + '&or=(score.gt.' + payload.s + ',and(score.eq.' + payload.s + ',time_sec.lt.' + payload.t + '))&select=id', {
            headers: { ...headers(config), Prefer: 'count=exact', Range: '0-0' },
          });
          const match = /\/(\d+)$/.exec(result.headers.get('content-range') || '');
          if (result.ok && match) rank = Number(match[1]) + 1;
        } catch (_) {}
        return { rank };
      },
    };
  },
});
