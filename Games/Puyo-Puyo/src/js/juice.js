/**
 * Thin plain-JS bridge onto ClubhouseJuice (bundled from shared/juice.ts by
 * build.mjs). Presentation only — never mutates scores or rules.
 * Settings persist under clubhouse:juice (same key as shared).
 * Exposed as window.PuyoJuice.
 */
(function (global) {
  'use strict';

  var Shared = global.ClubhouseJuice;
  var STORAGE_KEY = 'clubhouse:juice';
  var DEFAULTS = { haptics: true, fx: 'full' };

  var HAPTIC_PATTERNS = {
    tap: 8,
    place: 12,
    combo: [8, 30, 8, 30, 16],
    win: [12, 40, 12, 40, 12, 60, 30],
  };
  var HAPTIC_MIN_INTERVAL_MS = 55;
  var lastHapticAt = 0;

  function parseSettings(raw) {
    if (!raw || typeof raw !== 'object') return { haptics: DEFAULTS.haptics, fx: DEFAULTS.fx };
    var haptics = typeof raw.haptics === 'boolean' ? raw.haptics : DEFAULTS.haptics;
    var fx = raw.fx === 'off' || raw.fx === 'low' || raw.fx === 'full' ? raw.fx : DEFAULTS.fx;
    return { haptics: haptics, fx: fx };
  }

  function loadSettings() {
    if (Shared && typeof Shared.loadJuiceSettings === 'function') {
      return Shared.loadJuiceSettings();
    }
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      return raw ? parseSettings(JSON.parse(raw)) : { haptics: DEFAULTS.haptics, fx: DEFAULTS.fx };
    } catch (err) {
      return { haptics: DEFAULTS.haptics, fx: DEFAULTS.fx };
    }
  }

  function saveSettings(partial) {
    if (Shared && typeof Shared.saveJuiceSettings === 'function') {
      return Shared.saveJuiceSettings(partial);
    }
    var merged = Object.assign({}, loadSettings(), partial || {});
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
    } catch (err) {
      /* quota / private mode */
    }
    return merged;
  }

  function scalePattern(pattern, strength) {
    var s = Math.max(0.25, Math.min(1.5, strength));
    if (typeof pattern === 'number') return Math.max(1, Math.round(pattern * s));
    return pattern.map(function (n, i) {
      return i % 2 === 1 ? n : Math.max(1, Math.round(n * s));
    });
  }

  function hapticFallback(preset, strength) {
    var settings = loadSettings();
    if (!settings.haptics) return;
    if (!global.navigator || typeof global.navigator.vibrate !== 'function') return;
    var pattern = HAPTIC_PATTERNS[preset];
    if (pattern == null) return;
    var now = global.performance && typeof global.performance.now === 'function'
      ? global.performance.now()
      : Date.now();
    if (now - lastHapticAt < HAPTIC_MIN_INTERVAL_MS) return;
    lastHapticAt = now;
    try {
      global.navigator.vibrate(scalePattern(pattern, strength == null ? 1 : strength));
    } catch (err) {
      /* unsupported / blocked */
    }
  }

  function haptic(preset, strength) {
    if (Shared && typeof Shared.haptic === 'function') {
      Shared.haptic(preset, strength == null ? 1 : strength);
      return;
    }
    hapticFallback(preset, strength);
  }

  function particles(preset, opts) {
    if (Shared && typeof Shared.particles === 'function') {
      Shared.particles(preset, opts || {});
    }
  }

  function shake(el, intensity) {
    if (Shared && typeof Shared.shake === 'function') {
      Shared.shake(el, intensity == null ? 1 : intensity);
    }
  }

  function fieldShell(fieldEl) {
    if (!fieldEl || !fieldEl.closest) return fieldEl || null;
    return fieldEl.closest('.field-frame') || fieldEl;
  }

  function onMove() {
    haptic('tap');
  }

  function onRotate() {
    haptic('tap');
  }

  function onLand(fieldEl) {
    haptic('place');
    particles('dust', { el: fieldEl || null, strength: 0.7 });
  }

  function onPop(chain, fieldEl) {
    var n = Math.max(1, Number(chain) || 1);
    var strength = Math.min(1.5, 0.55 + n * 0.18);
    haptic('combo', strength);
    particles('burst', { el: fieldEl || null, strength: strength });
  }

  function onAllClear(fieldEl) {
    var shell = fieldShell(fieldEl);
    haptic('win');
    particles('confetti', { el: shell || fieldEl || null, strength: 1.1 });
    shake(shell, 1);
  }

  function onWin(fieldEl) {
    var shell = fieldShell(fieldEl);
    haptic('win');
    particles('confetti', { el: shell || fieldEl || null, strength: 1.15 });
    shake(shell, 1);
  }

  function bindSettingsControls() {
    var hapticsEl = document.getElementById('juice-haptics');
    var fxEl = document.getElementById('juice-fx');
    if (!hapticsEl && !fxEl) return;

    var current = loadSettings();
    if (hapticsEl) hapticsEl.checked = !!current.haptics;
    if (fxEl) fxEl.value = current.fx;

    if (hapticsEl) {
      hapticsEl.addEventListener('change', function () {
        saveSettings({ haptics: !!hapticsEl.checked });
      });
    }
    if (fxEl) {
      fxEl.addEventListener('change', function () {
        var next = fxEl.value;
        if (next !== 'off' && next !== 'low' && next !== 'full') next = 'full';
        saveSettings({ fx: next });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSettingsControls);
  } else {
    bindSettingsControls();
  }

  global.PuyoJuice = {
    onMove: onMove,
    onRotate: onRotate,
    onLand: onLand,
    onPop: onPop,
    onAllClear: onAllClear,
    onWin: onWin,
    haptic: haptic,
    particles: particles,
    shake: shake,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    storageKey: STORAGE_KEY,
  };
})(window);
