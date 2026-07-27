// Keyboard + on-screen touch controls for rudder / trim / camera look.

export function createInput(root) {
  const keys = new Set();
  let lookYaw = 0;
  let dragging = false;
  let lastX = 0;

  const onKey = (e, down) => {
    if (e.repeat && down) return;
    keys[down ? 'add' : 'delete'](e.code);
    // Don't steal space from buttons.
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  };

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => keys.clear());

  // Touch / mouse look: drag on the canvas to glance left/right.
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
    if (e.target.closest('.touch-pad')) return;
    canvas.setPointerCapture(e.pointerId);
    startDrag(e.clientX);
  });
  canvas.addEventListener('pointermove', (e) => moveDrag(e.clientX));
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Soften look-yaw back to centre when not dragging.
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
    el.addEventListener('pointerleave', () => set(false));
  });

  root.querySelector('#btn-autotrim')?.addEventListener('click', () => {
    autoTrim = !autoTrim;
  });

  return {
    get autoTrim() {
      return autoTrim;
    },
    set autoTrim(v) {
      autoTrim = v;
    },
    get lookYaw() {
      return lookYaw;
    },
    /** Consume one-shot actions (toggle autotrim, restart, etc.). */
    consumePress(code) {
      if (!keys.has(code)) return false;
      keys.delete(code);
      return true;
    },
    sample(dt) {
      // Ease look back when idle.
      if (!dragging) lookYaw *= Math.exp(-2.2 * dt);

      let rudder = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA') || held.rudderLeft) rudder -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD') || held.rudderRight) rudder += 1;

      let trimDelta = 0;
      if (keys.has('KeyQ') || keys.has('BracketLeft') || held.trimIn) trimDelta -= 1;
      if (keys.has('KeyE') || keys.has('BracketRight') || held.trimOut) trimDelta += 1;

      if (keys.has('KeyT')) {
        keys.delete('KeyT');
        autoTrim = !autoTrim;
      }

      return {
        rudder,
        trimDelta,
        autoTrim,
      };
    },
  };
}
