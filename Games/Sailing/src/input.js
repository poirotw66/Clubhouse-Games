// Keyboard + on-screen touch controls for rudder / trim / camera look.

export function createInput(root) {
  const keys = new Set();
  let lookYaw = 0;
  let dragging = false;
  let lastX = 0;

  const STEER = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyZ', 'KeyX']);

  const onKey = (e, down) => {
    if (e.repeat && down) return;
    keys[down ? 'add' : 'delete'](e.code);
    if (STEER.has(e.code) || e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'KeyQ' || e.code === 'KeyE') {
      e.preventDefault();
    }
  };

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => keys.clear());

  const canvas = root.querySelector('#gl');
  const startDrag = (x) => {
    dragging = true;
    lastX = x;
  };
  const moveDrag = (x) => {
    if (!dragging) return;
    lookYaw += (x - lastX) * 0.004;
    lookYaw = Math.max(-1.1, Math.min(1.1, lookYaw));
    lastX = x;
  };
  const endDrag = () => {
    dragging = false;
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.touch-pad, .key-strip, button')) return;
    canvas.setPointerCapture(e.pointerId);
    startDrag(e.clientX);
  });
  canvas.addEventListener('pointermove', (e) => moveDrag(e.clientX));
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  let autoTrim = true;
  const held = {
    rudderLeft: false,
    rudderRight: false,
    trimIn: false,
    trimOut: false,
  };

  root.querySelectorAll('[data-hold]').forEach((el) => {
    const key = el.getAttribute('data-hold');
    const set = (v) => {
      held[key] = v;
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      set(true);
    });
    el.addEventListener('pointerup', () => set(false));
    el.addEventListener('pointercancel', () => set(false));
    el.addEventListener('lostpointercapture', () => set(false));
  });

  const syncAutoBtn = () => {
    const btn = root.querySelector('#btn-autotrim');
    if (!btn) return;
    btn.classList.toggle('active', autoTrim);
    btn.setAttribute('aria-pressed', autoTrim ? 'true' : 'false');
    btn.textContent = autoTrim ? '自動調帆 ON' : '自動調帆 OFF';
  };

  const toggleAuto = () => {
    autoTrim = !autoTrim;
    syncAutoBtn();
  };

  root.querySelector('#btn-autotrim')?.addEventListener('click', toggleAuto);
  syncAutoBtn();

  return {
    get autoTrim() {
      return autoTrim;
    },
    set autoTrim(v) {
      autoTrim = v;
      syncAutoBtn();
    },
    get lookYaw() {
      return lookYaw;
    },
    consumePress(code) {
      if (!keys.has(code)) return false;
      keys.delete(code);
      return true;
    },
    sample(dt) {
      if (!dragging) lookYaw *= Math.exp(-2.2 * dt);

      let rudder = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA') || held.rudderLeft) rudder -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD') || held.rudderRight) rudder += 1;

      // Sheet in / out: Z X, Q E, ↑ ↓, [ ]
      let trimDelta = 0;
      if (
        keys.has('KeyQ') || keys.has('KeyZ') || keys.has('ArrowUp')
        || keys.has('BracketLeft') || keys.has('Comma') || held.trimIn
      ) {
        trimDelta -= 1;
      }
      if (
        keys.has('KeyE') || keys.has('KeyX') || keys.has('ArrowDown')
        || keys.has('BracketRight') || keys.has('Period') || held.trimOut
      ) {
        trimDelta += 1;
      }

      if (keys.has('KeyT') || keys.has('KeyC') || keys.has('KeyF')) {
        keys.delete('KeyT');
        keys.delete('KeyC');
        keys.delete('KeyF');
        toggleAuto();
      }

      // Manual trim disables auto so the keys always "do something".
      if (trimDelta && autoTrim) {
        autoTrim = false;
        syncAutoBtn();
      }

      return {
        rudder,
        trimDelta,
        autoTrim,
      };
    },
  };
}
