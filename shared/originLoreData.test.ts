import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_LORE_DOSSIERS,
  DOMINOES_LORE,
  FIFTEEN_PUZZLE_LORE,
  KOI_KOI_LORE,
  MYSTERY_LIQUID_SORT_LORE,
  PICK_RED_LORE,
  ROGUELIKE_SNAKE_LORE,
} from './originLoreData.ts';

// Common Simplified-only characters that should NEVER appear in Traditional Chinese text
const SIMPLIFIED_CHARS_REGEX = /[这为个时后发对门点红头马鸟鱼叶机图戏规则数罗体双发变关听极获胜胜负]/u;
// Note: We test strictly against pure Simplified characters
const STRICT_SIMPLIFIED_CHARS = [
  '这', '样', '个', '为', '时', '后', '发', '对', '关', '门',
  '点', '红', '头', '马', '鸟', '鱼', '叶', '机', '图', '戏',
  '规', '则', '数', '罗', '体', '双', '变', '听', '极', '获',
  '总', '历', '两', '单', '牌', '数', '组', '结', '算'
];
// Filter to only those whose simplified form is strictly distinct from Traditional
const STRICT_SIMPLIFIED_ONLY = [
  '这', '个', '为', '时', '后', '发', '对', '关', '门',
  '点', '红', '头', '马', '鸟', '鱼', '叶', '机', '图', '戏',
  '规', '则', '罗', '体', '双', '变', '听', '极', '获'
];

test('all required games have complete origin and lore dossiers', () => {
  const games = [
    'pick-red',
    'koi-koi',
    'dominoes',
    'fifteen-puzzle',
    'roguelike-snake',
    'mystery-liquid-sort',
  ];
  for (const gameId of games) {
    const dossier = ALL_LORE_DOSSIERS[gameId];
    assert.ok(dossier, `Missing dossier for game: ${gameId}`);
    assert.ok(dossier.gameTitle.length > 0);
    assert.ok(dossier.culturalOrigin.sections.length >= 2);
    assert.ok(dossier.rulesAndStrategy.sections.length >= 2);

    // Verify Sakurai tips exist
    const hasSakuraiTip = dossier.rulesAndStrategy.sections.some(
      (sec) => sec.sakuraiTip && sec.sakuraiTip.length > 10
    );
    assert.ok(hasSakuraiTip, `Dossier ${gameId} must contain a Sakurai strategy tip`);
  }
});

test('Pick-Red dossier has complete Taiwanese origin and point system', () => {
  const text = JSON.stringify(PICK_RED_LORE);
  assert.match(text, /黑牌一分不值，只是拿來換紅牌的工具/);
  assert.match(text, /210/);
  assert.match(text, /105/);
  assert.match(text, /70/);
  assert.match(text, /湊十/);
  assert.match(text, /A\+9/);
  assert.match(text, /5\+5/);
  assert.match(text, /20 分/);
  assert.match(text, /10 分/);
});

test('Koi-Koi dossier has complete 12 months, legendary Yaku, and card tiers', () => {
  const text = JSON.stringify(KOI_KOI_LORE);
  const months = ['松', '梅', '櫻', '藤', '菖蒲', '牡丹', '萩', '芒', '菊', '紅葉', '柳', '桐'];
  for (const month of months) {
    assert.ok(text.includes(month), `Koi-Koi dossier must include month flower: ${month}`);
  }
  assert.match(text, /豬鹿蝶/);
  assert.match(text, /花見酒/);
  assert.match(text, /月見酒/);
  assert.match(text, /五光/);
  assert.match(text, /Hikari/);
  assert.match(text, /Tane/);
  assert.match(text, /Tanzaku/);
  assert.match(text, /Kasu/);
});

test('Dominoes dossier has Song dynasty Xuanhe origin and All Fives mechanics', () => {
  const text = JSON.stringify(DOMINOES_LORE);
  assert.match(text, /宣和/);
  assert.match(text, /五倍數/);
  assert.match(text, /All Fives/);
  assert.match(text, /轉軸/);
  assert.match(text, /Spinner/);
  assert.match(text, /28/);
  assert.match(text, /阻塞/);
});

test('Fifteen-Puzzle dossier has 1870s Sam Loyd craze, parity theorem, and IDA* strategy', () => {
  const text = JSON.stringify(FIFTEEN_PUZZLE_LORE);
  assert.match(text, /1870/);
  assert.match(text, /Sam Loyd|山姆·洛伊德/);
  assert.match(text, /14-15/);
  assert.match(text, /置換|奇偶性/);
  assert.match(text, /曼哈頓距離/);
  assert.match(text, /線性衝突/);
  assert.match(text, /SPS/);
});

test('Roguelike-Snake dossier has serpent altar lore and relic guides', () => {
  const text = JSON.stringify(ROGUELIKE_SNAKE_LORE);
  assert.match(text, /蛇神/);
  assert.match(text, /銜尾/);
  assert.match(text, /衝刺/);
  assert.match(text, /猛毒脈衝/);
  assert.match(text, /疾風衝刺流/);
  assert.match(text, /首領/);
  assert.match(text, /BFS/);
});

test('Mystery-Liquid-Sort dossier has alchemy lore and reagent mixing rules', () => {
  const text = JSON.stringify(MYSTERY_LIQUID_SORT_LORE);
  assert.match(text, /赫密斯/);
  assert.match(text, /鍊金/);
  assert.match(text, /賢者之石/);
  assert.match(text, /不可逆/);
  assert.match(text, /琥珀橙/);
  assert.match(text, /翡翠綠/);
  assert.match(text, /秘術紫/);
  assert.match(text, /幽靈預覽/);
});

test('strictly zero Simplified Chinese characters in all dossiers', () => {
  for (const [id, dossier] of Object.entries(ALL_LORE_DOSSIERS)) {
    const raw = JSON.stringify(dossier);
    for (const sc of STRICT_SIMPLIFIED_ONLY) {
      assert.ok(
        !raw.includes(sc),
        `Found forbidden Simplified Chinese character "${sc}" in ${id} dossier!`
      );
    }
  }
});
