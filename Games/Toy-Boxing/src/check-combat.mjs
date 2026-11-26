// ponytail: high/low guard math, wind-up phases, stun KO, habit memory.
import {
  CORRECT_GUARD_MUL,
  WRONG_GUARD_MUL,
  attackProfile,
  emptyHabit,
  isStunKo,
  playerHighRatio,
  preferredGuardHeight,
  recordPlayerHeight,
  resolveHit,
  startAttack,
  tickAttack,
  applyStun,
  STUN_KO_THRESHOLD,
  DEFAULT_MOVE_SPEED,
  INPUT_BUFFER_WINDOW,
  GUARD_CANCEL_DODGE_STAMINA,
  GUARD_CANCEL_PARRY_STAMINA,
  NEUTRAL_DODGE_STAMINA,
  NEUTRAL_PARRY_STAMINA,
  GUARD_CANCEL_DODGE_TIMER,
  NEUTRAL_DODGE_TIMER,
  GUARD_CANCEL_PARRY_TIMER,
  NEUTRAL_PARRY_TIMER,
  calculateMoveDelta,
  calculateParryLifeDecay,
  canGuardCancelDodge,
  canGuardCancelParry,
} from './combat.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Profiles: hook wind-up longer than jab; signature unblockable.
{
  const jab = attackProfile('jab', 'high');
  const hook = attackProfile('hook', 'high');
  const sig = attackProfile('signature', 'high');
  assert(hook.windup > jab.windup, 'hook should telegraph longer than jab');
  assert(sig.unblockable === true, 'signature must be unblockable');
  assert(attackProfile('jab', 'high').stunBuild > 0, 'high jab builds stun');
  assert(attackProfile('jab', 'low').bodyFatigue > 0, 'low jab applies body fatigue');
  assert(attackProfile('jab', 'low').stunBuild === 0, 'low jab should not build stun');
}

// League signature overrides (windup / height / blockable) must stick.
{
  const lowSig = attackProfile('signature', 'high', false, {
    windup: 0.26,
    height: 'low',
    unblockable: false,
    bodyFatigue: 0.28,
    stunBuild: 8,
  });
  assert(lowSig.height === 'low', 'override height');
  assert(lowSig.windup === 0.26, 'override windup');
  assert(lowSig.unblockable === false, 'override can make signature blockable');
  assert(lowSig.bodyFatigue === 0.28, 'override body fatigue');
  const started = startAttack('signature', 'high', false, {
    windup: 0.34,
    height: 'low',
    unblockable: false,
  });
  assert(started.height === 'low' && started.phaseTimer === 0.34, 'startAttack honors overrides');
}

// Phase machine: windup → active → recovery → done.
{
  let a = startAttack('jab', 'high');
  assert(a.phase === 'windup', 'starts in windup');
  a = tickAttack(a, a.profile.windup + 0.001);
  assert(a && a.phase === 'active', `expected active, got ${a?.phase}`);
  a = tickAttack(a, a.profile.active + 0.001);
  assert(a && a.phase === 'recovery', `expected recovery, got ${a?.phase}`);
  a = tickAttack(a, a.profile.recovery + 0.001);
  assert(a === null, 'attack should finish');
}

// Guard mind game: correct 80% reduction, wrong 20%.
{
  const attack = { ...startAttack('hook', 'high'), phase: 'active', phaseTimer: 0.05, resolved: false };
  const correct = resolveHit({
    attack,
    attackerPower: 1,
    defenderGuarding: true,
    defenderGuardHeight: 'high',
    defenderDodging: false,
    defenderParrying: false,
    defenderParryHeight: null,
    defenderAttacking: false,
  });
  assert(correct.type === 'hit' && correct.blocked && correct.guardCorrect === true, 'correct guard');
  assert(
    Math.abs(correct.damage - attack.profile.baseDamage * CORRECT_GUARD_MUL) < 0.01,
    `correct mul, got ${correct.damage}`,
  );

  const wrong = resolveHit({
    attack,
    attackerPower: 1,
    defenderGuarding: true,
    defenderGuardHeight: 'low',
    defenderDodging: false,
    defenderParrying: false,
    defenderParryHeight: null,
    defenderAttacking: false,
  });
  assert(wrong.type === 'hit' && wrong.guardCorrect === false, 'wrong guard');
  assert(
    Math.abs(wrong.damage - attack.profile.baseDamage * WRONG_GUARD_MUL) < 0.01,
    `wrong mul, got ${wrong.damage}`,
  );
}

// Parry only on matching height.
{
  const attack = { ...startAttack('jab', 'low'), phase: 'active', phaseTimer: 0.05, resolved: false };
  const miss = resolveHit({
    attack,
    attackerPower: 1,
    defenderGuarding: false,
    defenderGuardHeight: null,
    defenderDodging: false,
    defenderParrying: true,
    defenderParryHeight: 'high',
    defenderAttacking: false,
  });
  assert(miss.type === 'hit', 'wrong-height parry should not fully negate');

  const ok = resolveHit({
    attack,
    attackerPower: 1,
    defenderGuarding: false,
    defenderGuardHeight: null,
    defenderDodging: false,
    defenderParrying: true,
    defenderParryHeight: 'low',
    defenderAttacking: false,
  });
  assert(ok.type === 'parry', 'matching parry');
}

