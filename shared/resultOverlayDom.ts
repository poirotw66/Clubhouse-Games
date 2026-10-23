/**
 * Vanilla DOM twin of ResultOverlay for games that already import
 * @clubhouse/shared but do not run React + Tailwind (e.g. Sailing).
 *
 * Self-contained CSS (BackToMenu pattern) so check:shared-styles does not
 * require a Tailwind scan. Visual contract matches ResultOverlay.tsx:
 * full-bleed dimmed backdrop, card, optional badge, title, subtitle, stats,
 * primary + optional secondary actions — plus mist-neon juice (confetti,
 * count-up, sheen) gated by clubhouse:juice / prefers-reduced-motion.
 */

import { celebrateResultOverlay, countUpStat, type CountUpHandle } from './resultOverlayFx.ts';

export interface ResultStat {
  label: string;
  value: string | number;
}

export type ResultOverlayVariant = 'win' | 'lose' | 'neutral';

export interface ResultOverlayDomOptions {
  title: string;
  subtitle?: string;
  badge?: string;
  stats?: ResultStat[];
  primaryLabel?: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  variant?: ResultOverlayVariant;
}

export interface ResultOverlayDomHandle {
  show(options: ResultOverlayDomOptions): void;
  hide(): void;
  destroy(): void;
  readonly root: HTMLElement;
}

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
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(45, 212, 191, 0.16), transparent 55%),
    radial-gradient(90% 70% at 100% 100%, rgba(244, 114, 182, 0.12), transparent 50%),
    rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #e8eef9;
}
.${ROOT_CLASS}[hidden] {
  display: none !important;
}
.${ROOT_CLASS}__card {
  position: relative;
  overflow: hidden;
  width: 100%;
  max-width: 24rem;
  padding: 1.5rem;
  text-align: center;
  border-radius: 1rem;
  border: 1px solid rgba(165, 243, 252, 0.18);
  background: linear-gradient(165deg, rgba(10, 16, 32, 0.96), rgba(6, 8, 15, 0.98));
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(45, 212, 191, 0.08),
    0 0 40px rgba(45, 212, 191, 0.12);
  animation: clubhouse-result-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.${ROOT_CLASS}__card--win {
  border-color: rgba(45, 212, 191, 0.45);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(45, 212, 191, 0.2),
    0 0 48px rgba(45, 212, 191, 0.28),
    0 0 72px rgba(244, 114, 182, 0.12);
}
.${ROOT_CLASS}__card--lose {
  border-color: rgba(251, 113, 133, 0.4);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.65),
    0 0 40px rgba(251, 113, 133, 0.2);
}
.${ROOT_CLASS}__sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(165, 243, 252, 0.14) 48%,
    rgba(244, 114, 182, 0.1) 54%,
    transparent 72%
  );
  transform: translate3d(-60%, 0, 0);
  animation: clubhouse-result-sheen 1.1s ease-out 0.15s both;
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
.${ROOT_CLASS}__title--win { color: #5eead4; text-shadow: 0 0 24px rgba(45, 212, 191, 0.45); }
.${ROOT_CLASS}__title--lose { color: #fda4af; text-shadow: 0 0 20px rgba(251, 113, 133, 0.35); }
.${ROOT_CLASS}__title--neutral { color: #e8eef9; text-shadow: 0 0 18px rgba(103, 232, 249, 0.25); }
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
  background: rgba(10, 16, 32, 0.85);
  border: 1px solid rgba(165, 243, 252, 0.1);
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
  letter-spacing: 0.02em;
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
  transition: background-color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.${ROOT_CLASS}__primary {
  color: #fff;
  background: #059669;
  box-shadow: 0 0 18px rgba(16, 185, 129, 0.28);
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
  border-color: rgba(165, 243, 252, 0.28);
}
.${ROOT_CLASS}__secondary:active {
  background: #334155;
}
@keyframes clubhouse-result-in {
  from { opacity: 0; transform: translate3d(0, 14px, 0) scale(0.96); }
  to { opacity: 1; transform: none; }
}
@keyframes clubhouse-result-sheen {
  from { transform: translate3d(-60%, 0, 0); opacity: 0; }
  30% { opacity: 1; }
  to { transform: translate3d(60%, 0, 0); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .${ROOT_CLASS}__card,
  .${ROOT_CLASS}__sheen { animation: none !important; }
  .${ROOT_CLASS}__card { opacity: 1; transform: none; }
}
`;

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function setTitleVariant(titleEl: HTMLElement, variant: ResultOverlayVariant): void {
  titleEl.classList.remove(
    `${ROOT_CLASS}__title--win`,
    `${ROOT_CLASS}__title--lose`,
    `${ROOT_CLASS}__title--neutral`,
  );
  titleEl.classList.add(`${ROOT_CLASS}__title--${variant}`);
}

function setCardVariant(cardEl: HTMLElement, variant: ResultOverlayVariant): void {
  cardEl.classList.remove(
    `${ROOT_CLASS}__card--win`,
    `${ROOT_CLASS}__card--lose`,
    `${ROOT_CLASS}__card--neutral`,
  );
  cardEl.classList.add(`${ROOT_CLASS}__card--${variant}`);
}

/**
 * Mount a hidden result overlay under `parent` (defaults to document.body).
 * Call `show` / `hide` from the game loop; `destroy` when tearing down.
 */
export function createResultOverlay(parent: HTMLElement = document.body): ResultOverlayDomHandle {
  ensureStyles();

  const root = document.createElement('div');
  root.className = ROOT_CLASS;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('data-result-overlay', '1');
  root.hidden = true;

  root.innerHTML = `
    <div class="${ROOT_CLASS}__card ${ROOT_CLASS}__card--neutral" data-part="card">
      <div class="${ROOT_CLASS}__sheen" aria-hidden="true"></div>
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

  const cardEl = root.querySelector<HTMLElement>('[data-part="card"]')!;
  const badgeEl = root.querySelector<HTMLElement>('[data-part="badge"]')!;
  const titleEl = root.querySelector<HTMLElement>('[data-part="title"]')!;
  const subtitleEl = root.querySelector<HTMLElement>('[data-part="subtitle"]')!;
  const statsEl = root.querySelector<HTMLElement>('[data-part="stats"]')!;
  const actionsEl = root.querySelector<HTMLElement>('[data-part="actions"]')!;
  const primaryBtn = root.querySelector<HTMLButtonElement>('[data-part="primary"]')!;
  const secondaryBtn = root.querySelector<HTMLButtonElement>('[data-part="secondary"]')!;

  let onPrimary: (() => void) | null = null;
  let onSecondary: (() => void) | null = null;
  let countHandles: CountUpHandle[] = [];

  primaryBtn.addEventListener('click', () => {
    onPrimary?.();
  });
  secondaryBtn.addEventListener('click', () => {
    onSecondary?.();
  });

  parent.appendChild(root);

  return {
    root,
    show(options: ResultOverlayDomOptions): void {
      const variant = options.variant ?? 'neutral';
      const stats = options.stats ?? [];

      for (const handle of countHandles) handle.cancel();
      countHandles = [];

      titleEl.textContent = options.title;
      root.setAttribute('aria-label', options.title);
      root.setAttribute('data-variant', variant);
      setTitleVariant(titleEl, variant);
      setCardVariant(cardEl, variant);

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
          countHandles.push(countUpStat(dd, stat.value));
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
      // Restart sheen by reflow when showing again.
      const sheen = cardEl.querySelector<HTMLElement>(`.${ROOT_CLASS}__sheen`);
      if (sheen) {
        sheen.style.animation = 'none';
        void sheen.offsetWidth;
        sheen.style.animation = '';
      }
      celebrateResultOverlay({ variant, cardEl });
    },
    hide(): void {
      for (const handle of countHandles) handle.cancel();
      countHandles = [];
      root.hidden = true;
    },
    destroy(): void {
      for (const handle of countHandles) handle.cancel();
      countHandles = [];
      onPrimary = null;
      onSecondary = null;
      root.remove();
    },
  };
}
