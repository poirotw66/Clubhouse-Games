import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASEBALL_LIFE_LORE,
  BRICK_KART_LORE,
  CYBER_NEON_RUSH_LORE,
  DANMAKU_ABYSS_LORE,
  DYNASTY_LORE,
  SPORTS_ARCADE_LORE_DOSSIERS,
  SWITCHPOINT_RUN_LORE,
  TOY_BASEBALL_LORE,
  TOY_BOXING_LORE,
} from './sportsArcade.ts';

// Strictly Simplified-only characters that must never appear in Traditional Chinese text.
const STRICT_SIMPLIFIED_ONLY = [
  '这', '样', '个', '为', '时', '后', '发', '对', '关', '门',
  '点', '红', '头', '马', '鸟', '鱼', '叶', '机', '图', '戏',
  '规', '则', '罗', '体', '双', '变', '听', '极', '获', '总',
  '历', '两', '单', '组', '结', '胜', '负', '赛', '车', '竞',
  '击', '场', '队', '员', '练', '选', '战', '弹', '线', '铁',
  '运', '转', '风', '险', '奖', '励', '实', '现', '进', '阶',
  '态', '标', '签', '记', '录', '数', '优', '统', '计', '划',
  '决', '断', '开', '启', '闭', '换', '装', '备', '级', '伤',
  '难', '简', '复', '杂', '错', '误', '连', '续', '终', '败',
  '输', '赢', '买', '卖', '钱', '资', '费', '税', '龄', '岁',
  '业', '职', '专', '挥', '挡', '闪', '钩', '护', '跃', '轨',
  '补', '给', '缓', '丰', '义', '乐', '书', '习', '乡', '乱',
  '争', '亏', '云', '亚', '产', '亲', '亿', '仅', '从', '仓',
  '仪', '们', '价', '众', '会', '传', '伦', '伪', '佣', '侠',
  '侣', '侦', '侧', '侨', '俩', '倾', '债', '储', '儿', '兑',
  '党', '兰', '兴', '养', '兽', '册', '军', '农', '况', '冻',
  '净', '减', '几', '凤', '凭', '凯', '刘', '创', '删', '剂',
  '剑', '劳', '势', '勋', '区', '医', '华', '协', '卢', '卫',
  '厂', '厅', '厉', '压', '厌', '厕', '厢', '县', '叹', '吓',
  '吕', '吗', '吧', '吴', '呜', '咏', '咱', '响', '让', '认',
  '设', '许', '评', '词', '试', '话', '语', '说', '调', '谈',
  '请', '谁', '课', '财', '责', '轮', '轻', '载',
  '较', '辅', '辆', '辈', '辉', '达', '违', '远', '适', '还',
  '邻', '郁', '郑', '酿', '释', '钟', '钢', '钦', '钻', '铃',
  '铅', '铜', '银', '铸', '铺', '链', '销', '锁', '锅', '锋',
  '锦', '键', '锻', '镇', '镜', '长', '问', '闲', '间', '闷',
  '闹', '闻', '阅', '阔', '陈', '陆', '阳', '阴', '阵',
  '际', '隐', '雾', '静', '页', '顶', '项', '顺', '须', '顽',
  '顾', '顿', '颁', '预', '领', '颇', '频', '颗', '题', '额',
  '颜', '飘', '飞', '饭', '饮', '饰', '饱', '饲', '饼', '馆',
  '驱', '驶', '骄', '验', '骑', '骗', '骚', '鲁', '鲜', '鸡',
  '鸣', '鸭', '鸿', '鹏', '鹤', '鹰', '麦', '黄', '齐', '齿',
  '龙', '龟',
];

const EXPECTED_EXPORTS = [
  ['baseball-life', BASEBALL_LIFE_LORE],
  ['brick-kart-racing', BRICK_KART_LORE],
  ['cyber-neon-rush', CYBER_NEON_RUSH_LORE],
  ['danmaku-abyss', DANMAKU_ABYSS_LORE],
  ['dynasty', DYNASTY_LORE],
  ['switchpoint-run', SWITCHPOINT_RUN_LORE],
  ['toy-baseball', TOY_BASEBALL_LORE],
  ['toy-boxing', TOY_BOXING_LORE],
] as const;

