/**
 * Vanilla DOM twin of ResultOverlay for games that already import
 * @clubhouse/shared but do not run React + Tailwind (e.g. Sailing).
 *
 * Self-contained CSS so check:shared-styles does not require a Tailwind scan.
 * Visual contract matches ResultOverlay.tsx cinematic mist-neon chrome.
 */

import { resultOverlayChromeCss } from './resultOverlayChrome.ts';
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
${resultOverlayChromeCss(ROOT_CLASS)}
.${ROOT_CLASS} {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #e8eef9;
}
.${ROOT_CLASS}[hidden] { display: none !important; }
.${ROOT_CLASS}__kicker[hidden],
.${ROOT_CLASS}__subtitle[hidden],
.${ROOT_CLASS}__stats[hidden],
.${ROOT_CLASS}__secondary[hidden] {
  display: none !important;
}
.${ROOT_CLASS}__stat-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
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
    span.style.animationDelay = `${60 + index * 55}ms`;
    titleEl.appendChild(span);
  });
}

function setStars(starsEl: HTMLElement, lit: number): void {
  starsEl.replaceChildren();
  for (let i = 0; i < 5; i += 1) {
    const star = document.createElement('span');
    star.className = `${ROOT_CLASS}__star${i < lit ? ' is-lit' : ''}`;
    star.textContent = '★';
    star.style.animationDelay = `${260 + i * 140}ms`;
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
    <div class="${ROOT_CLASS}__aurora" aria-hidden="true"></div>
    <div class="${ROOT_CLASS}__rays" aria-hidden="true"></div>
    <div class="${ROOT_CLASS}__sparks" aria-hidden="true"></div>
    <div class="${ROOT_CLASS}__shockwave" aria-hidden="true"></div>
    <div class="${ROOT_CLASS}__shockwave-2" aria-hidden="true"></div>
    <div class="${ROOT_CLASS}__scanlines" aria-hidden="true"></div>
    <div class="${ROOT_CLASS}__vignette" aria-hidden="true"></div>
    <div class="${ROOT_CLASS}__stage">
      <div class="${ROOT_CLASS}__bloom" aria-hidden="true"></div>
      <p class="${ROOT_CLASS}__kicker" data-part="badge" hidden></p>
      <h2 class="${ROOT_CLASS}__billboard" data-part="title"></h2>
      <p class="${ROOT_CLASS}__subtitle" data-part="subtitle" hidden></p>
      <div class="${ROOT_CLASS}__card ${ROOT_CLASS}__card--neutral" data-part="card">
        <div class="${ROOT_CLASS}__sheen" aria-hidden="true"></div>
        <div class="${ROOT_CLASS}__metal" aria-hidden="true"></div>
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
  const shockwaves = root.querySelectorAll<HTMLElement>(
    `.${ROOT_CLASS}__shockwave, .${ROOT_CLASS}__shockwave-2`,
  );
  const sheen = root.querySelector<HTMLElement>(`.${ROOT_CLASS}__sheen`)!;

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
      else if (variant === 'win') root.classList.add(`${ROOT_CLASS}--win`);
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
      for (const wave of shockwaves) {
        wave.style.animation = 'none';
        void wave.offsetWidth;
        wave.style.animation = '';
      }
      sheen.style.animation = 'none';
      void sheen.offsetWidth;
      sheen.style.animation = '';
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
