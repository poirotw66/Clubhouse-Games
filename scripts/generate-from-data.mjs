#!/usr/bin/env node
/**
 * Generate index.html games menu and README.md checklist from data/games.json.
 * Run after editing data/games.json so menu and README stay in sync.
 * Usage: node scripts/generate-from-data.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const DATA_PATH = path.join(root, 'data', 'games.json');
const INDEX_PATH = path.join(root, 'index.html');
const README_PATH = path.join(root, 'README.md');

const CATEGORY_SVG = {
  cards: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  board: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  tiles: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
  sports: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
  puzzle: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z',
  minigames: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 010-4V7a2 2 0 00-2-2H5z',
};

const DEFAULT_ACCENT = '#a78bfa';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function categoryIconSvg(categoryId) {
  const svgContent = CATEGORY_SVG[categoryId] ?? '';
  return svgContent.startsWith('<path')
    ? svgContent
    : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${svgContent}" />`;
}

function categoryShortLabel(title) {
  const short = title.replace(/^\d+\s+/, '').replace(/類型$/, '');
  const aliases = {
    運動機檯: '運動',
    串聯拼砌: '益智',
    迷你遊戲: '迷你',
  };
  return aliases[short] ?? short;
}

/** Filter buttons: an "all" pill plus one per category. */
function generateCategoryNavHtml(categories) {
  const total = categories.reduce((sum, cat) => sum + cat.games.length, 0);
  const all = `        <button type="button" class="filter-pill is-active" data-filter="all" aria-pressed="true">
          全部<span class="filter-pill-count">${total}</span>
        </button>`;
  const rest = categories.map(
    (cat) =>
      `        <button type="button" class="filter-pill" data-filter="${escapeHtml(cat.id)}" aria-pressed="false" style="--accent: ${escapeHtml(cat.accent ?? DEFAULT_ACCENT)}">
          ${escapeHtml(categoryShortLabel(cat.title))}<span class="filter-pill-count">${cat.games.length}</span>
        </button>`
  );
  return [all, ...rest].join('\n');
}

function generateMenuHtml(categories) {
  const out = [];
  for (const cat of categories) {
    const accent = cat.accent ?? DEFAULT_ACCENT;
    const shortLabel = categoryShortLabel(cat.title);
    out.push(`      <section class="game-group" id="${escapeHtml(cat.htmlId)}" data-category="${escapeHtml(cat.id)}" style="--accent: ${escapeHtml(accent)}" aria-labelledby="${escapeHtml(cat.htmlId)}-title">
        <div class="group-head">
          <span class="group-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${categoryIconSvg(cat.id)}</svg>
          </span>
          <h2 class="group-title font-tc" id="${escapeHtml(cat.htmlId)}-title">${escapeHtml(cat.title)}</h2>
          <span class="group-count" aria-label="共 ${cat.games.length} 款遊戲">${cat.games.length}</span>
        </div>
        <ul class="game-grid" role="list">`);

    for (const game of cat.games) {
      const hasPlay = !!game.gameFolder;
      const searchTerms = [
        game.name,
        game.en,
        shortLabel,
        game.gameFolder,
        game.specPath.split('/').pop()?.replace('.md', ''),
      ]
        .filter(Boolean)
        .join(' ');

      const action = hasPlay
        ? `<a href="Games/${escapeHtml(game.gameFolder)}/" class="tile-play" data-game="${escapeHtml(game.name)}">
                進入遊戲
                <svg class="tile-play-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5-5 5M6 12h12" /></svg>
                <span class="sr-only">：${escapeHtml(game.name)}</span>
              </a>`
        : '<span class="tile-play is-disabled">尚未實作</span>';

      const players = game.players
        ? `<span class="tile-players font-tc" aria-label="遊玩人數 ${escapeHtml(game.players)}">${escapeHtml(game.players)}</span>`
        : '';

      out.push(`          <li class="game-tile${hasPlay ? '' : ' is-todo'}" data-search="${escapeHtml(searchTerms)}" data-name="${escapeHtml(game.name)}"${hasPlay ? ` data-folder="${escapeHtml(game.gameFolder)}"` : ''}>
            <div class="tile-head">
              <span class="tile-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${categoryIconSvg(cat.id)}</svg>
              </span>
              <div class="tile-titles">
                <h3 class="tile-name font-tc">${escapeHtml(game.name)}</h3>
                ${game.en ? `<p class="tile-en">${escapeHtml(game.en)}</p>` : ''}
              </div>
              ${players}
            </div>
            ${game.desc ? `<p class="tile-desc font-tc">${escapeHtml(game.desc)}</p>` : ''}
            <div class="tile-foot">
              ${action}
              <a href="${escapeHtml(game.specPath)}" class="tile-spec">規格<span class="sr-only">：${escapeHtml(game.name)}</span></a>
            </div>
          </li>`);
    }
    out.push('        </ul>\n      </section>');
  }
  return out.join('\n\n');
}

