import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  __resetJuiceForTests,
  fxMultiplier,
  haptic,
  hit,
  JUICE_STORAGE_KEY,
  loadJuiceSettings,
  parseJuiceSettings,
  particles,
  particleCount,
  prefersReducedMotion,
  saveJuiceSettings,
  shake,
} from './juice.ts';

function stubVibrate(fn: (pattern: number | number[]) => boolean): () => void {
  const nav = globalThis.navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  const previous = nav.vibrate;
  Object.defineProperty(nav, 'vibrate', {
    configurable: true,
    writable: true,
    value: fn,
  });
  return () => {
    if (previous === undefined) {
      Reflect.deleteProperty(nav, 'vibrate');
    } else {
      Object.defineProperty(nav, 'vibrate', {
        configurable: true,
        writable: true,
        value: previous,
      });
    }
  };
}

afterEach(() => {
  __resetJuiceForTests();
});

describe('parseJuiceSettings', () => {
  it('returns defaults for garbage input', () => {
    assert.deepEqual(parseJuiceSettings(null), { haptics: true, fx: 'full' });
    assert.deepEqual(parseJuiceSettings('x'), { haptics: true, fx: 'full' });
    assert.deepEqual(parseJuiceSettings({ fx: 'nope' }), { haptics: true, fx: 'full' });
  });

  it('accepts valid partial objects', () => {
    assert.deepEqual(parseJuiceSettings({ haptics: false, fx: 'low' }), {
      haptics: false,
      fx: 'low',
    });
    assert.deepEqual(parseJuiceSettings({ fx: 'off' }), { haptics: true, fx: 'off' });
  });
});

describe('settings persistence helpers', () => {
  it('load/save round-trip in memory when localStorage is missing', () => {
    const first = loadJuiceSettings();
    assert.equal(first.haptics, true);
    const next = saveJuiceSettings({ haptics: false, fx: 'low' });
    assert.deepEqual(next, { haptics: false, fx: 'low' });
    assert.deepEqual(loadJuiceSettings(), next);
    assert.equal(JUICE_STORAGE_KEY, 'clubhouse:juice');
  });
});

describe('prefersReducedMotion / fxMultiplier', () => {
  it('is false without matchMedia', () => {
    assert.equal(prefersReducedMotion(), false);
  });

  it('maps fx tiers to multipliers', () => {
    saveJuiceSettings({ fx: 'full' });
    assert.equal(fxMultiplier(), 1);
    saveJuiceSettings({ fx: 'low' });
    assert.equal(fxMultiplier(), 0.35);
    saveJuiceSettings({ fx: 'off' });
    assert.equal(fxMultiplier(), 0);
  });
});

describe('haptic', () => {
  it('no-ops when haptics are disabled even if vibrate exists', () => {
    const calls: unknown[] = [];
    const restore = stubVibrate((p) => {
      calls.push(p);
      return true;
    });
    try {
      saveJuiceSettings({ haptics: false });
      haptic('tap');
      haptic('impact');
      assert.equal(calls.length, 0);
    } finally {
      restore();
    }
  });

  it('calls vibrate for presets when enabled', () => {
    const calls: unknown[] = [];
    const restore = stubVibrate((p) => {
      calls.push(p);
      return true;
    });
    const g = globalThis as typeof globalThis & { performance?: { now: () => number } };
    const prevPerf = g.performance;
    let t = 0;
    g.performance = { now: () => ((t += 100), t) };
    try {
      saveJuiceSettings({ haptics: true });
      haptic('place');
      haptic('win');
      assert.ok(calls.length >= 1);
      assert.equal(typeof calls[0] === 'number' || Array.isArray(calls[0]), true);
    } finally {
      restore();
      g.performance = prevPerf;
    }
  });

  it('throttles rapid repeats', () => {
    const calls: unknown[] = [];
    const restore = stubVibrate((p) => {
      calls.push(p);
      return true;
    });
    const g = globalThis as typeof globalThis & { performance?: { now: () => number } };
    const prevPerf = g.performance;
    g.performance = { now: () => 1000 };
    try {
      saveJuiceSettings({ haptics: true });
      haptic('tap');
      haptic('tap');
      haptic('tap');
      assert.equal(calls.length, 1);
    } finally {
      restore();
      g.performance = prevPerf;
    }
  });
});

describe('particles / shake without DOM canvas', () => {
  it('particles and shake no-op safely without createElement', () => {
    saveJuiceSettings({ fx: 'full' });
    particles('burst', { x: 10, y: 20 });
    assert.equal(particleCount(), 0);
    shake(null, 1);
  });

  it('hit with audio none still tolerates missing DOM', () => {
    saveJuiceSettings({ haptics: false, fx: 'off' });
    hit({ strength: 0.5, audio: 'none', haptic: false, particles: false, shake: false });
  });
});
