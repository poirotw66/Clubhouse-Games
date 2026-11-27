import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOCKWORK_KEEP_LORE,
  COIN_CASCADE_LORE,
  DIALED_COLOR_LORE,
  EVERY_CORNER_LORE,
  INSTANT_FLASH_LORE,
  MEMORY_MATCH_LORE,
  PUZZLE_STRATEGY_LORE_DOSSIERS,
  TETRIS_LORE,
} from './puzzleStrategy.ts';

// Strictly unambiguous Simplified-only characters that must never appear in Traditional Chinese UI copy.
const UNAMBIGUOUS_SIMPLIFIED_CHARS = [
  '这', '样', '个', '为', '时', '后', '发', '对', '关', '门',
  '点', '红', '头', '马', '鸟', '鱼', '叶', '机', '图', '戏',
  '规', '则', '罗', '体', '双', '变', '听', '极', '获', '总',
  '历', '两', '单', '结', '组', '线', '网', '连', '转', '换',
  '标', '准', '难', '简', '复', '稳', '错', '误', '轮', '盘',
  '齿', '锤', '飞', '剑', '击', '杀', '伤', '护', '铁',
  '铜', '银', '钟', '长', '宽', '强', '远', '电', '响', '热',
  '风', '挤', '跃', '张', '种', '类', '态', '条', '务', '阶',
  '层', '场', '倾', '圆', '块', '竖', '纵', '环', '链', '锁',
  '导', '摆', '销', '还', '预', '览', '灵', '胜', '负', '败',
  '奖', '励', '币', '钱', '价', '资', '满', '区', '范', '围',
  '边', '构', '给', '维', '统', '经', '练', '习', '绿', '蓝',
  '黄', '脑', '实', '战', '敌', '军', '阵', '势', '数', '计',
  '试', '验', '证', '调', '记', '认', '设', '书', '画', '写',
  '语', '读', '说', '话', '请', '让', '进', '达', '选', '运',
  '动', '间', '开', '问', '题', '学', '觉', '见', '观', '视',
  '从', '无', '会', '们', '与', '万', '亿', '么', '仅',
  '仓', '仪', '优', '传', '伪', '侠', '侣', '侦', '侧', '侨',
  '俭', '债', '储', '儿', '党', '兰', '兴', '养', '兽', '冈',
  '决', '况', '冻', '净', '减', '几', '凤', '凭', '凯', '凿',
  '划', '刘', '创', '删', '别', '剂', '剧', '劝', '办', '劲',
  '劳', '勋', '压', '厌', '厅', '厕', '厢', '厦', '厨', '县',
  '参', '叠', '号', '叹', '吓', '吕', '吗', '吨',
];

const EXPECTED_DOSSIERS = [
  CLOCKWORK_KEEP_LORE,
  COIN_CASCADE_LORE,
  DIALED_COLOR_LORE,
  EVERY_CORNER_LORE,
  INSTANT_FLASH_LORE,
  MEMORY_MATCH_LORE,
  TETRIS_LORE,
];

test('all 7 puzzle/strategy dossiers are exported with unique gameIds and complete structure', () => {
  const expectedIds = [
    'clockwork-keep',
    'coin-cascade',
    'dialed-color',
    'every-corner',
    'instant-flash',
    'memory-match',
    'tetris',
  ];

  assert.equal(EXPECTED_DOSSIERS.length, 7);
  assert.equal(Object.keys(PUZZLE_STRATEGY_LORE_DOSSIERS).length, 7);

  const seenIds = new Set<string>();
  for (const dossier of EXPECTED_DOSSIERS) {
    assert.ok(!seenIds.has(dossier.gameId), `Duplicate gameId: ${dossier.gameId}`);
    seenIds.add(dossier.gameId);
    assert.strictEqual(PUZZLE_STRATEGY_LORE_DOSSIERS[dossier.gameId], dossier);
    assert.ok(dossier.gameTitle.length > 0);
    assert.ok(dossier.gameSubtitle.length > 0);
    assert.ok(
      dossier.culturalOrigin.sections.length >= 2,
      `${dossier.gameId} must have >= 2 culturalOrigin sections`
    );
    assert.ok(
      dossier.rulesAndStrategy.sections.length >= 2,
      `${dossier.gameId} must have >= 2 rulesAndStrategy sections`
    );

    const hasSakuraiTip = dossier.rulesAndStrategy.sections.some(
      (sec) => typeof sec.sakuraiTip === 'string' && sec.sakuraiTip.trim().length > 10
    );
    assert.ok(hasSakuraiTip, `${dossier.gameId} must have a Sakurai strategy tip > 10 chars`);
  }

  for (const id of expectedIds) {
    assert.ok(seenIds.has(id), `Missing expected dossier gameId: ${id}`);
  }
});

test('dossiers ground each game cultural origin and key mechanics', () => {
  assert.match(JSON.stringify(CLOCKWORK_KEEP_LORE), /塔就是牆/);
  assert.match(JSON.stringify(CLOCKWORK_KEEP_LORE), /Rampart/);
  assert.match(JSON.stringify(CLOCKWORK_KEEP_LORE), /發條弩台/);

  assert.match(JSON.stringify(COIN_CASCADE_LORE), /Medal Game|Penny Falls/);
  assert.match(JSON.stringify(COIN_CASCADE_LORE), /沒掉下去的幣/);
  assert.match(JSON.stringify(COIN_CASCADE_LORE), /狂熱超頻/);

  assert.match(JSON.stringify(DIALED_COLOR_LORE), /孟塞爾|Munsell/);
  assert.match(JSON.stringify(DIALED_COLOR_LORE), /GF\(2\)/);
  assert.match(JSON.stringify(DIALED_COLOR_LORE), /999/);

  assert.match(JSON.stringify(EVERY_CORNER_LORE), /漢密爾頓|Hamiltonian/);
  assert.match(JSON.stringify(EVERY_CORNER_LORE), /歐拉|Euler/);
  assert.match(JSON.stringify(EVERY_CORNER_LORE), /奇偶/);

  assert.match(JSON.stringify(INSTANT_FLASH_LORE), /居合/);
  assert.match(JSON.stringify(INSTANT_FLASH_LORE), /佯攻/);
  assert.match(JSON.stringify(INSTANT_FLASH_LORE), /中立格擋/);

  assert.match(JSON.stringify(MEMORY_MATCH_LORE), /Pelmanism|佩爾曼/);
  assert.match(JSON.stringify(MEMORY_MATCH_LORE), /神經衰弱/);
  assert.match(JSON.stringify(MEMORY_MATCH_LORE), /米勒|7 ± 2/);

  assert.match(JSON.stringify(TETRIS_LORE), /Pajitnov|帕基特諾夫/);
  assert.match(JSON.stringify(TETRIS_LORE), /7-Bag/);
  assert.match(JSON.stringify(TETRIS_LORE), /T-Spin/);
});

test('strictly zero Simplified Chinese characters across all puzzle/strategy dossiers', () => {
  for (const [id, dossier] of Object.entries(PUZZLE_STRATEGY_LORE_DOSSIERS)) {
    const raw = JSON.stringify(dossier);
    for (const sc of UNAMBIGUOUS_SIMPLIFIED_CHARS) {
      assert.ok(
        !raw.includes(sc),
        `Found forbidden Simplified Chinese character "${sc}" in ${id} dossier!`
      );
    }
  }
});