function generateReadmeTable(categories) {
  const rows = categories.map((c) => {
    const folder = c.id === 'cards' ? '01-cards' : c.id === 'board' ? '02-board' : c.id === 'tiles' ? '03-tiles-dice' : c.id === 'sports' ? '04-sports-arcade' : c.id === 'puzzle' ? '05-puzzle' : '06-minigames';
    const label = c.title.replace(/^\d+\s+/, '');
    return `| ${label} | [${folder}/](${folder}/) | ${c.games.length} |`;
  });
  return [
    '| 類別 | 資料夾 | 遊戲數 |',
    '|------|--------|--------|',
    ...rows,
    '',
  ].join('\n');
}

function generateReadmeChecklist(categories) {
  const out = [];
  for (const cat of categories) {
    out.push(`## ${cat.readmeTitle}`);
    for (const game of cat.games) {
      const done = game.gameFolder ? 'x' : ' ';
      const playPart = game.gameFolder ? ` → [Games/${game.gameFolder}/](Games/${game.gameFolder}/)` : '';
      out.push(`- [${done}] [${game.name}](${game.specPath})${playPart}`);
    }
    out.push('');
  }
  return out.join('\n');
}

function replaceBetween(content, startMark, endMark, replacement) {
  const start = content.indexOf(startMark);
  const end = content.indexOf(endMark);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Markers not found or invalid: ${startMark} / ${endMark}`);
  }
  return content.slice(0, start + startMark.length) + '\n' + replacement + '\n' + content.slice(end);
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const categories = data.categories;

const menuHtml = generateMenuHtml(categories);
const categoryNavHtml = generateCategoryNavHtml(categories);
const totalGames = categories.reduce((sum, cat) => sum + cat.games.length, 0);

let indexContent = fs.readFileSync(INDEX_PATH, 'utf8');
indexContent = replaceBetween(indexContent, '    <!-- GENERATED_GAMES_MENU -->', '    <!-- /GENERATED_GAMES_MENU -->', menuHtml);
indexContent = replaceBetween(indexContent, '        <!-- GENERATED_CATEGORY_NAV -->', '        <!-- /GENERATED_CATEGORY_NAV -->', categoryNavHtml);
// Keep the no-JS stat counts truthful even before menu.js runs.
indexContent = indexContent
  .replace(/(id="game-count-stat"[^>]*>)[^<]*/, `$1${totalGames}`)
  .replace(/(id="category-count-stat"[^>]*>)[^<]*/, `$1${categories.length}`);
fs.writeFileSync(INDEX_PATH, indexContent);
console.log('Updated index.html');

const tableMd = generateReadmeTable(categories);
const checklistMd = generateReadmeChecklist(categories);
let readmeContent = fs.readFileSync(README_PATH, 'utf8');
readmeContent = replaceBetween(readmeContent, '<!-- GENERATED_TABLE -->', '<!-- /GENERATED_TABLE -->', tableMd.trim());
readmeContent = replaceBetween(readmeContent, '<!-- GENERATED_GAMES_CHECKLIST -->', '<!-- /GENERATED_GAMES_CHECKLIST -->', checklistMd.trim());
fs.writeFileSync(README_PATH, readmeContent);
console.log('Updated README.md');
