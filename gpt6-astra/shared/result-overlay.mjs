/**
 * Vendored from shared/resultOverlayDom.ts for static Astra HTML games (no Vite).
 * Same chrome contract: dimmed backdrop, card, badge, title, subtitle, stats, actions.
 */

const STYLE_ID = 'clubhouse-result-overlay-dom-style';
const ROOT_CLASS = 'clubhouse-result-overlay';

const CSS = `
.${ROOT_CLASS} {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #f1f5f9;
}
.${ROOT_CLASS}[hidden] {
  display: none !important;
}
.${ROOT_CLASS}__card {
  width: 100%;
  max-width: 24rem;
  padding: 1.5rem;
  text-align: center;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.95);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}
@media (min-width: 640px) {
  .${ROOT_CLASS}__card {
    padding: 2rem;
  }
}
.${ROOT_CLASS}__badge {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #fcd34d;
}
.${ROOT_CLASS}__badge[hidden],
.${ROOT_CLASS}__subtitle[hidden],
.${ROOT_CLASS}__stats[hidden],
.${ROOT_CLASS}__secondary[hidden] {
  display: none !important;
}
.${ROOT_CLASS}__title {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.25;
}
@media (min-width: 640px) {
  .${ROOT_CLASS}__title {
    font-size: 1.875rem;
  }
}
.${ROOT_CLASS}__title--win { color: #6ee7b7; }
.${ROOT_CLASS}__title--lose { color: #fca5a5; }
.${ROOT_CLASS}__title--neutral { color: #f1f5f9; }
.${ROOT_CLASS}__subtitle {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  color: #cbd5e1;
}
.${ROOT_CLASS}__stats {
  display: grid;
  gap: 0.5rem;
  margin: 0 0 1.5rem;
  font-size: 0.875rem;
}
.${ROOT_CLASS}__stat {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.${ROOT_CLASS}__stat-label {
  color: #94a3b8;
}
.${ROOT_CLASS}__stat-value {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #fff;
}
.${ROOT_CLASS}__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.${ROOT_CLASS}__actions--tight {
  margin-top: 1rem;
}
.${ROOT_CLASS}__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 44px;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  touch-action: manipulation;
  transition: background-color 0.15s ease;
}
.${ROOT_CLASS}__primary {
  color: #fff;
  background: #059669;
}
.${ROOT_CLASS}__primary:hover,
.${ROOT_CLASS}__primary:focus-visible {
  background: #10b981;
}
.${ROOT_CLASS}__primary:active {
  background: #047857;
}
.${ROOT_CLASS}__secondary {
  color: #f1f5f9;
  background: rgba(51, 65, 85, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.${ROOT_CLASS}__secondary:hover,
.${ROOT_CLASS}__secondary:focus-visible {
  background: #475569;
}
.${ROOT_CLASS}__secondary:active {
  background: #334155;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function setTitleVariant(titleEl, variant) {
  titleEl.classList.remove(
    `${ROOT_CLASS}__title--win`,
    `${ROOT_CLASS}__title--lose`,
    `${ROOT_CLASS}__title--neutral`,
  );
  titleEl.classList.add(`${ROOT_CLASS}__title--${variant}`);
}

/**
 * Mount a hidden result overlay under `parent` (defaults to document.body).
 */
export function createResultOverlay(parent = document.body) {
  ensureStyles();

  const root = document.createElement('div');
  root.className = ROOT_CLASS;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.hidden = true;

  root.innerHTML = `
    <div class="${ROOT_CLASS}__card">
      <p class="${ROOT_CLASS}__badge" data-part="badge" hidden></p>
      <h2 class="${ROOT_CLASS}__title ${ROOT_CLASS}__title--neutral" data-part="title"></h2>
      <p class="${ROOT_CLASS}__subtitle" data-part="subtitle" hidden></p>
      <dl class="${ROOT_CLASS}__stats" data-part="stats" hidden></dl>
      <div class="${ROOT_CLASS}__actions ${ROOT_CLASS}__actions--tight" data-part="actions">
        <button type="button" class="${ROOT_CLASS}__btn ${ROOT_CLASS}__primary" data-part="primary">再玩一局</button>
        <button type="button" class="${ROOT_CLASS}__btn ${ROOT_CLASS}__secondary" data-part="secondary" hidden>回選單</button>
      </div>
    </div>
  `;

  const badgeEl = root.querySelector('[data-part="badge"]');
  const titleEl = root.querySelector('[data-part="title"]');
  const subtitleEl = root.querySelector('[data-part="subtitle"]');
  const statsEl = root.querySelector('[data-part="stats"]');
  const actionsEl = root.querySelector('[data-part="actions"]');
  const primaryBtn = root.querySelector('[data-part="primary"]');
  const secondaryBtn = root.querySelector('[data-part="secondary"]');

  let onPrimary = null;
  let onSecondary = null;

  primaryBtn.addEventListener('click', () => {
    onPrimary?.();
  });
  secondaryBtn.addEventListener('click', () => {
    onSecondary?.();
  });

  parent.appendChild(root);

  return {
    root,
    show(options) {
      const variant = options.variant ?? 'neutral';
      const stats = options.stats ?? [];

      titleEl.textContent = options.title;
      root.setAttribute('aria-label', options.title);
      setTitleVariant(titleEl, variant);

      if (options.badge) {
        badgeEl.textContent = options.badge;
        badgeEl.hidden = false;
      } else {
        badgeEl.textContent = '';
        badgeEl.hidden = true;
      }

      if (options.subtitle) {
        subtitleEl.textContent = options.subtitle;
        subtitleEl.hidden = false;
      } else {
        subtitleEl.textContent = '';
        subtitleEl.hidden = true;
      }

      statsEl.replaceChildren();
      if (stats.length > 0) {
        for (const stat of stats) {
          const row = document.createElement('div');
          row.className = `${ROOT_CLASS}__stat`;
          const dt = document.createElement('dt');
          dt.className = `${ROOT_CLASS}__stat-label`;
          dt.textContent = stat.label;
          const dd = document.createElement('dd');
          dd.className = `${ROOT_CLASS}__stat-value`;
          dd.textContent = String(stat.value);
          row.append(dt, dd);
          statsEl.appendChild(row);
        }
        statsEl.hidden = false;
        actionsEl.classList.remove(`${ROOT_CLASS}__actions--tight`);
      } else {
        statsEl.hidden = true;
        actionsEl.classList.add(`${ROOT_CLASS}__actions--tight`);
      }

      primaryBtn.textContent = options.primaryLabel ?? '再玩一局';
      onPrimary = options.onPrimary;

      if (options.onSecondary) {
        secondaryBtn.textContent = options.secondaryLabel ?? '回選單';
        secondaryBtn.hidden = false;
        onSecondary = options.onSecondary;
      } else {
        secondaryBtn.hidden = true;
        onSecondary = null;
      }

      root.hidden = false;
    },
    hide() {
      root.hidden = true;
    },
    destroy() {
      onPrimary = null;
      onSecondary = null;
      root.remove();
    },
  };
}
