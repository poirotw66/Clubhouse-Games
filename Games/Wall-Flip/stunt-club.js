/* Optional contracts and cosmetic rewards; physics and leaderboard scores stay authoritative. */
(function (global) {
  'use strict';
  const KEY = 'wallflip.stuntClub.v1';
  const contracts = Object.freeze({
    flips: { thresholds: [1, 2, 3], value: s => s.rolls || 0 },
    precision: { thresholds: [20, 35, 45], value: s => (s.soft || 0) + (s.level || 0) },
    reserve: { thresholds: [30, 50, 70], value: s => s.air || 0 },
  });
  const paints = Object.freeze([
    { id: 'mint', color: '#9cebd6', stars: 0 },
    { id: 'amber', color: '#ffbd69', stars: 3 },
    { id: 'violet', color: '#c3a4ff', stars: 6 },
  ]);
  function normalize(raw = {}) {
    if (!raw || typeof raw !== 'object') raw = {};
    const medals = {};
    for (const id of Object.keys(contracts)) medals[id] = Number.isInteger(raw.medals?.[id]) ? Math.max(0, Math.min(3, raw.medals[id])) : 0;
    const stars = Object.values(medals).reduce((sum, n) => sum + n, 0);
    const count = n => Number.isInteger(n) ? Math.max(0, Math.min(9999, n)) : 0;
    return { medals, selected: Object.hasOwn(contracts, raw.selected) ? raw.selected : 'flips',
      paint: paints.find(p => p.id === raw.paint && p.stars <= stars)?.id || 'mint',
      streak: count(raw.streak), bestStreak: Math.max(count(raw.streak), count(raw.bestStreak)) };
  }
  function grade(id, result) {
    if (!result.win) return 0;
    const c = contracts[id];
    return c.thresholds.filter(n => c.value(result) >= n).length;
  }
  function settle(profile, id, result) {
    const next = normalize(profile);
    next.medals[id] = Math.max(next.medals[id], grade(id, result));
    next.streak = result.win ? Math.min(9999, next.streak + 1) : 0;
    next.bestStreak = Math.max(next.bestStreak, next.streak);
    return next;
  }
  const words = {
    tc: { choose:'選擇這趟的挑戰', bank:'每項最多 3 星；成功落地才入袋。',
      flips:'翻滾秀', precision:'奶油著陸', reserve:'省氣高手',
      hints:{flips:'翻 1 / 2 / 3 圈並落地',precision:'柔軟＋水平達 20 / 35 / 45',reserve:'落地剩餘空氣 30 / 50 / 70%'},
      units:{flips:'圈',precision:'/ 50',reserve:'% 空氣'}, live:'本趟挑戰', pending:'落地才能入袋',
      landed:'挑戰結算', failed:'挑戰未完成 · 再來一趟', practice:'示範練習 · 不記錄獎勵',
      streak:'連續著陸', best:'最佳', paint:'車身塗裝', mint:'薄荷',amber:'夕陽',violet:'星雲',
      unlock:'星解鎖', earned:'新獎章！', retry:'更換挑戰或塗裝', unlocked:'塗裝解鎖', quality:'著陸時結算',
    },
    en: { choose:'Pick this run’s challenge',bank:'Up to 3 stars each. Land safely to bank them.',
      flips:'Air show',precision:'Butter landing',reserve:'Air saver',
      hints:{flips:'Land after 1 / 2 / 3 flips',precision:'SOFT + LEVEL: 20 / 35 / 45',reserve:'Land with 30 / 50 / 70% air'},
      units:{flips:'flips',precision:'/ 50',reserve:'% air'},live:'RUN CONTRACT',pending:'Land to bank',
      landed:'Contract result',failed:'Contract missed · Try again',practice:'Demo practice · No rewards saved',
      streak:'Landing streak',best:'best',paint:'Livery',mint:'Mint',amber:'Sunset',violet:'Nebula',
      unlock:'stars to unlock',earned:'New medal!',retry:'Change challenge or livery',unlocked:'livery unlocked',quality:'Scored at touchdown',
    },
  };
  const starsOf = profile => Object.values(profile.medals).reduce((sum, n) => sum + n, 0);
  const starsText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  function mount({ language, onPaint = () => {} }) {
    let profile;
    try { profile = normalize(JSON.parse(localStorage.getItem(KEY)) || {}); } catch (_) { profile = normalize(); }
    let run = null, outcome = null, recorded = true, selectionHost = null, liveHost = null, reviewHost = null;
    let lastSelection = '', lastLive = '', lastReview = '';
    const w = () => words[language() === 'en' ? 'en' : 'tc'];
    const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (_) {} };
    const applyPaint = () => onPaint(paints.find(p => p.id === profile.paint));
    function choices(host, review = false) {
      const t = w(), stars = starsOf(profile);
      host.innerHTML = `<div class="wf-club-heading"><span>${review ? t.retry : t.choose}</span><strong>${stars} / 9 ★</strong></div><div class="wf-contracts"></div><p class="wf-club-bank">${t.bank}</p>`;
      for (const id of Object.keys(contracts)) {
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.contract = id;
        button.setAttribute('aria-pressed', String(profile.selected === id));
        button.innerHTML = `<span class="wf-contract-mark" aria-hidden="true">${id === 'flips' ? '↻' : id === 'precision' ? '◎' : '◒'}</span><strong>${t[id]}</strong><span class="wf-contract-stars" aria-label="${profile.medals[id]} / 3">${starsText(profile.medals[id])}</span><small>${t.hints[id]}</small>`;
        button.addEventListener('click', () => { profile.selected = id; persist(); lastSelection = lastReview = ''; refresh(); (review ? reviewHost : selectionHost).querySelector('[data-contract="' + id + '"]').focus({preventScroll:true}); });
        host.querySelector('.wf-contracts').append(button);
      }
      {
        const row = document.createElement('div'); row.className = 'wf-paints';
        const label = document.createElement('span'); label.textContent = t.paint; row.append(label);
        for (const paint of paints) {
          const b = document.createElement('button'); b.type = 'button'; b.dataset.paint = paint.id;
          b.style.setProperty('--paint', paint.color); b.disabled = paint.stars > stars;
          b.setAttribute('aria-pressed', String(profile.paint === paint.id));
          b.textContent = t[paint.id] + (b.disabled ? ` · ${paint.stars} ★` : '');
          b.title = b.disabled ? `${paint.stars} ${t.unlock}` : t[paint.id];
          b.addEventListener('click', () => { profile.paint = paint.id; persist(); applyPaint(); lastSelection = ''; refresh(); (review ? reviewHost : selectionHost).querySelector('[data-paint="' + paint.id + '"]').focus({preventScroll:true}); });
          row.append(b);
        }
        host.append(row);
      }
    }
    function refresh() {
      const key = language() + JSON.stringify(profile);
      if (selectionHost && key !== lastSelection) { lastSelection = key; choices(selectionHost); }
      if (reviewHost && outcome) {
        const reviewKey = key + JSON.stringify(outcome) + recorded;
        if (reviewKey !== lastReview) {
          lastReview = reviewKey;
          const t = w(), n = grade(run.id, outcome), gained = recorded && profile.medals[run.id] > run.previous;
          const unlocked = recorded ? paints.filter(p => p.stars > run.starsBefore && p.stars <= starsOf(profile)).map(p => t[p.id] + ' ' + t.unlocked).join(' · ') : '';
          const reward = unlocked || (gained ? t.earned : t.hints[run.id]);
          const expanded = reviewHost.querySelector('details')?.open || false;
          reviewHost.innerHTML = `<div class="wf-club-outcome ${outcome.win && n ? 'banked' : ''}" role="status"><img src="assets/club-medal.webp" alt=""><div><small>${!recorded ? t.practice : !outcome.win ? t.failed : t.landed}</small><strong>${t[run.id]} <span>${starsText(n)}</span></strong><p>${reward} · ${t.streak} ${profile.streak} / ${t.best} ${profile.bestStreak}</p></div></div><details class="wf-club-next" ${expanded ? 'open' : ''}><summary>${t.retry}</summary><div class="wf-club-choices"></div></details>`;
          choices(reviewHost.querySelector('.wf-club-choices'), true);
        }
      }
    }
    function begin(record = true) {
      if (run && !outcome && run.record) { profile.streak = 0; persist(); }
      run = { id: profile.selected, previous: profile.medals[profile.selected], starsBefore: starsOf(profile), record };
      outcome = null; lastLive = lastReview = '';
    }
    function finish(result, record = true) {
      if (!run || outcome) return;
      outcome = { ...result }; recorded = record && run.record;
      if (recorded) { profile = settle(profile, run.id, result); persist(); }
      refresh();
    }
    function render(state) {
      if (!run || !liveHost) return;
      const t = w(), c = contracts[run.id];
      const n = c.value(state), tier = c.thresholds.filter(x => n >= x).length;
      const value = run.id === 'precision' ? t.quality : `${Math.floor(n)} ${t.units[run.id]}`;
      const copy = `${t.live} / ${t[run.id]} · ${value} · ${run.id === 'precision' ? t.hints.precision : starsText(tier)} · ${t.pending}`;
      if (copy !== lastLive) { liveHost.textContent = copy; lastLive = copy; }
      refresh();
    }
    applyPaint();
    return { begin, finish, render, refresh,
      attachLaunch(host) { selectionHost = document.createElement('section'); selectionHost.className = 'wf-club'; selectionHost.setAttribute('aria-label', 'Stunt club'); host.append(selectionHost); refresh(); },
      attachCoach(live, review) { liveHost = document.createElement('div'); liveHost.className = 'wf-club-live'; live.append(liveHost); reviewHost = document.createElement('div'); reviewHost.className = 'wf-club-review'; review.append(reviewHost); },
    };
  }
  global.WallFlipClub = Object.freeze({ contracts, paints, normalize, grade, settle, mount });
})(globalThis);
