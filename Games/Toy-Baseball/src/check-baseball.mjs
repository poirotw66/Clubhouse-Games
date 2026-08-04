// ponytail: assert fair-ball grading uses quality, and difficulty tables stay ordered.
import {
  DIFFICULTY,
  gradeFairLanding,
  cpuSwingTargetY,
} from './difficulty.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Crushed contact at medium depth stays a hit; weak contact becomes an out.
{
  const cfg = DIFFICULTY.normal;
  const crush = gradeFairLanding(250, 0.9, cfg);
  assert(crush.bases >= 1, `crushed medium ball should be a hit, got ${crush.result}`);
  const weak = gradeFairLanding(250, 0.1, cfg);
  assert(weak.bases === 0, `weak medium ball should be out, got ${weak.result}`);
}

// Hard is stricter on the player and sharper for the CPU.
assert(DIFFICULTY.hard.hitRadius < DIFFICULTY.easy.hitRadius, 'hard hit window should be smaller');
assert(DIFFICULTY.hard.cpuAimSkill > DIFFICULTY.easy.cpuAimSkill, 'hard CPU should aim better');
assert(DIFFICULTY.hard.cpuPitchDelayMax < DIFFICULTY.easy.cpuPitchDelayMin, 'hard pitches sooner');

// Target Y stays near the plate.
{
  const y = cpuSwingTargetY(1, () => 0.5);
  assert(Math.abs(y - 448) < 1, `perfect skill should aim ~448, got ${y}`);
}

console.log('check-baseball: ok');
