import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCK_THE_SMASH_LORE,
  CLIP_CLOP_LORE,
  PUYO_PUYO_LORE,
  SAILING_LORE,
  VANILLA_DOM_LORE_DOSSIERS,
  WALL_FLIP_LORE,
} from './vanillaDom.ts';

// Strictly Simplified-only characters (distinct from Traditional) that must NEVER appear.
const STRICT_SIMPLIFIED_ONLY = [
  '这', '个', '为', '时', '后', '发', '对', '关', '门',
  '点', '红', '头', '马', '鸟', '鱼', '叶', '机', '图', '戏',
  '规', '则', '罗', '体', '双', '变', '听', '极', '获',
  '风', '车', '飞', '气', '赛', '线', '轮', '墙', '冲', '阵',
  '战', '术', '达', '级', '胜', '负', '连', '锁', '选', '单',
  '设', '计', '验', '证', '软', '陆', '倾', '标', '环', '转',
  '跃', '击', '杀', '场', '伪', '装', '诱', '导', '稳', '阶',
  '习', '练', '难', '简', '乐', '声', '响', '专', '业', '统',
  '处', '动', '态', '状', '识', '别', '护', '御', '恶', '梦',
  '谜', '题', '务', '奖', '励', '纪', '录', '输', '显', '隐',
  '闭', '开', '启', '继', '续', '栏', '组', '数', '据',
  '库', '网', '络', '断', '错', '误', '详', '历', '来', '传',
  '经', '现', '艺', '险', '报', '优', '节', '压', '湾',
  '调', '键', '触', '游', '总', '两', '结',
];

test('all 5 vanilla DOM games have complete lore dossiers', () => {
  const expectedIds = [
    'block-the-smash',
    'clip-clop',
    'puyo-puyo',
    'sailing',
    'wall-flip',
  ];

  for (const gameId of expectedIds) {
    const dossier = VANILLA_DOM_LORE_DOSSIERS[gameId];
    assert.ok(dossier, `Missing dossier for game: ${gameId}`);
    assert.equal(dossier.gameId, gameId);
    assert.ok(dossier.gameTitle.length > 0);
    assert.ok(dossier.gameSubtitle.length > 0);
    assert.ok(dossier.badge.length > 0);
    assert.ok(dossier.culturalOrigin.sections.length >= 2, `${gameId} needs >= 2 culturalOrigin sections`);
    assert.ok(dossier.rulesAndStrategy.sections.length >= 2, `${gameId} needs >= 2 rulesAndStrategy sections`);

    const hasSakuraiTip = dossier.rulesAndStrategy.sections.some(
      (sec) => typeof sec.sakuraiTip === 'string' && sec.sakuraiTip.length > 10,
    );
    assert.ok(hasSakuraiTip, `Dossier ${gameId} must contain a Sakurai strategy tip (> 10 chars)`);
  }
});

test('named dossier exports match VANILLA_DOM_LORE_DOSSIERS map', () => {
  assert.strictEqual(VANILLA_DOM_LORE_DOSSIERS['block-the-smash'], BLOCK_THE_SMASH_LORE);
  assert.strictEqual(VANILLA_DOM_LORE_DOSSIERS['clip-clop'], CLIP_CLOP_LORE);
  assert.strictEqual(VANILLA_DOM_LORE_DOSSIERS['puyo-puyo'], PUYO_PUYO_LORE);
  assert.strictEqual(VANILLA_DOM_LORE_DOSSIERS['sailing'], SAILING_LORE);
  assert.strictEqual(VANILLA_DOM_LORE_DOSSIERS['wall-flip'], WALL_FLIP_LORE);
});

test('dossiers contain authentic game-specific lore and mechanics', () => {
  assert.match(JSON.stringify(BLOCK_THE_SMASH_LORE), /浦那/);
  assert.match(JSON.stringify(BLOCK_THE_SMASH_LORE), /直線殺/);
  assert.match(JSON.stringify(BLOCK_THE_SMASH_LORE), /切吊/);

  assert.match(JSON.stringify(CLIP_CLOP_LORE), /QWOP/);
  assert.match(JSON.stringify(CLIP_CLOP_LORE), /Q ＋ P/);
  assert.match(JSON.stringify(CLIP_CLOP_LORE), /W ＋ O/);

  assert.match(JSON.stringify(PUYO_PUYO_LORE), /Compile/);
  assert.match(JSON.stringify(PUYO_PUYO_LORE), /相殺/);
  assert.match(JSON.stringify(PUYO_PUYO_LORE), /70 分/);
  assert.match(JSON.stringify(PUYO_PUYO_LORE), /GTR/);

  assert.match(JSON.stringify(SAILING_LORE), /VMG/);
  assert.match(JSON.stringify(SAILING_LORE), /換舷/);
  assert.match(JSON.stringify(SAILING_LORE), /頂風死角/);

  assert.match(JSON.stringify(WALL_FLIP_LORE), /宙返りロードスター/);
  assert.match(JSON.stringify(WALL_FLIP_LORE), /壓縮空氣/);
  assert.match(JSON.stringify(WALL_FLIP_LORE), /18 km\/h/);
});

test('strictly zero Simplified Chinese characters in all vanilla DOM dossiers', () => {
  for (const [id, dossier] of Object.entries(VANILLA_DOM_LORE_DOSSIERS)) {
    const raw = JSON.stringify(dossier);
    for (const sc of STRICT_SIMPLIFIED_ONLY) {
      assert.ok(
        !raw.includes(sc),
        `Found forbidden Simplified Chinese character "${sc}" in ${id} dossier!`,
      );
    }
  }
});
