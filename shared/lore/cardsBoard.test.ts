import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BIG_TWO_LORE,
  BLACKJACK_LORE,
  CARDS_BOARD_LORE_DOSSIERS,
  CHECKERS_LORE,
  CONNECT_FOUR_LORE,
  FREECELL_LORE,
  KLONDIKE_LORE,
  REVERSI_LORE,
} from './cardsBoard.ts';

// Strictly Simplified-only characters that must never appear in Traditional Chinese UI copy.
const STRICT_SIMPLIFIED_ONLY = [
  '这', '个', '为', '时', '后', '发', '对', '关', '门',
  '点', '红', '头', '马', '鸟', '鱼', '叶', '机', '图', '戏',
  '规', '则', '罗', '体', '双', '变', '听', '极', '获',
  '实', '现', '战', '术', '胜', '负', '张', '数', '组', '结',
  '总', '历', '两', '单', '连', '环', '筹', '码', '庄', '赔',
  '选', '择', '开', '盘', '线', '边', '稳', '进', '击', '杀',
  '围', '阵', '势', '运', '动', '态', '优', '险', '风', '难',
  '简', '复', '杂', '专', '业', '经', '传', '统', '华', '东',
  '亚', '欧', '国', '际', '标', '乐', '欢', '义', '论', '证',
  '绝', '无', '题', '谜', '达', '败', '输', '赢', '让', '给',
  '从', '还', '过', '间', '内', '与', '虽', '将', '样',
];

test('all 7 cards & board games have complete origin and lore dossiers with unique gameIds', () => {
  const expectedIds = [
    'big-two',
    'blackjack',
    'checkers',
    'connect-four',
    'freecell',
    'klondike',
    'reversi',
  ];

  const dossiers = [
    BIG_TWO_LORE,
    BLACKJACK_LORE,
    CHECKERS_LORE,
    CONNECT_FOUR_LORE,
    FREECELL_LORE,
    KLONDIKE_LORE,
    REVERSI_LORE,
  ];

  const seenIds = new Set<string>();
  for (const dossier of dossiers) {
    assert.ok(!seenIds.has(dossier.gameId), `Duplicate gameId: ${dossier.gameId}`);
    seenIds.add(dossier.gameId);
  }
  assert.equal(Object.keys(CARDS_BOARD_LORE_DOSSIERS).length, expectedIds.length);

  for (const gameId of expectedIds) {
    const dossier = CARDS_BOARD_LORE_DOSSIERS[gameId];
    assert.ok(dossier, `Missing dossier for game: ${gameId}`);
    assert.equal(dossier.gameId, gameId);
    assert.ok(dossier.gameTitle.length > 0, `${gameId} must have gameTitle`);
    assert.ok(dossier.gameSubtitle.length > 0, `${gameId} must have gameSubtitle`);
    assert.ok(
      dossier.culturalOrigin.sections.length >= 2,
      `${gameId} must have >= 2 culturalOrigin sections`
    );
    assert.ok(
      dossier.rulesAndStrategy.sections.length >= 2,
      `${gameId} must have >= 2 rulesAndStrategy sections`
    );

    const hasSakuraiTip = dossier.rulesAndStrategy.sections.some(
      (sec) => sec.sakuraiTip && sec.sakuraiTip.length > 10
    );
    assert.ok(hasSakuraiTip, `Dossier ${gameId} must contain a Sakurai strategy tip > 10 chars`);
  }
});

test('dossiers accurately reflect core design doc facts for each game', () => {
  const bigTwoText = JSON.stringify(BIG_TWO_LORE);
  assert.match(bigTwoText, /梅花 3/);
  assert.match(bigTwoText, /23456/);
  assert.match(bigTwoText, /10JQKA/);
  assert.match(bigTwoText, /同花順/);
  assert.match(bigTwoText, /頂大/);

  const blackjackText = JSON.stringify(BLACKJACK_LORE);
  assert.match(blackjackText, /Edward O\. Thorp|愛德華·索普/);
  assert.match(blackjackText, /Hi-Lo/);
  assert.match(blackjackText, /3:2/);
  assert.match(blackjackText, /H17/);
  assert.match(blackjackText, /S17/);

  const checkersText = JSON.stringify(CHECKERS_LORE);
  assert.match(checkersText, /Alquerque/);
  assert.match(checkersText, /Chinook/);
  assert.match(checkersText, /8×8/);
  assert.match(checkersText, /10×10/);
  assert.match(checkersText, /飛王/);

  const connectFourText = JSON.stringify(CONNECT_FOUR_LORE);
  assert.match(connectFourText, /1974/);
  assert.match(connectFourText, /PopOut/);
  assert.match(connectFourText, /7×6/);
  assert.match(connectFourText, /9×7/);
  assert.match(connectFourText, /奇偶/);

  const freecellText = JSON.stringify(FREECELL_LORE);
  assert.match(freecellText, /PLATO/);
  assert.match(freecellText, /11982/);
  assert.match(freecellText, /Supermove/);
  assert.match(freecellText, /2\^\(空列數\)/);

  const klondikeText = JSON.stringify(KLONDIKE_LORE);
  assert.match(klondikeText, /Wes Cherry/);
  assert.match(klondikeText, /維加斯/);
  assert.match(klondikeText, /-52|\-\$52/);
  assert.match(klondikeText, /翻 3/);

  const reversiText = JSON.stringify(REVERSI_LORE);
  assert.match(reversiText, /1883/);
  assert.match(reversiText, /長谷川五郎/);
  assert.match(reversiText, /Othello/);
  assert.match(reversiText, /Logistello/);
  assert.match(reversiText, /安定子/);
});

test('strictly zero Simplified Chinese characters in all cards & board dossiers', () => {
  for (const [id, dossier] of Object.entries(CARDS_BOARD_LORE_DOSSIERS)) {
    const raw = JSON.stringify(dossier);
    for (const sc of STRICT_SIMPLIFIED_ONLY) {
      assert.ok(
        !raw.includes(sc),
        `Found forbidden Simplified Chinese character "${sc}" in ${id} dossier!`
      );
    }
  }
});
