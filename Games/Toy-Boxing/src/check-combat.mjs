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

console.log('check-combat: ok');
