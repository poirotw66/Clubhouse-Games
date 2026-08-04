// ponytail: assert mode record keys stay stable.
import {bestLapKey} from './engine/raceOptions.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(bestLapKey('brick-park', {mode: 'versus', mirror: false}) === 'brick-park:vs', 'versus key');
assert(
  bestLapKey('brick-park', {mode: 'timeTrial', mirror: true}) === 'brick-park:tt:mir',
  'tt mirror key',
);
assert(
  bestLapKey('neon-city', {mode: 'versus', mirror: true}) === 'neon-city:vs:mir',
  'versus mirror key',
);

console.log('check-kart-modes: ok');
