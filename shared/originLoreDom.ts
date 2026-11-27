/**
 * Self-contained vanilla DOM twin of OriginLoreModal for games that do not use
 * React + Tailwind CSS.
 *
 * Injects scoped styles into <head> and never embeds Tailwind utility className
 * literals so scripts/check-shared-styles.mjs treats it as style-independent.
 */

import type { GameLoreDossier, LoreSection } from './originLoreData.ts';

export interface OriginLoreExtraTab {
  id: string;
  label: string;
  render: (container: HTMLElement) => void;
}

export interface OriginLoreModalOptions {
  dossier: GameLoreDossier;
  initialTab?: 'origin' | 'rules' | string;
  onClose?: () => void;
  parent?: HTMLElement;
  extraTab?: OriginLoreExtraTab;
}

export interface OriginLoreModalHandle {
  readonly root: HTMLElement;
  setTab(tab: 'origin' | 'rules' | string): void;
  close(): void;
}

export interface MountOriginLoreTriggerOptions {
  dossier: GameLoreDossier;
  label?: string;
  icon?: string;
  initialTab?: 'origin' | 'rules' | string;
  buttonClass?: string;
  ariaLabel?: string;
  onOpen?: () => void;
  onClose?: () => void;
}

interface ThemeTokens {
  border: string;
  glow: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  tabBg: string;
  tabBorder: string;
  tabText: string;
  tabGlow: string;
  sakuraiBorder: string;
  sakuraiBg: string;
}

const THEME_TOKENS: Record<GameLoreDossier['themeColor'], ThemeTokens> = {
  emerald: {
    border: 'rgba(16, 185, 129, 0.42)',
    glow: '0 0 36px rgba(16, 185, 129, 0.25)',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: 'rgba(52, 211, 153, 0.35)',
    badgeText: '#6ee7b7',
    tabBg: 'rgba(16, 185, 129, 0.2)',
    tabBorder: '#34d399',
    tabText: '#d1fae5',
    tabGlow: '0 0 12px rgba(16, 185, 129, 0.3)',
    sakuraiBorder: 'rgba(16, 185, 129, 0.5)',
    sakuraiBg: 'rgba(6, 78, 59, 0.35)',
  },
  amber: {
    border: 'rgba(245, 158, 11, 0.42)',
    glow: '0 0 36px rgba(245, 158, 11, 0.25)',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeBorder: 'rgba(251, 191, 36, 0.35)',
    badgeText: '#fcd34d',
    tabBg: 'rgba(245, 158, 11, 0.2)',
    tabBorder: '#fbbf24',
    tabText: '#fef3c7',
    tabGlow: '0 0 12px rgba(245, 158, 11, 0.3)',
    sakuraiBorder: 'rgba(245, 158, 11, 0.5)',
    sakuraiBg: 'rgba(69, 26, 3, 0.4)',
  },
  indigo: {
    border: 'rgba(99, 102, 241, 0.42)',
    glow: '0 0 36px rgba(99, 102, 241, 0.25)',
    badgeBg: 'rgba(99, 102, 241, 0.15)',
    badgeBorder: 'rgba(129, 140, 248, 0.35)',
    badgeText: '#a5b4fc',
    tabBg: 'rgba(99, 102, 241, 0.2)',
    tabBorder: '#818cf8',
    tabText: '#e0e7ff',
    tabGlow: '0 0 12px rgba(99, 102, 241, 0.3)',
    sakuraiBorder: 'rgba(99, 102, 241, 0.5)',
    sakuraiBg: 'rgba(30, 27, 75, 0.42)',
  },
  purple: {
    border: 'rgba(168, 85, 247, 0.42)',
    glow: '0 0 36px rgba(168, 85, 247, 0.25)',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    badgeBorder: 'rgba(192, 132, 252, 0.35)',
    badgeText: '#d8b4fe',
    tabBg: 'rgba(168, 85, 247, 0.2)',
    tabBorder: '#c084fc',
    tabText: '#f3e8ff',
    tabGlow: '0 0 12px rgba(168, 85, 247, 0.3)',
    sakuraiBorder: 'rgba(168, 85, 247, 0.5)',
    sakuraiBg: 'rgba(59, 7, 100, 0.4)',
  },
  rose: {
    border: 'rgba(244, 63, 94, 0.42)',
    glow: '0 0 36px rgba(244, 63, 94, 0.25)',
    badgeBg: 'rgba(244, 63, 94, 0.15)',
    badgeBorder: 'rgba(251, 113, 133, 0.35)',
    badgeText: '#fda4af',
    tabBg: 'rgba(244, 63, 94, 0.2)',
    tabBorder: '#fb7185',
    tabText: '#ffe4e6',
    tabGlow: '0 0 12px rgba(244, 63, 94, 0.3)',
    sakuraiBorder: 'rgba(244, 63, 94, 0.5)',
    sakuraiBg: 'rgba(76, 5, 25, 0.42)',
  },
  cyan: {
    border: 'rgba(6, 182, 212, 0.42)',
    glow: '0 0 36px rgba(6, 182, 212, 0.25)',
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    badgeBorder: 'rgba(34, 211, 238, 0.35)',
    badgeText: '#67e8f9',
    tabBg: 'rgba(6, 182, 212, 0.2)',
    tabBorder: '#22d3ee',
    tabText: '#cffafe',
    tabGlow: '0 0 12px rgba(6, 182, 212, 0.3)',
    sakuraiBorder: 'rgba(6, 182, 212, 0.5)',
    sakuraiBg: 'rgba(8, 51, 68, 0.42)',
  },
};

