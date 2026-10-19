// Gate / round-mark self-check (no test framework).

import { createCourse, startTrueWindAngle, listCourses } from './courses.js';
import { createMarkTracker, gateLocal, markKind } from './marks.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const course = createCourse('harbor');
assert(course.gates.length >= 4, 'expected a multi-gate course');
assert(course.gates[0].isStart, 'first gate should be start');
assert(course.gates.at(-1).isFinish, 'last gate should be finish');

const marks = createMarkTracker(course.gates);
const startGate = course.gates[0];
const boat = { x: startGate.x, z: startGate.z + 20 };
marks.reset(boat);
assert(gateLocal(boat, startGate).along < 0, 'boat should start behind start gate');

// Miss laterally — should not clear.
boat.x = startGate.x + startGate.halfWidth + 8;
boat.z = startGate.z + 10;
marks.reset(boat);
boat.z = startGate.z - 10;
assert(marks.tryClear(boat) === null, 'wide miss must not clear');

// Proper crossing.
boat.x = startGate.x;
boat.z = startGate.z + 12;
marks.reset(boat);
boat.z = startGate.z - 8;
const hit = marks.tryClear(boat);
assert(hit && hit.index === 0, 'expected start gate clear');
assert(marks.nextIndex === 1, 'should advance to checkpoint 1');

// Harbor opens downwind so beginners aren't fighting the wind on GO.
{
  const twa = startTrueWindAngle(course);
  assert(twa > (150 * Math.PI) / 180,
    `harbor start should be a run (downwind): TWA ${((twa * 180) / Math.PI).toFixed(0)}°`);
}

// Beat course must start close-hauled / beating so tacking matters.
{
  const beat = createCourse('beat');
  const twa = startTrueWindAngle(beat);
  assert(twa < (90 * Math.PI) / 180,
    `beat start should be upwindish: TWA ${((twa * 180) / Math.PI).toFixed(0)}°`);
  assert(beat.gates.some((g) => markKind(g) === 'round'), 'beat course needs a round mark');
}

// Port rounding: walk counterclockwise around the mark inside the radius.
{
  const roundCourse = createCourse('beat');
  const tracker = createMarkTracker(roundCourse.gates);
  // Skip start gate.
  const start = roundCourse.gates[0];
  const b = { x: start.x, z: start.z + 12 };
  tracker.reset(b);
  b.z = start.z - 8;
  assert(tracker.tryClear(b), 'clear start before rounding test');

  const mark = roundCourse.gates[1];
  assert(markKind(mark) === 'round', 'expected round mark');
  const r = mark.radius * 0.7;
  // Approach from south, then sweep CCW (port) around the mark.
  const steps = 36;
  let cleared = null;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 1.2;
    b.x = mark.x + Math.sin(a) * r;
    b.z = mark.z + Math.cos(a) * r;
    cleared = tracker.tryClear(b) || cleared;
  }
  assert(cleared && cleared.index === 1, 'port rounding should clear the windward mark');
}

// Wrong-way (starboard) loop must not clear a port-rounding mark.
{
  const roundCourse = createCourse('beat');
  const tracker = createMarkTracker(roundCourse.gates);
  const start = roundCourse.gates[0];
  const b = { x: start.x, z: start.z + 12 };
  tracker.reset(b);
  b.z = start.z - 8;
  tracker.tryClear(b);
  const mark = roundCourse.gates[1];
  const r = mark.radius * 0.7;
  for (let i = 0; i <= 36; i++) {
    const a = -Math.PI / 2 - (i / 36) * Math.PI * 1.2;
    b.x = mark.x + Math.sin(a) * r;
    b.z = mark.z + Math.cos(a) * r;
    assert(tracker.tryClear(b) === null, 'starboard loop must not clear port mark');
  }
}

assert(listCourses().length >= 3, 'expected at least 3 courses');

console.log('check-gates: ok');
