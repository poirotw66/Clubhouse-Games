(() => {
  const searchInput = document.getElementById('game-search');
  const searchClear = document.getElementById('search-clear');
  const searchStatus = document.getElementById('search-status');
  const gameCountStat = document.getElementById('game-count-stat');
  const categoryNav = document.getElementById('category-nav');

  const rows = [...document.querySelectorAll('.game-row')];
  const cards = [...document.querySelectorAll('.game-card')];

  if (gameCountStat) {
    gameCountStat.textContent = String(rows.length);
  }

  function setSearchTerm(term) {
    const normalized = term.trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach((card) => {
      let cardHasMatch = false;
      card.querySelectorAll('.game-row').forEach((row) => {
        const haystack = (row.dataset.search || '').toLowerCase();
        const show = !normalized || haystack.includes(normalized);
        row.hidden = !show;
        if (show) {
          cardHasMatch = true;
          visibleCount += 1;
        }
      });
      card.hidden = !cardHasMatch;
    });

    if (searchStatus) {
      if (!normalized) {
        searchStatus.textContent = '';
      } else if (visibleCount === 0) {
        searchStatus.textContent = '找不到符合的遊戲，請換個關鍵字試試。';
      } else {
        searchStatus.textContent = `顯示 ${visibleCount} / ${rows.length} 款遊戲`;
      }
    }

    if (searchClear) {
      searchClear.hidden = !normalized;
    }

    categoryNav?.querySelectorAll('.category-pill').forEach((pill) => {
      const id = pill.getAttribute('href')?.slice(1);
      const card = id ? document.getElementById(id) : null;
      pill.classList.toggle('is-muted', !!normalized && card?.hidden);
    });
  }

  searchInput?.addEventListener('input', (event) => {
    setSearchTerm(event.target.value);
  });

  searchClear?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    searchInput.focus();
    setSearchTerm('');
  });

  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      searchInput.value = '';
      setSearchTerm('');
    }
  });

  categoryNav?.addEventListener('click', (event) => {
    const link = event.target.closest('a.category-pill');
    if (!link) return;
    categoryNav.querySelectorAll('.category-pill').forEach((pill) => {
      pill.classList.remove('is-active');
    });
    link.classList.add('is-active');
  });
})();
