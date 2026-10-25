(() => {
  const searchInput = document.getElementById('game-search');
  const searchField = searchInput?.closest('.search-field');
  const searchClear = document.getElementById('search-clear');
  const searchStatus = document.getElementById('search-status');
  const gameCountStat = document.getElementById('game-count-stat');
  const categoryCountStat = document.getElementById('category-count-stat');
  const emptyTotal = document.getElementById('empty-total');
  const categoryNav = document.getElementById('category-nav');
  const emptyState = document.getElementById('empty-state');
  const resetButton = document.getElementById('reset-filters');
  const backToTop = document.getElementById('back-to-top');
  const recentSection = document.getElementById('recent-section');
  const recentList = document.getElementById('recent-list');
  const recentClear = document.getElementById('recent-clear');

  const tiles = [...document.querySelectorAll('.game-tile')];
  const groups = [...document.querySelectorAll('.game-group')];
  const pills = categoryNav ? [...categoryNav.querySelectorAll('.filter-pill')] : [];

  const RECENT_KEY = 'clubhouse:recent-games';
  const RECENT_LIMIT = 4;
  /** Same key as shared/juice.ts — lobby FX must respect clubhouse juice settings. */
  const JUICE_STORAGE_KEY = 'clubhouse:juice';

  let currentQuery = '';
  let currentCategory = 'all';

  if (gameCountStat) gameCountStat.textContent = String(tiles.length);
  if (categoryCountStat) categoryCountStat.textContent = String(groups.length);
  if (emptyTotal) emptyTotal.textContent = String(tiles.length);

  /* ---------- juice / reduced-motion gate for lobby FX ---------- */

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  function readJuiceFx() {
    try {
      const raw = localStorage.getItem(JUICE_STORAGE_KEY);
      if (!raw) return 'full';
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.fx === 'off' || parsed.fx === 'low' || parsed.fx === 'full')) {
        return parsed.fx;
      }
    } catch {
      /* ignore */
    }
    return 'full';
  }

  function fxMultiplier() {
    if (prefersReducedMotion()) return 0;
    const fx = readJuiceFx();
    if (fx === 'off') return 0;
    if (fx === 'low') return 0.35;
    return 1;
  }

  function syncJuiceAttr() {
    const fx = prefersReducedMotion() ? 'off' : readJuiceFx();
    document.documentElement.setAttribute('data-juice-fx', fx);
    return fx;
  }

  syncJuiceAttr();

  /* ---------- filtering ---------- */

  function apply() {
    const needle = currentQuery.trim().toLowerCase();
    let visible = 0;

    groups.forEach((group) => {
      const inCategory = currentCategory === 'all' || group.dataset.category === currentCategory;
      let groupHasMatch = false;

      group.querySelectorAll('.game-tile').forEach((tile) => {
        const haystack = (tile.dataset.search || '').toLowerCase();
        const show = inCategory && (!needle || haystack.includes(needle));
        tile.hidden = !show;
        if (show) {
          groupHasMatch = true;
          visible += 1;
        }
      });

      group.hidden = !groupHasMatch;
    });

    if (emptyState) emptyState.hidden = visible > 0;

    if (searchStatus) {
      if (!needle && currentCategory === 'all') {
        searchStatus.textContent = '';
      } else if (visible === 0) {
        searchStatus.textContent = '找不到符合的遊戲。';
      } else {
        searchStatus.textContent = `顯示 ${visible} / ${tiles.length} 款遊戲`;
      }
    }

    if (searchClear) searchClear.hidden = !needle;
    searchField?.classList.toggle('has-value', !!needle);

    pills.forEach((pill) => {
      const active = pill.dataset.filter === currentCategory;
      pill.classList.toggle('is-active', active);
      pill.setAttribute('aria-pressed', String(active));
    });
  }

  /** Keep search/category in the URL so a filtered view can be shared and restored. */
  function syncUrl() {
    const params = new URLSearchParams();
    if (currentQuery.trim()) params.set('q', currentQuery.trim());
    if (currentCategory !== 'all') params.set('cat', currentCategory);
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : location.pathname);
  }

  function setQuery(value, { sync = true } = {}) {
    currentQuery = value;
    apply();
    if (sync) syncUrl();
  }

  function setCategory(value, { sync = true } = {}) {
    currentCategory = pills.some((pill) => pill.dataset.filter === value) ? value : 'all';
    apply();
    if (sync) syncUrl();
  }

  /* ---------- search box ---------- */

  searchInput?.addEventListener('input', (event) => {
    setQuery(event.target.value);
  });

  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && searchInput.value) {
      event.preventDefault();
      searchInput.value = '';
      setQuery('');
    }
  });

  searchClear?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    searchInput.focus();
    setQuery('');
  });

  categoryNav?.addEventListener('click', (event) => {
    const pill = event.target.closest('.filter-pill');
    if (!pill) return;
    // Tapping the active category again clears it.
    setCategory(pill.dataset.filter === currentCategory ? 'all' : pill.dataset.filter);
  });

  function resetFilters() {
    if (searchInput) searchInput.value = '';
    currentQuery = '';
    currentCategory = 'all';
    apply();
    syncUrl();
  }

  let lastResetAt = 0;
  function requestResetFilters() {
    const now = Date.now();
    if (now - lastResetAt < 400) return;
    lastResetAt = now;
    resetFilters();
    // preventScroll avoids a sticky-toolbar jump eating the gesture on mobile.
    searchInput?.focus({ preventScroll: true });
  }

  resetButton?.addEventListener('click', (event) => {
    event.preventDefault();
    requestResetFilters();
  });

  // Touch / stylus: act on pointerup so a layout shift between down/up cannot
  // drop the synthesized click while the control still looks "active".
  resetButton?.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    if (!currentQuery && currentCategory === 'all') return;
    requestResetFilters();
  });

  /* ---------- keyboard shortcuts ---------- */

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    const isFindShortcut = (event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey);
    if (isFindShortcut || (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey)) {
      event.preventDefault();
      searchInput?.focus();
      searchInput?.select();
    }
  });

  /* ---------- recently played ---------- */

  /** Only ever trust stored links that point at a game folder. */
  function isGameHref(href) {
    return typeof href === 'string' && /^(Games|gpt6-astra)\/[\w.-]+\/$/.test(href);
  }

  function readRecent() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && typeof item.name === 'string' && isGameHref(item.href));
    } catch {
      return [];
    }
  }

  function writeRecent(entries) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(entries));
    } catch {
      /* storage unavailable (private mode / disabled) — recents are optional */
    }
  }

  function renderRecent() {
    if (!recentSection || !recentList) return;
    const entries = readRecent();
    recentList.textContent = '';

    entries.slice(0, RECENT_LIMIT).forEach((entry) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'recent-chip font-tc';
      link.href = entry.href;
      link.textContent = entry.name;
      li.append(link);
      recentList.append(li);
    });

    recentSection.hidden = entries.length === 0;
  }

  function rememberGame(name, href) {
    if (!name || !isGameHref(href)) return;
    const entries = readRecent().filter((entry) => entry.href !== href);
    entries.unshift({ name, href });
    writeRecent(entries.slice(0, RECENT_LIMIT));
  }

  document.addEventListener('click', (event) => {
    const play = event.target.closest('a.tile-play');
    if (!play) return;
    const tile = play.closest('.game-tile');
    rememberGame(tile?.dataset.name || play.dataset.game, play.getAttribute('href'));
  });

  recentClear?.addEventListener('click', () => {
    writeRecent([]);
    renderRecent();
  });

  renderRecent();

  /* ---------- back to top ---------- */

  if (backToTop) {
    const toggleBackToTop = () => {
      backToTop.hidden = window.scrollY < 600;
    };
    window.addEventListener('scroll', toggleBackToTop, { passive: true });
    toggleBackToTop();
    backToTop.addEventListener('click', () => {
      const reduceMotion = prefersReducedMotion();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      // Move focus to the top of the page without opening a mobile keyboard.
      document.querySelector('.brand')?.focus();
    });
  }

  /* ---------- mist-neon ambient FX (transform/opacity only) ---------- */

  const dreamBg = document.getElementById('dream-bg');
  const lobbyCanvas = document.getElementById('lobby-fx');
  const cursorGlow = document.getElementById('cursor-glow');
  const rootStyle = document.documentElement.style;
  const parallaxOrbs = dreamBg ? [...dreamBg.querySelectorAll('[data-parallax]')] : [];
  const floatProps = [...document.querySelectorAll('[data-float]')];

  let pageVisible = document.visibilityState !== 'hidden';
  let rafId = 0;
  let pointerX = 0.5;
  let pointerY = 0.35;
  let dust = [];
  let sparks = [];
  let lastDustAt = 0;
  let activeTiltTile = null;

  function dustBudget() {
    const mult = fxMultiplier();
    if (mult <= 0) return 0;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.innerWidth < 768;
    const base = coarse || narrow ? 28 : 56;
    return Math.max(0, Math.round(base * mult));
  }

  function resizeLobbyCanvas() {
    if (!lobbyCanvas) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    lobbyCanvas.width = Math.max(1, Math.floor(w * dpr));
    lobbyCanvas.height = Math.max(1, Math.floor(h * dpr));
    lobbyCanvas.style.width = `${w}px`;
    lobbyCanvas.style.height = `${h}px`;
    const ctx = lobbyCanvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedDust() {
    const budget = dustBudget();
    dust = [];
    sparks = [];
    if (budget <= 0 || !lobbyCanvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const colors = ['#67e8f9', '#2dd4bf', '#a5f3fc', '#f472b6', '#fb7185', '#fbbf24'];
    for (let i = 0; i < budget; i += 1) {
      dust.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.7 + Math.random() * 2.2,
        vx: (Math.random() - 0.5) * 0.22,
        vy: -0.1 - Math.random() * 0.28,
        a: 0.2 + Math.random() * 0.5,
        color: colors[i % colors.length],
      });
    }
    const sparkCount = Math.round(budget * 0.35);
    for (let i = 0; i < sparkCount; i += 1) {
      sparks.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.7,
        len: 8 + Math.random() * 18,
        speed: 0.4 + Math.random() * 1.1,
        a: 0.15 + Math.random() * 0.35,
        color: colors[i % colors.length],
      });
    }
  }

  function paintDust(now) {
    if (!lobbyCanvas || fxMultiplier() <= 0) return;
    const ctx = lobbyCanvas.getContext('2d');
    if (!ctx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // Soft aurora ribbons (cheap path strokes).
    const ribbonCount = fxMultiplier() >= 1 ? 3 : 1;
    for (let i = 0; i < ribbonCount; i += 1) {
      const y0 = h * (0.18 + i * 0.16);
      ctx.beginPath();
      ctx.moveTo(-20, y0);
      for (let x = 0; x <= w + 40; x += 28) {
        const y =
          y0 +
          Math.sin(x * 0.008 + now * 0.0008 + i) * (18 + i * 8) +
          Math.sin(x * 0.02 + now * 0.0012) * 8;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(45,212,191,0.12)' : 'rgba(244,114,182,0.1)';
      ctx.lineWidth = 2 + i;
      ctx.stroke();
    }

    for (const p of dust) {
      p.x += p.vx + (pointerX - 0.5) * 0.18;
      p.y += p.vy + (pointerY - 0.5) * 0.05;
      if (p.y < -8) {
        p.y = h + 4;
        p.x = Math.random() * w;
      }
      if (p.x < -8) p.x = w + 4;
      if (p.x > w + 8) p.x = -4;
      const pulse = 0.65 + 0.35 * Math.sin((now + p.x * 12) * 0.0015);
      ctx.globalAlpha = p.a * pulse;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const s of sparks) {
      s.x += s.speed + (pointerX - 0.5) * 0.3;
      if (s.x > w + 20) s.x = -10;
      ctx.globalAlpha = s.a;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.len, s.y + s.len * 0.15);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function applyParallax() {
    const mult = fxMultiplier();
    if (mult <= 0) {
      parallaxOrbs.forEach((orb) => {
        orb.style.transform = '';
      });
      floatProps.forEach((prop) => {
        prop.style.translate = '';
      });
      return;
    }
    const dx = (pointerX - 0.5) * 2;
    const dy = (pointerY - 0.5) * 2;
    parallaxOrbs.forEach((orb) => {
      const depth = Number(orb.dataset.parallax) || 0.04;
      const x = dx * depth * 56 * mult;
      const y = dy * depth * 40 * mult;
      orb.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    });
    floatProps.forEach((prop) => {
      const depth = Number(prop.dataset.float) || 0.05;
      const x = dx * depth * 70 * mult;
      const y = dy * depth * 50 * mult;
      prop.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    });
  }

  function syncCursorCss() {
    rootStyle.setProperty('--cursor-x', `${(pointerX * 100).toFixed(2)}%`);
    rootStyle.setProperty('--cursor-y', `${(pointerY * 100).toFixed(2)}%`);
  }

  function tick(now) {
    rafId = 0;
    if (!pageVisible || fxMultiplier() <= 0) {
      if (lobbyCanvas) {
        const ctx = lobbyCanvas.getContext('2d');
        ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
      return;
    }
    if (now - lastDustAt > 28) {
      paintDust(now);
      lastDustAt = now;
    }
    applyParallax();
    syncCursorCss();
    rafId = requestAnimationFrame(tick);
  }

  function startFxLoop() {
    if (rafId || fxMultiplier() <= 0 || !pageVisible) return;
    rafId = requestAnimationFrame(tick);
  }

  function stopFxLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function bootLobbyFx() {
    syncJuiceAttr();
    resizeLobbyCanvas();
    seedDust();
    stopFxLoop();
    if (fxMultiplier() > 0) startFxLoop();
  }

  function clearTilt(tile) {
    if (!tile) return;
    tile.style.setProperty('--tilt-x', '0deg');
    tile.style.setProperty('--tilt-y', '0deg');
    tile.classList.remove('is-tilting');
  }

  function spawnRipple(tile, clientX, clientY) {
    if (fxMultiplier() <= 0) return;
    const rect = tile.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.1;
    const ripple = document.createElement('span');
    ripple.className = 'tile-ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${clientX - rect.left - size / 2}px`;
    ripple.style.top = `${clientY - rect.top - size / 2}px`;
    tile.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 650);
  }

  tiles.forEach((tile) => {
    tile.addEventListener(
      'pointermove',
      (event) => {
        if (fxMultiplier() <= 0) return;
        if (window.matchMedia('(pointer: coarse)').matches) return;
        const rect = tile.getBoundingClientRect();
        const px = (event.clientX - rect.left) / Math.max(1, rect.width);
        const py = (event.clientY - rect.top) / Math.max(1, rect.height);
        const rotY = (px - 0.5) * 14 * fxMultiplier();
        const rotX = (0.5 - py) * 10 * fxMultiplier();
        tile.style.setProperty('--tilt-x', `${rotX.toFixed(2)}deg`);
        tile.style.setProperty('--tilt-y', `${rotY.toFixed(2)}deg`);
        tile.classList.add('is-tilting');
        activeTiltTile = tile;
      },
      { passive: true },
    );
    tile.addEventListener('pointerleave', () => clearTilt(tile));
    tile.addEventListener(
      'pointerdown',
      (event) => {
        spawnRipple(tile, event.clientX, event.clientY);
        if (window.matchMedia('(pointer: coarse)').matches && fxMultiplier() > 0) {
          tile.classList.add('is-tilting');
          tile.style.setProperty('--tilt-x', '4deg');
          tile.style.setProperty('--tilt-y', '-3deg');
          window.setTimeout(() => clearTilt(tile), 220);
        }
      },
      { passive: true },
    );
  });

  window.addEventListener(
    'pointermove',
    (event) => {
      if (fxMultiplier() <= 0) return;
      pointerX = event.clientX / Math.max(1, window.innerWidth);
      pointerY = event.clientY / Math.max(1, window.innerHeight);
    },
    { passive: true },
  );

  window.addEventListener(
    'resize',
    () => {
      resizeLobbyCanvas();
      seedDust();
    },
    { passive: true },
  );

  document.addEventListener('visibilitychange', () => {
    pageVisible = document.visibilityState !== 'hidden';
    if (pageVisible) startFxLoop();
    else stopFxLoop();
  });

  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => bootLobbyFx();
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onMotionChange);
    else if (typeof mq.addListener === 'function') mq.addListener(onMotionChange);
  } catch {
    /* ignore */
  }

  window.addEventListener('storage', (event) => {
    if (event.key === JUICE_STORAGE_KEY) bootLobbyFx();
  });

  if (cursorGlow) {
    /* element present for CSS cursor glow; driven via --cursor-* vars */
  }

  bootLobbyFx();

  /* ---------- restore state from the URL ---------- */

  const params = new URLSearchParams(location.search);
  const initialQuery = params.get('q') || '';
  const initialCategory = params.get('cat') || 'all';
  if (searchInput) searchInput.value = initialQuery;
  currentQuery = initialQuery;
  setCategory(initialCategory, { sync: false });
})();