// Unblockable signature still dodgeable.
{
  const attack = { ...startAttack('signature', 'high'), phase: 'active', phaseTimer: 0.05, resolved: false };
  const blocked = resolveHit({
    attack,
    attackerPower: 1,
    defenderGuarding: true,
    defenderGuardHeight: 'high',
    defenderDodging: false,
    defenderParrying: false,
    defenderParryHeight: null,
    defenderAttacking: false,
  });
  assert(blocked.type === 'hit' && blocked.blocked === false, 'signature ignores block');

  const dodged = resolveHit({
    attack,
    attackerPower: 1,
    defenderGuarding: false,
    defenderGuardHeight: null,
    defenderDodging: true,
    defenderParrying: false,
    defenderParryHeight: null,
    defenderAttacking: false,
  });
  assert(dodged.type === 'dodged', 'signature can be dodged');
}

// Stun KO route.
{
  let stun = 0;
  stun = applyStun(stun, 60);
  assert(!isStunKo(stun), 'partial stun not KO');
  stun = applyStun(stun, 50);
  assert(stun === STUN_KO_THRESHOLD && isStunKo(stun), 'stun should reach KO threshold');
}

// Habit memory prefers the player's favored height.
{
  let mem = emptyHabit();
  for (let i = 0; i < 8; i++) mem = recordPlayerHeight(mem, 'low');
  assert(playerHighRatio(mem) < 0.3, `expected low-heavy habit, got ${playerHighRatio(mem)}`);
  assert(preferredGuardHeight(mem, 1) === 'low', 'full adapt should guard low');
  assert(preferredGuardHeight(emptyHabit(), 0) === 'high', 'empty defaults high at bias 0 blend');
}

// Counter-Hit surge check (Sakurai gameplay-core-001).
{
  const normalAttack = startAttack('hook', 'high');
  normalAttack.phase = 'active';
  const normalHit = resolveHit({
    attack: normalAttack,
    attackerPower: 1,
    defenderGuarding: false,
    defenderGuardHeight: null,
    defenderDodging: false,
    defenderParrying: false,
    defenderParryHeight: null,
    defenderAttacking: false,
  });
  assert(normalHit.type === 'hit' && normalHit.isCounter === false, 'normal hit is not a counter');

  const counterAttack = startAttack('hook', 'high');
  counterAttack.phase = 'active';
  const counterHit = resolveHit({
    attack: counterAttack,
    attackerPower: 1,
    defenderGuarding: false,
    defenderGuardHeight: null,
    defenderDodging: false,
    defenderParrying: false,
    defenderParryHeight: null,
    defenderAttacking: true,
  });
  assert(counterHit.type === 'hit' && counterHit.isCounter === true, 'catching attacking opponent is counter');
  assert(counterHit.damage > normalHit.damage * 1.4, 'counter increases damage by 1.5x');
  assert(counterHit.stunGain > normalHit.stunGain * 1.2, 'counter increases stun gain by 1.25x');
}

// Frame-rate normalization checks (Sakurai 60Hz/120Hz consistency).
{
  const speed = 1.2;
  // 60 frames at 60Hz (dt = 1/60)
  let dist60 = 0;
  for (let i = 0; i < 60; i++) {
    dist60 += calculateMoveDelta(speed, 1 / 60, DEFAULT_MOVE_SPEED);
  }
  // 120 frames at 120Hz (dt = 1/120)
  let dist120 = 0;
  for (let i = 0; i < 120; i++) {
    dist120 += calculateMoveDelta(speed, 1 / 120, DEFAULT_MOVE_SPEED);
  }
  assert(Math.abs(dist60 - dist120) < 1e-6, `120Hz movement should match 60Hz, got ${dist60} vs ${dist120}`);

  // Parry effect life decay normalization over 1 second (30 frames at 60Hz = 0.5s)
  let lifeDecay60 = 0;
  for (let i = 0; i < 60; i++) {
    lifeDecay60 += calculateParryLifeDecay(1 / 60, 0.03);
  }
  let lifeDecay120 = 0;
  for (let i = 0; i < 120; i++) {
    lifeDecay120 += calculateParryLifeDecay(1 / 120, 0.03);
  }
  assert(Math.abs(lifeDecay60 - lifeDecay120) < 1e-6, 'parry decay matches between 60Hz and 120Hz');
}

// Input buffer & Guard-cancel tradeoffs.
{
  assert(INPUT_BUFFER_WINDOW >= 0.1 && INPUT_BUFFER_WINDOW <= 0.12, 'input buffer should be 100-120ms');
  assert(GUARD_CANCEL_DODGE_STAMINA > NEUTRAL_DODGE_STAMINA, 'guard cancel dodge costs more stamina than neutral');
  assert(GUARD_CANCEL_DODGE_TIMER > NEUTRAL_DODGE_TIMER, 'guard cancel dodge has startup/recovery tradeoff');
  assert(GUARD_CANCEL_PARRY_STAMINA > NEUTRAL_PARRY_STAMINA, 'guard cancel parry costs more stamina than neutral');

  assert(canGuardCancelDodge(20) === true, 'stamina 20 can guard cancel dodge');
  assert(canGuardCancelDodge(19) === false, 'stamina 19 cannot guard cancel dodge');
  assert(canGuardCancelParry(15) === true, 'stamina 15 can guard cancel parry');
  assert(canGuardCancelParry(14) === false, 'stamina 14 cannot guard cancel parry');
}

console.log('check-combat: ok');
