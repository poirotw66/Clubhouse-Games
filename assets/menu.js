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

  let currentQuery = '';
  let currentCategory = 'all';

  if (gameCountStat) gameCountStat.textContent = String(tiles.length);
  if (categoryCountStat) categoryCountStat.textContent = String(groups.length);
  if (emptyTotal) emptyTotal.textContent = String(tiles.length);

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

  resetButton?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    currentQuery = '';
    setCategory('all');
    searchInput?.focus();
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
    return typeof href === 'string' && /^Games\/[\w.-]+\/$/.test(href);
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
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      // Move focus to the top of the page without opening a mobile keyboard.
      document.querySelector('.brand')?.focus();
    });
  }

  /* ---------- restore state from the URL ---------- */

  const params = new URLSearchParams(location.search);
  const initialQuery = params.get('q') || '';
  const initialCategory = params.get('cat') || 'all';
  if (searchInput) searchInput.value = initialQuery;
  currentQuery = initialQuery;
  setCategory(initialCategory, { sync: false });
})();
