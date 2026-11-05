/** A safe, untimed rehearsal of the real diagonal gait. Never drives the race. */
export function setupPaddock({ tr, isActive }) {
  const stage = document.getElementById('gaitStage');
  const feedback = document.getElementById('gaitFeedback');
  const progress = document.getElementById('gaitProgress');
  const buttons = {
    A: document.getElementById('gaitBeatA'),
    B: document.getElementById('gaitBeatB'),
  };
  const keys = new Set();
  let completed = 0;
  let message = 'paddock_gait_ready';
  let animationTimer;
  let activePair = '';

  function refresh() {
    progress.textContent = `${completed} / 2`;
    stage.dataset.progress = String(completed);
    feedback.textContent = tr(message);
    feedback.classList.toggle('is-complete', completed === 2);
    buttons.A.classList.toggle('is-next', completed === 0);
    buttons.B.classList.toggle('is-next', completed === 1);
  }
  function releasePose() {
    clearTimeout(animationTimer);
    stage.dataset.pair = '';
    Object.values(buttons).forEach(button => {
      button.classList.remove('is-current');
      button.setAttribute('aria-pressed', 'false');
    });
  }
  function playBeat(pair) {
    if (!isActive()) return;
    releasePose();
    stage.dataset.pair = pair;
    buttons[pair].classList.add('is-current');
    buttons[pair].setAttribute('aria-pressed', 'true');
    if (pair === 'A' && completed === 0) {
      completed = 1;
      message = 'paddock_gait_next';
    } else if (pair === 'B' && completed === 1) {
      completed = 2;
      message = 'paddock_gait_done';
    } else if (completed === 0) {
      message = 'paddock_gait_first';
    }
    refresh();
    animationTimer = setTimeout(releasePose, 420);
  }
  buttons.A.addEventListener('click', () => playBeat('A'));
  buttons.B.addEventListener('click', () => playBeat('B'));

  const gaitKeys = new Set(['KeyQ', 'KeyW', 'KeyO', 'KeyP']);
  document.addEventListener('keydown', event => {
    if (!isActive() || !gaitKeys.has(event.code) || event.repeat) return;
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    keys.add(event.code);
    if (keys.size > 2) {
      message = 'paddock_gait_four';
      refresh();
      return;
    }
    const pair = keys.has('KeyQ') && keys.has('KeyP') ? 'A'
      : keys.has('KeyW') && keys.has('KeyO') ? 'B' : '';
    if (pair && pair !== activePair) {
      activePair = pair;
      playBeat(pair);
    }
  });
  document.addEventListener('keyup', event => {
    keys.delete(event.code);
    if (keys.size === 0) activePair = '';
  });
  window.addEventListener('blur', () => { keys.clear(); activePair = ''; releasePose(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { keys.clear(); activePair = ''; releasePose(); }
  });
  refresh();
  return refresh;
}