test('all 8 sports/arcade games have complete, unique lore dossiers', () => {
  const seenIds = new Set<string>();
  assert.equal(Object.keys(SPORTS_ARCADE_LORE_DOSSIERS).length, EXPECTED_EXPORTS.length);

  for (const [expectedId, exportedDossier] of EXPECTED_EXPORTS) {
    const dossier = SPORTS_ARCADE_LORE_DOSSIERS[expectedId];
    assert.ok(dossier, `Missing dossier in SPORTS_ARCADE_LORE_DOSSIERS for: ${expectedId}`);
    assert.equal(dossier, exportedDossier);
    assert.equal(dossier.gameId, expectedId);
    assert.ok(!seenIds.has(dossier.gameId), `Duplicate gameId detected: ${dossier.gameId}`);
    seenIds.add(dossier.gameId);

    assert.ok(dossier.gameTitle.trim().length > 0);
    assert.ok(dossier.gameSubtitle.trim().length > 0);
    assert.ok(dossier.badge.trim().length > 0);
    assert.ok(
      dossier.culturalOrigin.sections.length >= 2,
      `${expectedId} must have at least 2 culturalOrigin sections`,
    );
    assert.ok(
      dossier.rulesAndStrategy.sections.length >= 2,
      `${expectedId} must have at least 2 rulesAndStrategy sections`,
    );

    const hasSakuraiTip = dossier.rulesAndStrategy.sections.some(
      (sec) => typeof sec.sakuraiTip === 'string' && sec.sakuraiTip.trim().length > 10,
    );
    assert.ok(hasSakuraiTip, `Dossier ${expectedId} must contain a Sakurai tactical tip (> 10 chars)`);
  }
});

test('sports/arcade dossiers cover authentic mechanics and cultural lore', () => {
  assert.match(JSON.stringify(BASEBALL_LIFE_LORE), /甲子園/);
  assert.match(JSON.stringify(BASEBALL_LIFE_LORE), /二刀流/);
  assert.match(JSON.stringify(BASEBALL_LIFE_LORE), /64aa2bl7/);

  assert.match(JSON.stringify(BRICK_KART_LORE), /Mode-7/);
  assert.match(JSON.stringify(BRICK_KART_LORE), /紫噴/);
  assert.match(JSON.stringify(BRICK_KART_LORE), /三連盾/);

  assert.match(JSON.stringify(CYBER_NEON_RUSH_LORE), /Synthwave|合成波/);
  assert.match(JSON.stringify(CYBER_NEON_RUSH_LORE), /FEVER/);
  assert.match(JSON.stringify(CYBER_NEON_RUSH_LORE), /Three\.js/);

  assert.match(JSON.stringify(DANMAKU_ABYSS_LORE), /東方 Project/);
  assert.match(JSON.stringify(DANMAKU_ABYSS_LORE), /Cave/);
  assert.match(JSON.stringify(DANMAKU_ABYSS_LORE), /擦彈/);
  assert.match(JSON.stringify(DANMAKU_ABYSS_LORE), /靈擊/);

  assert.match(JSON.stringify(DYNASTY_LORE), /Moneyball/);
  assert.match(JSON.stringify(DYNASTY_LORE), /奢侈稅/);
  assert.match(JSON.stringify(DYNASTY_LORE), /球探/);

  assert.match(JSON.stringify(SWITCHPOINT_RUN_LORE), /Switchpoint|Switchback/);
  assert.match(JSON.stringify(SWITCHPOINT_RUN_LORE), /430m/);
  assert.match(JSON.stringify(SWITCHPOINT_RUN_LORE), /26/);

  assert.match(JSON.stringify(TOY_BASEBALL_LORE), /野球盤/);
  assert.match(JSON.stringify(TOY_BASEBALL_LORE), /StatCast/);
  assert.match(JSON.stringify(TOY_BASEBALL_LORE), /0\.28/);

  assert.match(JSON.stringify(TOY_BOXING_LORE), /Punch-Out!!/);
  assert.match(JSON.stringify(TOY_BOXING_LORE), /Counter/);
  assert.match(JSON.stringify(TOY_BOXING_LORE), /招牌拳/);
});

test('strictly zero Simplified Chinese characters in all sports/arcade dossiers', () => {
  for (const [id, dossier] of Object.entries(SPORTS_ARCADE_LORE_DOSSIERS)) {
    const raw = JSON.stringify(dossier);
    for (const sc of STRICT_SIMPLIFIED_ONLY) {
      assert.ok(
        !raw.includes(sc),
        `Found forbidden Simplified Chinese character "${sc}" in ${id} dossier!`,
      );
    }
  }
});
