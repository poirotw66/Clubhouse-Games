import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { __resetJuiceForTests, saveJuiceSettings } from './juice.ts';
import {
  formatCountedValue,
  parseStatValue,
  resolveEmphasis,
  starCountFor,
  variantParticlePreset,
} from './resultOverlayFx.ts';

afterEach(() => {
  __resetJuiceForTests();
});

describe('parseStatValue', () => {
  it('parses plain numbers and prefixed scores', () => {
    assert.equal(parseStatValue(42).kind, 'number');
    assert.equal(parseStatValue(42).value, 42);
    assert.deepEqual(parseStatValue('128'), {
      kind: 'number',
      text: '128',
      value: 128,
      prefix: '',
      suffix: '',
      decimals: 0,
    });
    const money = parseStatValue('$12');
    assert.equal(money.kind, 'number');
    assert.equal(money.value, 12);
    assert.equal(money.prefix, '$');
  });

  it('keeps non-numeric labels as text', () => {
    assert.equal(parseStatValue('經典').kind, 'text');
    assert.equal(parseStatValue('3 / 10').kind, 'text');
  });
});

describe('formatCountedValue', () => {
  it('reassembles prefix and suffix', () => {
    const parsed = parseStatValue('$12');
    assert.equal(formatCountedValue(parsed, 7), '$7');
  });
});

describe('variantParticlePreset', () => {
  it('maps win/lose/neutral to juice presets', () => {
    assert.equal(variantParticlePreset('win'), 'confetti');
    assert.equal(variantParticlePreset('lose'), 'dust');
    assert.equal(variantParticlePreset('neutral'), 'sparkle');
  });

  it('juice settings stay independent of parsing helpers', () => {
    saveJuiceSettings({ fx: 'off' });
    assert.equal(variantParticlePreset('win'), 'confetti');
  });
});

describe('resolveEmphasis / starCountFor', () => {
  it('detects record emphasis from badge or title', () => {
    assert.equal(resolveEmphasis({ badge: '破紀錄' }), 'record');
    assert.equal(resolveEmphasis({ title: '新高分！' }), 'record');
    assert.equal(resolveEmphasis({ title: '你贏了！' }), 'standard');
  });

  it('maps stars by variant and emphasis', () => {
    assert.equal(starCountFor('win', 'standard'), 5);
    assert.equal(starCountFor('lose', 'standard'), 1);
    assert.equal(starCountFor('neutral', 'standard'), 3);
    assert.equal(starCountFor('lose', 'record'), 5);
  });
});
