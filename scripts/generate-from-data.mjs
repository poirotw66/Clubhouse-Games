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

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function generateCategoryNavHtml(categories) {
  return categories
    .map(
      (cat) =>
        `        <a href="#${escapeHtml(cat.htmlId)}" class="category-pill">${escapeHtml(categoryShortLabel(cat.title))}</a>`
    )
    .join('\n');
}

function generateMenuHtml(categories) {
  const out = [];
  for (const cat of categories) {
    const svgContent = CATEGORY_SVG[cat.id] ?? '';
    const innerSvg = svgContent.startsWith('<path') ? svgContent : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${svgContent}" />`;
    out.push(`      <article class="game-card rounded-2xl border border-white/10 bg-dreamCard backdrop-blur-sm p-5 sm:p-6 lg:p-7" id="${escapeHtml(cat.htmlId)}" data-category="${escapeHtml(cat.id)}">
        <h2 class="flex items-center gap-2 text-secondary font-heading text-lg sm:text-xl mb-4 pb-2 border-b border-white/10">
          <svg class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">${innerSvg}</svg>
          <span class="font-tc">${escapeHtml(cat.title)}</span>
          <span class="category-count" aria-label="${cat.games.length} 款遊戲">${cat.games.length}</span>
        </h2>
        <ul class="space-y-1" role="list">`);
    for (const game of cat.games) {
      const hasPlay = !!game.gameFolder;
      const playLink = hasPlay
        ? `<a href="Games/${escapeHtml(game.gameFolder)}/" class="link-play cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cta focus-visible:ring-offset-2 focus-visible:ring-offset-dream rounded-lg">進入遊戲</a>`
        : '<span class="text-slate-500 text-sm font-tc">尚未實作</span>';
      const specLink = `<a href="${escapeHtml(game.specPath)}" class="link-spec cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-dream rounded">規格</a>`;
      const searchTerms = [game.name, game.gameFolder, game.specPath.split('/').pop()?.replace('.md', '')]
        .filter(Boolean)
        .join(' ');
      out.push(`          <li class="game-row" data-search="${escapeHtml(searchTerms)}">
            <span class="game-row-name">${escapeHtml(game.name)}</span>
            <span class="game-row-actions">
              ${specLink}
              ${playLink}
            </span>
          </li>`);
    }
    out.push('        </ul>\n      </article>');
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

// Fix sports SVG: it has two path elements
if (CATEGORY_SVG.sports.includes(' /><path ')) {
  // already split in the object
}
const menuHtml = generateMenuHtml(categories);
const categoryNavHtml = generateCategoryNavHtml(categories);

let indexContent = fs.readFileSync(INDEX_PATH, 'utf8');
indexContent = replaceBetween(indexContent, '    <!-- GENERATED_GAMES_MENU -->', '    <!-- /GENERATED_GAMES_MENU -->', menuHtml);
indexContent = replaceBetween(indexContent, '        <!-- GENERATED_CATEGORY_NAV -->', '        <!-- /GENERATED_CATEGORY_NAV -->', categoryNavHtml);
fs.writeFileSync(INDEX_PATH, indexContent);
console.log('Updated index.html');

const tableMd = generateReadmeTable(categories);
const checklistMd = generateReadmeChecklist(categories);
let readmeContent = fs.readFileSync(README_PATH, 'utf8');
readmeContent = replaceBetween(readmeContent, '<!-- GENERATED_TABLE -->', '<!-- /GENERATED_TABLE -->', tableMd.trim());
readmeContent = replaceBetween(readmeContent, '<!-- GENERATED_GAMES_CHECKLIST -->', '<!-- /GENERATED_GAMES_CHECKLIST -->', checklistMd.trim());
fs.writeFileSync(README_PATH, readmeContent);
console.log('Updated README.md');
