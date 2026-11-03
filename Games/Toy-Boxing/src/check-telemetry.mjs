// Unit test for telemetry physics, opponent intel radar, and Master Coach hints.

import {
  calculatePunchGForce,
  getLiveMasterCoachHint,
  getOpponentTacticalIntel,
} from './telemetry.ts';
import { OPPONENTS } from './opponents.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1. G-Force calculations
const jabG = calculatePunchGForce('jab', 1.0, false, false);
assert(jabG.gForce >= 14 && jabG.gForce <= 18, `Jab G-Force expected ~16, got ${jabG.gForce}`);
assert(jabG.speedMs >= 16, `Jab speed expected >= 16, got ${jabG.speedMs}`);

const hookG = calculatePunchGForce('hook', 1.0, false, false);
assert(hookG.gForce > jabG.gForce, 'Hook G-Force must exceed Jab G-Force');

const counterHookG = calculatePunchGForce('hook', 1.0, false, true);
assert(counterHookG.gForce > hookG.gForce, 'Counter Hook must have bonus G-Force');

const superG = calculatePunchGForce('signature', 1.2, true, false);
assert(superG.rating === 'S', `Super punch rating expected S, got ${superG.rating}`);
assert(superG.gForce >= 50, `Super G-Force expected >= 50, got ${superG.gForce}`);

// 2. Opponent Intel coverage for all 6 roster opponents
for (const opp of OPPONENTS) {
  const intel = getOpponentTacticalIntel(opp.id);
  assert(intel.name === opp.name, `Opponent name mismatch for ${opp.id}`);
  assert(intel.styleBadge.length > 0, `Missing style badge for ${opp.id}`);
  assert(intel.radarStats.aggression > 0, `Missing aggression stat for ${opp.id}`);
  assert(intel.radarStats.defense > 0, `Missing defense stat for ${opp.id}`);
  assert(intel.radarStats.speed > 0, `Missing speed stat for ${opp.id}`);
  assert(intel.radarStats.power > 0, `Missing power stat for ${opp.id}`);
  assert(intel.signatureName.length > 0, `Missing signature name for ${opp.id}`);
}

// Free mode fallback
const freeIntel = getOpponentTacticalIntel(null, 'bear');
assert(freeIntel.styleCategory === 'rushdown', 'Bear fallback must be rushdown');

// 3. Master Coach Hint state evaluation
const intel = getOpponentTacticalIntel('rush');

const sigThreatHint = getLiveMasterCoachHint({
  playerHealth: 100,
  playerMaxHealth: 100,
  playerStamina: 100,
  playerStun: 0,
  playerSuper: 0,
  playerBodyFatigue: 0,
  cpuHealth: 100,
  cpuMaxHealth: 100,
  cpuStamina: 100,
  cpuStun: 0,
  cpuSuper: 100,
  cpuIsWindup: true,
  cpuIsSignature: true,
  cpuHeight: 'high',
  cpuStaggered: false,
  opponentIntel: intel,
});
assert(sigThreatHint.tone === 'danger', 'Signature windup must trigger danger tone');
assert(sigThreatHint.text.includes('閃避'), 'Signature warning must instruct dodge');

const counterWindowHint = getLiveMasterCoachHint({
  playerHealth: 100,
  playerMaxHealth: 100,
  playerStamina: 100,
  playerStun: 0,
  playerSuper: 0,
  playerBodyFatigue: 0,
  cpuHealth: 100,
  cpuMaxHealth: 100,
  cpuStamina: 100,
  cpuStun: 0,
  cpuSuper: 0,
  cpuIsWindup: true,
  cpuIsSignature: false,
  cpuHeight: 'high',
  cpuStaggered: false,
  opponentIntel: intel,
});
assert(counterWindowHint.tone === 'opportunity', 'Counter window must trigger opportunity tone');

console.log('check-telemetry: ok');