const STYLE_ID = 'clubhouse-origin-lore-dom-style';
const ROOT_CLASS = 'clubhouse-lore-overlay';

const CSS = `
.${ROOT_CLASS} {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: rgba(2, 6, 23, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  overflow-y: auto;
  pointer-events: auto;
  font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, -apple-system, sans-serif;
  color: #f1f5f9;
  animation: clubhouse-lore-fade 0.18s ease-out;
  box-sizing: border-box;
}
.${ROOT_CLASS} *, .${ROOT_CLASS} *::before, .${ROOT_CLASS} *::after {
  box-sizing: border-box;
}
@keyframes clubhouse-lore-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.${ROOT_CLASS}__dialog {
  position: relative;
  width: min(768px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  border: 1px solid var(--lore-border, rgba(245, 158, 11, 0.42));
  background: rgba(2, 6, 23, 0.96);
  color: #f1f5f9;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75), var(--lore-glow, 0 0 36px rgba(245, 158, 11, 0.25));
  overflow: hidden;
  text-align: left;
}
.${ROOT_CLASS}__header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 22px;
  border-bottom: 1px solid #1e293b;
  background: rgba(15, 23, 42, 0.7);
}
.${ROOT_CLASS}__header-meta {
  flex: 1;
  min-width: 0;
}
.${ROOT_CLASS}__badge {
  display: inline-block;
  margin-bottom: 6px;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--lore-badge-border);
  background: var(--lore-badge-bg);
  color: var(--lore-badge-text);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.${ROOT_CLASS}__title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  line-height: 1.25;
  color: #ffffff;
  letter-spacing: -0.01em;
}
.${ROOT_CLASS}__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.45;
  color: #94a3b8;
}
.${ROOT_CLASS}__close {
  flex-shrink: 0;
  min-height: 44px;
  min-width: 44px;
  padding: 8px 14px;
  border-radius: 12px;
  border: 1px solid #334155;
  background: rgba(30, 41, 59, 0.85);
  color: #cbd5e1;
  font: 700 13px/1 inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease, color 0.15s ease;
}
.${ROOT_CLASS}__close:hover {
  background: #334155;
  color: #ffffff;
}
.${ROOT_CLASS}__close:focus-visible,
.${ROOT_CLASS}__tab:focus-visible,
.${ROOT_CLASS}__switch:focus-visible {
  outline: 2px solid var(--lore-tab-border, #fbbf24);
  outline-offset: 2px;
}
.${ROOT_CLASS}__kbd {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #94a3b8;
}
.${ROOT_CLASS}__tabs {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  padding: 10px 22px 0;
  border-bottom: 1px solid #1e293b;
  background: rgba(15, 23, 42, 0.45);
  overflow-x: auto;
}
.${ROOT_CLASS}__tab {
  min-height: 44px;
  padding: 8px 16px;
  border-radius: 12px 12px 0 0;
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  color: #94a3b8;
  font: 700 13px/1.2 inherit;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.${ROOT_CLASS}__tab:hover {
  color: #e2e8f0;
  background: rgba(30, 41, 59, 0.45);
}
.${ROOT_CLASS}__tab[aria-selected="true"] {
  border-color: var(--lore-tab-border);
  background: var(--lore-tab-bg);
  color: var(--lore-tab-text);
  box-shadow: var(--lore-tab-glow);
}
.${ROOT_CLASS}__body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.${ROOT_CLASS}__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid #1e293b;
  background: rgba(15, 23, 42, 0.78);
}
.${ROOT_CLASS}__sec-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(30, 41, 59, 0.85);
}
.${ROOT_CLASS}__sec-title-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.${ROOT_CLASS}__sec-badge {
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--lore-badge-border);
  background: var(--lore-badge-bg);
  color: var(--lore-badge-text);
  font-size: 11px;
  font-weight: 700;
}
.${ROOT_CLASS}__sec-title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: #f8fafc;
}
.${ROOT_CLASS}__sec-sub {
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
}
.${ROOT_CLASS}__paragraphs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  line-height: 1.7;
  color: #cbd5e1;
}
.${ROOT_CLASS}__paragraphs p {
  margin: 0;
}
.${ROOT_CLASS}__table-wrap {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid #1e293b;
}
.${ROOT_CLASS}__table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
  color: #cbd5e1;
}
.${ROOT_CLASS}__table thead {
  background: rgba(30, 41, 59, 0.92);
  color: #e2e8f0;
  font-size: 12px;
  font-weight: 700;
}
.${ROOT_CLASS}__table th {
  padding: 10px 14px;
  border-bottom: 1px solid #334155;
}
.${ROOT_CLASS}__table td {
  padding: 9px 14px;
  border-bottom: 1px solid rgba(30, 41, 59, 0.7);
  background: rgba(2, 6, 23, 0.4);
  line-height: 1.5;
}
.${ROOT_CLASS}__table td:first-child {
  font-weight: 700;
  color: #e2e8f0;
  white-space: nowrap;
}
.${ROOT_CLASS}__bullets {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  line-height: 1.65;
  color: #cbd5e1;
}
.${ROOT_CLASS}__bullet {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.${ROOT_CLASS}__dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  margin-top: 9px;
  border-radius: 50%;
  background: var(--lore-badge-text);
}
.${ROOT_CLASS}__sakurai {
  margin-top: 4px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--lore-sakurai-border);
  background: var(--lore-sakurai-bg);
}
.${ROOT_CLASS}__sakurai-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 800;
  color: #fcd34d;
  letter-spacing: 0.03em;
}
.${ROOT_CLASS}__sakurai-text {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.7;
  color: rgba(254, 243, 199, 0.92);
  font-style: italic;
}
.${ROOT_CLASS}__footer {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 22px;
  border-top: 1px solid #1e293b;
  background: rgba(15, 23, 42, 0.7);
  font-size: 12px;
  color: #94a3b8;
}
.${ROOT_CLASS}__hint {
  display: flex;
  align-items: center;
  gap: 6px;
}
.${ROOT_CLASS}__switch {
  min-height: 44px;
  padding: 8px 14px;
  border-radius: 12px;
  border: 1px solid #334155;
  background: rgba(30, 41, 59, 0.85);
  color: #e2e8f0;
  font: 700 13px/1 inherit;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease;
}
.${ROOT_CLASS}__switch:hover {
  background: #334155;
}
.clubhouse-lore-trigger {
  min-height: 44px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.82);
  color: #e2e8f0;
  font: 700 13px/1.2 "Noto Sans TC", "PingFang TC", system-ui, sans-serif;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.clubhouse-lore-trigger:hover {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(248, 250, 252, 0.55);
  color: #ffffff;
}
@media (max-width: 600px) {
  .${ROOT_CLASS}__header { padding: 14px 16px; }
  .${ROOT_CLASS}__title { font-size: 18px; }
  .${ROOT_CLASS}__tabs { padding: 8px 16px 0; }
  .${ROOT_CLASS}__body { padding: 14px 16px; }
  .${ROOT_CLASS}__footer { padding: 10px 16px; }
  .${ROOT_CLASS}__kbd--desktop { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .${ROOT_CLASS} { animation: none; }
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

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderSectionNode(section: LoreSection): HTMLElement {
  const article = el('article', `${ROOT_CLASS}__section`);

  const head = el('header', `${ROOT_CLASS}__sec-head`);
  const titleWrap = el('div', `${ROOT_CLASS}__sec-title-wrap`);
  if (section.badge) {
    titleWrap.appendChild(el('span', `${ROOT_CLASS}__sec-badge`, section.badge));
  }
  titleWrap.appendChild(el('h3', `${ROOT_CLASS}__sec-title`, section.title));
  head.appendChild(titleWrap);
  if (section.subtitle) {
    head.appendChild(el('span', `${ROOT_CLASS}__sec-sub`, section.subtitle));
  }
  article.appendChild(head);

  if (section.content) {
    const paragraphs = el('div', `${ROOT_CLASS}__paragraphs`);
    const items = Array.isArray(section.content) ? section.content : [section.content];
    for (const text of items) {
      paragraphs.appendChild(el('p', undefined, text));
    }
    article.appendChild(paragraphs);
  }

  if (section.table) {
    const tableWrap = el('div', `${ROOT_CLASS}__table-wrap`);
    const table = document.createElement('table');
    table.className = `${ROOT_CLASS}__table`;
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const h of section.table.headers) {
      const th = document.createElement('th');
      th.textContent = h;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of section.table.rows) {
      const tr = document.createElement('tr');
      for (const cell of row) {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    article.appendChild(tableWrap);
  }

  if (section.bullets && section.bullets.length > 0) {
    const ul = el('ul', `${ROOT_CLASS}__bullets`);
    for (const bullet of section.bullets) {
      const li = el('li', `${ROOT_CLASS}__bullet`);
      li.appendChild(el('span', `${ROOT_CLASS}__dot`));
      li.appendChild(el('span', undefined, bullet));
      ul.appendChild(li);
    }
    article.appendChild(ul);
  }

  if (section.sakuraiTip) {
    const tip = el('div', `${ROOT_CLASS}__sakurai`);
    const tipHead = el('div', `${ROOT_CLASS}__sakurai-head`);
    const icon = el('span', undefined, '💡');
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', '心法');
    tipHead.appendChild(icon);
    tipHead.appendChild(el('span', undefined, '櫻井政博決策心法 · Risk vs. Reward'));
    tip.appendChild(tipHead);
    tip.appendChild(el('p', `${ROOT_CLASS}__sakurai-text`, section.sakuraiTip));
    article.appendChild(tip);
  }

  return article;
}

export function openOriginLoreModal(options: OriginLoreModalOptions): OriginLoreModalHandle {
  ensureStyles();

  // Close any existing lore modal so rapid clicks never stack duplicate dialogs.
  const existing = document.querySelector<HTMLElement>(`[data-clubhouse-lore-modal="1"]`);
  if (existing) existing.remove();

  const { dossier, initialTab = 'origin', onClose, parent = document.body, extraTab } = options;
  const theme = THEME_TOKENS[dossier.themeColor] ?? THEME_TOKENS.amber;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const root = el('div', ROOT_CLASS);
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'clubhouse-origin-lore-title');
  root.setAttribute('data-clubhouse-lore-modal', '1');
  root.style.setProperty('--lore-border', theme.border);
  root.style.setProperty('--lore-glow', theme.glow);
  root.style.setProperty('--lore-badge-bg', theme.badgeBg);
  root.style.setProperty('--lore-badge-border', theme.badgeBorder);
  root.style.setProperty('--lore-badge-text', theme.badgeText);
  root.style.setProperty('--lore-tab-bg', theme.tabBg);
  root.style.setProperty('--lore-tab-border', theme.tabBorder);
  root.style.setProperty('--lore-tab-text', theme.tabText);
  root.style.setProperty('--lore-tab-glow', theme.tabGlow);
  root.style.setProperty('--lore-sakurai-border', theme.sakuraiBorder);
  root.style.setProperty('--lore-sakurai-bg', theme.sakuraiBg);

  const dialog = el('div', `${ROOT_CLASS}__dialog`);
  dialog.addEventListener('click', (e) => e.stopPropagation());

  // Header
  const header = el('header', `${ROOT_CLASS}__header`);
  const headerMeta = el('div', `${ROOT_CLASS}__header-meta`);
  headerMeta.appendChild(el('span', `${ROOT_CLASS}__badge`, dossier.badge));
  const titleEl = el('h2', `${ROOT_CLASS}__title`, dossier.gameTitle);
  titleEl.id = 'clubhouse-origin-lore-title';
  headerMeta.appendChild(titleEl);
  headerMeta.appendChild(el('p', `${ROOT_CLASS}__subtitle`, dossier.gameSubtitle));
  header.appendChild(headerMeta);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = `${ROOT_CLASS}__close`;
  closeBtn.setAttribute('aria-label', '關閉圖鑑 (Esc)');
  closeBtn.appendChild(el('span', undefined, '關閉'));
  closeBtn.appendChild(el('kbd', `${ROOT_CLASS}__kbd ${ROOT_CLASS}__kbd--desktop`, 'Esc'));
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  // Tab bar
  const tabBar = el('div', `${ROOT_CLASS}__tabs`);
  tabBar.setAttribute('role', 'tablist');
  tabBar.setAttribute('aria-label', '圖鑑切換');

  const tabButtons = new Map<string, HTMLButtonElement>();
  const makeTab = (id: string, icon: string, label: string): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `${ROOT_CLASS}__tab`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.appendChild(el('span', undefined, icon));
    btn.appendChild(el('span', undefined, label));
    tabBar.appendChild(btn);
    tabButtons.set(id, btn);
    return btn;
  };

  makeTab('origin', '📜', '文化源流');
  makeTab('rules', '⚔️', '玩法圖解與決策心法');
  if (extraTab) {
    makeTab(extraTab.id, '⚙️', extraTab.label);
  }
  dialog.appendChild(tabBar);

  // Body
  const body = el('div', `${ROOT_CLASS}__body`);
  dialog.appendChild(body);

  // Footer
  const footer = el('footer', `${ROOT_CLASS}__footer`);
  const hint = el('div', `${ROOT_CLASS}__hint`);
  hint.appendChild(el('span', undefined, '💡 提示：使用'));
  hint.appendChild(el('kbd', `${ROOT_CLASS}__kbd`, 'Esc'));
  hint.appendChild(el('span', undefined, '鍵可隨時關閉本面板'));
  footer.appendChild(hint);

  const switchBtn = document.createElement('button');
  switchBtn.type = 'button';
  switchBtn.className = `${ROOT_CLASS}__switch`;
  footer.appendChild(switchBtn);
  dialog.appendChild(footer);

  root.appendChild(dialog);

  let activeTab = initialTab;
  let closed = false;

  const setTab = (tab: string): void => {
    activeTab = tab;
    for (const [id, btn] of tabButtons) {
      btn.setAttribute('aria-selected', id === activeTab ? 'true' : 'false');
    }
    body.replaceChildren();
    body.scrollTop = 0;

    if (activeTab === 'origin') {
      for (const sec of dossier.culturalOrigin.sections) {
        body.appendChild(renderSectionNode(sec));
      }
      switchBtn.textContent = '查看玩法圖解 ➔';
    } else if (activeTab === 'rules') {
      for (const sec of dossier.rulesAndStrategy.sections) {
        body.appendChild(renderSectionNode(sec));
      }
      switchBtn.textContent = '查看文化源流 ➔';
    } else if (extraTab && activeTab === extraTab.id) {
      extraTab.render(body);
      switchBtn.textContent = '查看文化源流 ➔';
    }
  };

  for (const [id, btn] of tabButtons) {
    btn.addEventListener('click', () => setTab(id));
  }

  switchBtn.addEventListener('click', () => {
    setTab(activeTab === 'origin' ? 'rules' : 'origin');
  });

  const close = (): void => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', handleKeyDown, true);
    root.remove();
    if (previousFocus && previousFocus.isConnected) {
      previousFocus.focus();
    }
    onClose?.();
  };

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  };

  // Capture phase prevents underlying game key handlers from also reacting to Escape.
  window.addEventListener('keydown', handleKeyDown, true);
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });
  closeBtn.addEventListener('click', close);

  setTab(initialTab);
  parent.appendChild(root);
  closeBtn.focus();

  return {
    root,
    setTab,
    close,
  };
}

export function createOriginLoreTrigger(options: MountOriginLoreTriggerOptions): HTMLButtonElement {
  ensureStyles();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = options.buttonClass ?? 'clubhouse-lore-trigger';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-label', options.ariaLabel ?? options.label ?? '文化源流與玩法圖鑑');
  btn.style.minHeight = '44px';
  btn.style.touchAction = 'manipulation';

  const icon = options.icon ?? '📜';
  const label = options.label ?? '文化源流與玩法圖鑑';
  btn.textContent = `${icon} ${label}`;

  btn.addEventListener('click', () => {
    options.onOpen?.();
    openOriginLoreModal({
      dossier: options.dossier,
      initialTab: options.initialTab,
      onClose: options.onClose,
    });
  });

  return btn;
}

export function mountOriginLoreTrigger(
  target: HTMLElement,
  options: MountOriginLoreTriggerOptions,
): HTMLButtonElement {
  const btn = createOriginLoreTrigger(options);
  target.appendChild(btn);
  return btn;
}
