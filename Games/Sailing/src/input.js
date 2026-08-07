// Keyboard + on-screen touch controls for rudder / trim / camera look.

export function createInput(root) {
  const keys = new Set();
  let lookYaw = 0;
  let dragging = false;
  let lastX = 0;

  // ArrowUp / W = hold course (easy-mode forward assist), not trim — beginners
  // reach for ↑ expecting "go", and binding it to sheet-in was the opposite.
  const STEER = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyZ', 'KeyX']);

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
    holdCourse: false,
  };

  root.querySelectorAll('[data-hold]').forEach((el) => {
    const key = el.getAttribute('data-hold');
    const set = (v) => {
      held[key] = v;
      el.classList.toggle('holding', v);
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
    // Easy mode owns the sheet — don't let the player turn auto-trim off.
    if (easy) {
      autoTrim = true;
      syncAutoBtn();
      return;
    }
    autoTrim = !autoTrim;
    syncAutoBtn();
  };

  root.querySelector('#btn-autotrim')?.addEventListener('click', toggleAuto);
  syncAutoBtn();

  // Easy mode: navigation assist on/off. Owned here so the button, the key and
  // the stored preference stay in one place; main.js reads `easy`.
  let easy = true;
  let onEasyChange = () => {};

  const syncEasyBtn = () => {
    const btn = root.querySelector('#btn-easy');
    if (!btn) return;
    btn.classList.toggle('active', easy);
    btn.setAttribute('aria-pressed', easy ? 'true' : 'false');
    btn.textContent = easy ? '簡單模式 ON' : '簡單模式 OFF';
  };

  const toggleEasy = () => {
    easy = !easy;
    syncEasyBtn();
    onEasyChange(easy);
  };

  root.querySelector('#btn-easy')?.addEventListener('click', toggleEasy);
  syncEasyBtn();

  // One-key tack. Latched rather than held: main.js consumes it and drives the
  // turn itself, so a single tap commits to the whole manoeuvre.
  let tackRequested = false;
  const requestTack = () => {
    tackRequested = true;
  };
  const tackBtn = root.querySelector('#btn-tack');
  tackBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    requestTack();
  });
  // Press flash for one-shot tack (not a hold control).
  const flashTack = (on) => tackBtn?.classList.toggle('holding', on);
  tackBtn?.addEventListener('pointerdown', () => flashTack(true));
  tackBtn?.addEventListener('pointerup', () => flashTack(false));
  tackBtn?.addEventListener('pointercancel', () => flashTack(false));
  tackBtn?.addEventListener('lostpointercapture', () => flashTack(false));

  return {
    get autoTrim() {
      return autoTrim;
    },
    set autoTrim(v) {
      autoTrim = v;
      syncAutoBtn();
    },
    get easy() {
      return easy;
    },
    set easy(v) {
      easy = v;
      syncEasyBtn();
    },
    set onEasyChange(fn) {
      onEasyChange = fn;
    },
    /** True once per requested tack. */
    consumeTack() {
      if (!tackRequested) return false;
      tackRequested = false;
      return true;
    },
    get lookYaw() {
      return lookYaw;
    },
    /** True while ↑ / W / 前進 pad is held. */
    get holdingCourse() {
      return (
        keys.has('ArrowUp')
        || keys.has('KeyW')
        || keys.has('ArrowDown')
        || held.holdCourse
      );
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

      // Sheet in / out: Z X, Q E, [ ] — not arrow keys (those are helm / go).
      let trimDelta = 0;
      if (
        keys.has('KeyQ') || keys.has('KeyZ')
        || keys.has('BracketLeft') || keys.has('Comma') || held.trimIn
      ) {
        trimDelta -= 1;
      }
      if (
        keys.has('KeyE') || keys.has('KeyX')
        || keys.has('BracketRight') || keys.has('Period') || held.trimOut
      ) {
        trimDelta += 1;
      }

      const holdCourse = this.holdingCourse;

      if (keys.has('Space')) {
        keys.delete('Space');
        requestTack();
      }

      if (keys.has('KeyT') || keys.has('KeyC') || keys.has('KeyF')) {
        keys.delete('KeyT');
        keys.delete('KeyC');
        keys.delete('KeyF');
        toggleAuto();
      }

      // Manual trim disables auto so the keys always "do something".
      // Easy mode keeps auto-trim locked — Z/X are ignored there.
      if (trimDelta && autoTrim && !easy) {
        autoTrim = false;
        syncAutoBtn();
      }

      return {
        rudder,
        trimDelta: easy ? 0 : trimDelta,
        autoTrim: easy || holdCourse ? true : autoTrim,
        holdCourse,
      };
    },
  };
}
