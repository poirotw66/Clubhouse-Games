/** Observe real hoof contacts. Coaching never writes to the horse or its inputs. */
export class StrideCoach {
  constructor() { this.reset(); }

  reset() {
    this.pending = { A: null, B: null };
    this.lastPair = null;
    this.lastAt = -Infinity;
    this.nextPair = 'A';
    this.streak = 0;
    this.bestStreak = 0;
    this.beats = 0;
    this.maxDistance = 0;
    this.drills = [false, false, false];
    this.inputPair = '';
    this.inputSince = 0;
  }

  breakStride() {
    this.pending = { A: null, B: null };
    this.lastPair = null;
    this.lastAt = -Infinity;
    this.nextPair = 'A';
    this.streak = 0;
    this.inputPair = '';
  }

  advance(time, distance) {
    this.maxDistance = Math.max(this.maxDistance, distance);
    if (time - this.lastAt > 0.85) this.streak = 0;
    if (this.bestStreak >= 2 && this.maxDistance >= 0.15) this.drills[0] = true;
    if (this.drills[0] && this.bestStreak >= 6) this.drills[1] = true;
    if (this.drills[1] && this.maxDistance >= 5) this.drills[2] = true;
  }

  recordStep(leg, time, distance) {
    if (!Number.isInteger(leg) || leg < 0 || leg > 3) return null;
    this.advance(time, distance);
    const pair = leg === 0 || leg === 3 ? 'A' : 'B';
    let pending = this.pending[pair];
    // A diagonal's two hooves land up to 140 ms apart in the real simulation.
    // Widely separated contacts or repeated taps of one hoof cannot form a beat.
    if (!pending || time - pending.time > 0.18) pending = { mask: 0, time };
    pending.mask |= 1 << leg;
    this.pending[pair] = pending;
    if (pending.mask !== (pair === 'A' ? 9 : 6)) return null;
    this.pending[pair] = null;
    const interval = time - this.lastAt;
    // Four-hoof landings and bounce chatter are one impact, not a clean alternation.
    if (interval < 0.16) return null;
    this.streak = this.lastPair && this.lastPair !== pair && interval <= 0.85
      ? this.streak + 1 : 1;
    this.lastPair = pair;
    this.lastAt = time;
    this.nextPair = pair === 'A' ? 'B' : 'A';
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.beats++;
    this.advance(time, distance);
    return { pair, streak: this.streak, beats: this.beats };
  }

  cue(held, time) {
    const keys = ['KeyQ', 'KeyW', 'KeyO', 'KeyP'].filter(key => held[key]);
    const pair = keys.length === 2 && held.KeyQ && held.KeyP ? 'A'
      : keys.length === 2 && held.KeyW && held.KeyO ? 'B' : '';
    if (pair !== this.inputPair) { this.inputPair = pair; this.inputSince = time; }
    if (keys.length >= 3) return { key: 'coach_release_all', pair: '', fill: 1, tone: 'warn' };
    if (keys.length === 2 && !pair) return { key: 'coach_diagonal', pair: '', fill: 0, tone: 'warn' };
    if (keys.length === 1) return { key: 'coach_add_partner', pair: keys[0] === 'KeyQ' || keys[0] === 'KeyP' ? 'A' : 'B', fill: 0, tone: 'neutral' };
    if (pair) {
      const fill = Math.min(1, (time - this.inputSince) / 0.24);
      return { key: fill < 1 ? 'coach_lift' : 'coach_release', pair, fill, tone: fill < 1 ? 'neutral' : 'ready' };
    }
    return { key: 'coach_next', pair: this.nextPair, fill: 0, tone: 'neutral' };
  }
}

export function mountStrideCoach({ tr, onRace }) {
  const element = document.getElementById('strideCoach');
  const title = document.getElementById('coachTitle');
  const cue = document.getElementById('coachCue');
  const streak = document.getElementById('coachStreak');
  const fill = document.getElementById('coachHoldFill');
  const practice = document.getElementById('coachPractice');
  const drillTitle = document.getElementById('coachDrillTitle');
  const drillValue = document.getElementById('coachDrillValue');
  const drillStatus = document.getElementById('coachDrillStatus');
  const raceButton = document.getElementById('coachRaceBtn');
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  raceButton.addEventListener('click', onRace);
  return (model, game, held) => {
    const visible = game.state === 'run' && game.countdown <= 0 && !game.fallPose;
    element.classList.toggle('hidden', !visible);
    if (!visible) return;
    const current = model.cue(held, game.elapsed);
    const pairText = current.pair === 'A' ? 'Q + P' : 'W + O';
    element.dataset.tone = current.tone;
    element.dataset.pulse = String(model.beats % 2);
    element.dataset.beats = String(model.beats);
    element.dataset.streak = String(model.streak);
    setText(title, tr(game.practice ? 'coach_practice' : 'coach_title'));
    setText(cue, tr(current.key).replace('{pair}', pairText));
    setText(streak, tr('coach_clean').replace('{n}', String(model.streak)));
    const width = `${Math.round(current.fill * 100)}%`;
    if (fill.style.width !== width) fill.style.width = width;
    practice.classList.toggle('hidden', !game.practice);
    if (!game.practice) return;
    const completed = model.drills.filter(Boolean).length;
    element.dataset.drills = String(completed);
    setText(drillStatus, tr('coach_progress').replace('{n}', String(completed)));
    setText(drillTitle, tr(`coach_drill_${completed}`));
    const value = completed === 0 ? `${Math.min(2, model.bestStreak)} / 2`
      : completed === 1 ? `${Math.min(6, model.bestStreak)} / 6`
      : completed === 2 ? `${Math.min(5, model.maxDistance).toFixed(1)} / 5 m` : '✓';
    setText(drillValue, value);
    raceButton.classList.toggle('hidden', completed < 3);
    setText(raceButton, tr('coach_race'));
    element.querySelectorAll('[data-coach-drill]').forEach(node => {
      node.classList.toggle('done', model.drills[Number(node.dataset.coachDrill)]);
    });
  };
}
