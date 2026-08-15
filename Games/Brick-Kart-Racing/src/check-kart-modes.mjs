// ponytail: assert mode record keys stay stable + legacy versus migration.
import {
  bestLapKey,
  migrateBestTimesMap,
  migrateLegacyBestLapKey,
} from './engine/raceOptions.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(
  bestLapKey('brick-park', {mode: 'versus', mirror: false}, 'normal') === 'brick-park:vs:normal',
  'versus normal key',
);
assert(
  bestLapKey('brick-park', {mode: 'versus', mirror: false}, 'hard') === 'brick-park:vs:hard',
  'versus hard key',
);
assert(
  bestLapKey('brick-park', {mode: 'timeTrial', mirror: true}, 'hard') === 'brick-park:tt:mir',
  'tt ignores difficulty',
);
assert(
  bestLapKey('neon-city', {mode: 'versus', mirror: true}, 'easy') === 'neon-city:vs:easy:mir',
  'versus mirror key',
);

assert(migrateLegacyBestLapKey('brick-park:vs') === 'brick-park:vs:normal', 'migrate vs');
assert(
  migrateLegacyBestLapKey('brick-park:vs:mir') === 'brick-park:vs:normal:mir',
  'migrate vs mir',
);
assert(migrateLegacyBestLapKey('brick-park:tt') === null, 'tt needs no migrate');
assert(migrateLegacyBestLapKey('brick-park:vs:normal') === null, 'new key stays');

{
  const map = {'brick-park:vs': 42, 'brick-park:vs:hard': 40};
  assert(migrateBestTimesMap(map) === true, 'should rewrite legacy');
  assert(map['brick-park:vs'] == null, 'legacy removed');
  assert(map['brick-park:vs:normal'] === 42, 'legacy → normal');
  assert(map['brick-park:vs:hard'] === 40, 'existing hard kept');
}

console.log('check-kart-modes: ok');
