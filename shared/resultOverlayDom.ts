/**
 * Vanilla DOM twin of ResultOverlay for games that already import
 * @clubhouse/shared but do not run React + Tailwind (e.g. Sailing).
 *
 * Self-contained CSS so check:shared-styles does not require a Tailwind scan.
 * Visual contract matches ResultOverlay.tsx cinematic mist-neon chrome.
 */

import {
  celebrateResultOverlay,
  countUpStat,
  resolveEmphasis,
  splitTitleChars,
  starCountFor,
  type CountUpHandle,
  type ResultOverlayEmphasis,
} from './resultOverlayFx.ts';

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
  emphasis?: ResultOverlayEmphasis;
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
  overflow: hidden;
  background:
    radial-gradient(120% 80% at 50% 10%, rgba(45, 212, 191, 0.22), transparent 55%),
    radial-gradient(90% 70% at 100% 100%, rgba(244, 114, 182, 0.18), transparent 50%),
    rgba(2, 4, 10, 0.82);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #e8eef9;
}
.${ROOT_CLASS}[hidden] { display: none !important; }
.${ROOT_CLASS}--lose {
  background:
    radial-gradient(120% 80% at 50% 10%, rgba(244, 63, 94, 0.28), transparent 55%),
    radial-gradient(90% 70% at 0% 100%, rgba(127, 29, 29, 0.35), transparent 50%),
    rgba(8, 2, 6, 0.86);
}
.${ROOT_CLASS}--record {
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(251, 191, 36, 0.32), transparent 55%),
    radial-gradient(90% 70% at 100% 100%, rgba(244, 114, 182, 0.2), transparent 50%),
    rgba(8, 6, 2, 0.84);
}
.${ROOT_CLASS}__rays {
  position: absolute; inset: -20%; pointer-events: none; opacity: 0.55; mix-blend-mode: screen;
  background: repeating-conic-gradient(from 0deg at 50% 50%, rgba(165,243,252,0) 0deg 12deg, rgba(45,212,191,0.14) 12deg 14deg);
  animation: clubhouse-result-rays 18s linear infinite;
}
.${ROOT_CLASS}--lose .${ROOT_CLASS}__rays {
  background: repeating-conic-gradient(from 0deg at 50% 50%, rgba(251,113,133,0) 0deg 14deg, rgba(244,63,94,0.16) 14deg 16deg);
}
.${ROOT_CLASS}__shockwave {
  position: absolute; left: 50%; top: 42%; width: 40px; height: 40px; margin: -20px 0 0 -20px;
  border-radius: 50%; border: 2px solid rgba(165,243,252,0.55);
  box-shadow: 0 0 30px rgba(45,212,191,0.45);
  animation: clubhouse-result-shock 900ms cubic-bezier(0.16,1,0.3,1) 180ms both;
  pointer-events: none;
}
.${ROOT_CLASS}__vignette {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.7) 100%);
}
.${ROOT_CLASS}__stage { position: relative; z-index: 2; width: 100%; max-width: 28rem; text-align: center; }
.${ROOT_CLASS}__kicker {
  margin: 0 0 0.65rem; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.28em;
  text-transform: uppercase; color: #fde68a; text-shadow: 0 0 18px rgba(251,191,36,0.65);
}
.${ROOT_CLASS}__kicker[hidden], .${ROOT_CLASS}__subtitle[hidden], .${ROOT_CLASS}__stats[hidden], .${ROOT_CLASS}__secondary[hidden] {
  display: none !important;
}
.${ROOT_CLASS}__billboard {
  margin: 0 0 0.75rem; font-size: clamp(2rem, 8vw, 3.1rem); font-weight: 800; line-height: 1.1;
  color: #ecfeff; filter: drop-shadow(0 0 18px rgba(45,212,191,0.55));
}
.${ROOT_CLASS}--lose .${ROOT_CLASS}__billboard { color: #ffe4e6; filter: drop-shadow(0 0 18px rgba(244,63,94,0.55)); }
.${ROOT_CLASS}--record .${ROOT_CLASS}__billboard { color: #fffbeb; filter: drop-shadow(0 0 22px rgba(251,191,36,0.7)); }
.${ROOT_CLASS}__char {
  display: inline-block; opacity: 0; transform: translate3d(0, 18px, 0) scale(0.92);
  animation: clubhouse-result-char 520ms cubic-bezier(0.16,1,0.3,1) forwards;
  text-shadow: 0 0 8px rgba(165,243,252,0.9), -1px 0 rgba(103,232,249,0.7), 1px 0 rgba(244,114,182,0.7);
}
.${ROOT_CLASS}__subtitle { margin: 0 0 1rem; font-size: 0.95rem; color: #cbd5e1; }
.${ROOT_CLASS}__card {
  position: relative; overflow: hidden; margin: 0 auto; padding: 1.35rem;
  border-radius: 1.15rem; border: 1px solid rgba(165,243,252,0.28);
  background: linear-gradient(145deg, rgba(18,28,48,0.92), rgba(6,10,20,0.96));
  box-shadow: 0 28px 60px -18px rgba(0,0,0,0.75), 0 0 48px rgba(45,212,191,0.22);
  animation: clubhouse-result-card 560ms cubic-bezier(0.16,1,0.3,1) 80ms both;
}
.${ROOT_CLASS}__card--win {
  border-color: rgba(45,212,191,0.55);
  box-shadow: 0 28px 60px -18px rgba(0,0,0,0.75), 0 0 56px rgba(45,212,191,0.35), 0 0 90px rgba(244,114,182,0.16);
}
.${ROOT_CLASS}__card--lose {
  border-color: rgba(251,113,133,0.5);
  box-shadow: 0 28px 60px -18px rgba(0,0,0,0.75), 0 0 48px rgba(244,63,94,0.28);
}
.${ROOT_CLASS}__card--record {
  border-color: rgba(251,191,36,0.65);
  box-shadow: 0 28px 60px -18px rgba(0,0,0,0.75), 0 0 64px rgba(251,191,36,0.4);
}
.${ROOT_CLASS}__sheen {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(115deg, transparent 28%, rgba(255,255,255,0.22) 48%, rgba(103,232,249,0.16) 54%, transparent 72%);
  transform: translate3d(-70%,0,0);
  animation: clubhouse-result-sheen 1.15s ease-out 0.2s both;
}
.${ROOT_CLASS}__stars { display: flex; justify-content: center; gap: 0.35rem; margin-bottom: 0.9rem; font-size: 1.35rem; }
.${ROOT_CLASS}__star {
  color: rgba(148,163,184,0.35); opacity: 0; transform: scale(0.6);
  animation: clubhouse-result-star 420ms cubic-bezier(0.16,1,0.3,1) forwards;
}
.${ROOT_CLASS}__star.is-lit { color: #fbbf24; filter: drop-shadow(0 0 10px rgba(251,191,36,0.85)); }
.${ROOT_CLASS}__stats { display: grid; gap: 0.55rem; margin: 0 0 1.15rem; font-size: 0.9rem; }
.${ROOT_CLASS}__stat {
  display: flex; justify-content: space-between; align-items: baseline; gap: 1rem;
  padding: 0.55rem 0.8rem; border-radius: 0.65rem;
  background: rgba(6,10,20,0.72); border: 1px solid rgba(165,243,252,0.12);
}
.${ROOT_CLASS}__stat-label { color: #94a3b8; }
.${ROOT_CLASS}__stat-value {
  margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600; font-variant-numeric: tabular-nums; color: #fff; font-size: 1.05rem;
  text-shadow: 0 0 12px rgba(165,243,252,0.35);
}
.${ROOT_CLASS}__actions { display: flex; flex-direction: column; gap: 0.55rem; }
.${ROOT_CLASS}__actions--tight { margin-top: 0.35rem; }
.${ROOT_CLASS}__btn {
  position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center;
  gap: 0.5rem; width: 100%; min-height: 48px; padding: 0.75rem 1.5rem; border: none; border-radius: 0.75rem;
  font-size: 1rem; font-weight: 600; font-family: inherit; cursor: pointer; touch-action: manipulation;
}
.${ROOT_CLASS}__primary {
  color: #042f2e;
  background: linear-gradient(120deg, #5eead4 0%, #2dd4bf 40%, #f472b6 100%);
  background-size: 180% 100%;
  box-shadow: 0 0 24px rgba(45,212,191,0.45);
  animation: clubhouse-result-cta 3.6s ease-in-out infinite;
}
.${ROOT_CLASS}--lose .${ROOT_CLASS}__primary {
  color: #fff;
  background: linear-gradient(120deg, #fb7185 0%, #e11d48 55%, #881337 100%);
  box-shadow: 0 0 24px rgba(244,63,94,0.45);
}
.${ROOT_CLASS}--record .${ROOT_CLASS}__primary {
  color: #422006;
  background: linear-gradient(120deg, #fde68a 0%, #fbbf24 45%, #f472b6 100%);
  box-shadow: 0 0 28px rgba(251,191,36,0.5);
}
.${ROOT_CLASS}__btn-shine {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.45) 50%, transparent 60%);
  transform: translate3d(-120%,0,0);
  animation: clubhouse-result-btnshine 2.4s ease-in-out 0.6s infinite;
}
.${ROOT_CLASS}__secondary {
  color: #e2e8f0; background: rgba(30,41,59,0.72); border: 1px solid rgba(165,243,252,0.2);
}
@keyframes clubhouse-result-rays { to { transform: rotate(360deg); } }
@keyframes clubhouse-result-shock { from { transform: scale(0.2); opacity: 0.9; } to { transform: scale(18); opacity: 0; } }
@keyframes clubhouse-result-char { to { opacity: 1; transform: none; } }
@keyframes clubhouse-result-card { from { opacity: 0; transform: translate3d(0,22px,0) scale(0.94); } to { opacity: 1; transform: none; } }
@keyframes clubhouse-result-sheen { from { transform: translate3d(-70%,0,0); opacity: 0; } 35% { opacity: 1; } to { transform: translate3d(70%,0,0); opacity: 0; } }
@keyframes clubhouse-result-star { to { opacity: 1; transform: scale(1); } }
@keyframes clubhouse-result-cta { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@keyframes clubhouse-result-btnshine { 0%,55% { transform: translate3d(-120%,0,0); } 80%,100% { transform: translate3d(120%,0,0); } }
@media (prefers-reduced-motion: reduce) {
  .${ROOT_CLASS}__rays, .${ROOT_CLASS}__shockwave, .${ROOT_CLASS}__sheen, .${ROOT_CLASS}__char,
  .${ROOT_CLASS}__star, .${ROOT_CLASS}__card, .${ROOT_CLASS}__primary, .${ROOT_CLASS}__btn-shine { animation: none !important; }
  .${ROOT_CLASS}__char, .${ROOT_CLASS}__star, .${ROOT_CLASS}__card { opacity: 1; transform: none; }
  .${ROOT_CLASS}__shockwave { display: none; }
}
`;

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = CSS;
}

function setBillboard(titleEl: HTMLElement, title: string): void {
  titleEl.replaceChildren();
  splitTitleChars(title).forEach((ch, index) => {
    const span = document.createElement('span');
    span.className = `${ROOT_CLASS}__char`;
    span.textContent = ch === ' ' ? '\u00a0' : ch;
    span.style.animationDelay = `${80 + index * 45}ms`;
    titleEl.appendChild(span);
  });
}

function setStars(starsEl: HTMLElement, lit: number): void {
  starsEl.replaceChildren();
  for (let i = 0; i < 5; i += 1) {
    const star = document.createElement('span');
    star.className = `${ROOT_CLASS}__star${i < lit ? ' is-lit' : ''}`;
    star.textContent = '★';
    star.style.animationDelay = `${280 + i * 120}ms`;
    starsEl.appendChild(star);
  }
}

export function createResultOverlay(parent: HTMLElement = document.body): ResultOverlayDomHandle {
  ensureStyles();

  const root = document.createElement('div');
  root.className = ROOT_CLASS;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('data-result-overlay', '1');
  root.hidden = true;

  root.innerHTML = `
    <div class="${ROOT_CLASS}__rays" aria-hidden="true"></div>
    <div class="${ROOT_CLASS}__shockwave" aria-hidden="true"></div>
    <div class="${ROOT_CLASS}__vignette" aria-hidden="true"></div>
    <div class="${ROOT_CLASS}__stage">
      <p class="${ROOT_CLASS}__kicker" data-part="badge" hidden></p>
      <h2 class="${ROOT_CLASS}__billboard" data-part="title"></h2>
      <p class="${ROOT_CLASS}__subtitle" data-part="subtitle" hidden></p>
      <div class="${ROOT_CLASS}__card ${ROOT_CLASS}__card--neutral" data-part="card">
        <div class="${ROOT_CLASS}__sheen" aria-hidden="true"></div>
        <div class="${ROOT_CLASS}__stars" data-part="stars" aria-hidden="true"></div>
        <dl class="${ROOT_CLASS}__stats" data-part="stats" hidden></dl>
        <div class="${ROOT_CLASS}__actions ${ROOT_CLASS}__actions--tight" data-part="actions">
          <button type="button" class="${ROOT_CLASS}__btn ${ROOT_CLASS}__primary" data-part="primary">
            <span class="${ROOT_CLASS}__btn-shine" aria-hidden="true"></span>
            再玩一局
          </button>
          <button type="button" class="${ROOT_CLASS}__btn ${ROOT_CLASS}__secondary" data-part="secondary" hidden>回選單</button>
        </div>
      </div>
    </div>
  `;

  const cardEl = root.querySelector<HTMLElement>('[data-part="card"]')!;
  const badgeEl = root.querySelector<HTMLElement>('[data-part="badge"]')!;
  const titleEl = root.querySelector<HTMLElement>('[data-part="title"]')!;
  const subtitleEl = root.querySelector<HTMLElement>('[data-part="subtitle"]')!;
  const starsEl = root.querySelector<HTMLElement>('[data-part="stars"]')!;
  const statsEl = root.querySelector<HTMLElement>('[data-part="stats"]')!;
  const actionsEl = root.querySelector<HTMLElement>('[data-part="actions"]')!;
  const primaryBtn = root.querySelector<HTMLButtonElement>('[data-part="primary"]')!;
  const secondaryBtn = root.querySelector<HTMLButtonElement>('[data-part="secondary"]')!;
  const shockwave = root.querySelector<HTMLElement>(`.${ROOT_CLASS}__shockwave`)!;

  let onPrimary: (() => void) | null = null;
  let onSecondary: (() => void) | null = null;
  let countHandles: CountUpHandle[] = [];

  primaryBtn.addEventListener('click', () => onPrimary?.());
  secondaryBtn.addEventListener('click', () => onSecondary?.());
  parent.appendChild(root);

  return {
    root,
    show(options: ResultOverlayDomOptions): void {
      const variant = options.variant ?? 'neutral';
      const emphasis = resolveEmphasis({
        emphasis: options.emphasis,
        badge: options.badge,
        title: options.title,
      });
      const stats = options.stats ?? [];

      for (const handle of countHandles) handle.cancel();
      countHandles = [];

      root.className = ROOT_CLASS;
      if (variant === 'lose') root.classList.add(`${ROOT_CLASS}--lose`);
      if (emphasis === 'record') root.classList.add(`${ROOT_CLASS}--record`);
      root.setAttribute('aria-label', options.title);
      root.setAttribute('data-variant', variant);
      root.setAttribute('data-emphasis', emphasis);

      setBillboard(titleEl, options.title);
      setStars(starsEl, starCountFor(variant, emphasis));

      cardEl.className = `${ROOT_CLASS}__card ${ROOT_CLASS}__card--${variant}`;
      if (emphasis === 'record') cardEl.classList.add(`${ROOT_CLASS}__card--record`);

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

      // Keep shine span inside primary button.
      const shine = primaryBtn.querySelector(`.${ROOT_CLASS}__btn-shine`);
      primaryBtn.textContent = '';
      if (shine) primaryBtn.appendChild(shine);
      else {
        const s = document.createElement('span');
        s.className = `${ROOT_CLASS}__btn-shine`;
        s.setAttribute('aria-hidden', 'true');
        primaryBtn.appendChild(s);
      }
      primaryBtn.appendChild(document.createTextNode(options.primaryLabel ?? '再玩一局'));
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
      shockwave.style.animation = 'none';
      void shockwave.offsetWidth;
      shockwave.style.animation = '';
      const sheen = cardEl.querySelector<HTMLElement>(`.${ROOT_CLASS}__sheen`);
      if (sheen) {
        sheen.style.animation = 'none';
        void sheen.offsetWidth;
        sheen.style.animation = '';
      }
      celebrateResultOverlay({ variant, emphasis, cardEl });
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
