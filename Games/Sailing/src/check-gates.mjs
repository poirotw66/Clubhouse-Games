// ponytail: gate crossing self-check (no test framework).

import { createCourse, gateLocal } from './marks.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Mock minimal WebGL solid/marks draw path — only exercise tryClear geometry.
const course = createCourse();
assert(course.gates.length >= 4, 'expected a multi-gate course');
assert(course.gates[0].isStart, 'first gate should be start');
assert(course.gates.at(-1).isFinish, 'last gate should be finish');

const marks = {
  nextIndex: 0,
  gates: course.gates,
  prevAlong: null,
  reset(boat) {
    this.nextIndex = 0;
    this.prevAlong = gateLocal(boat, course.gates[0]).along;
  },
  tryClear(boat) {
    if (this.nextIndex >= course.gates.length) return null;
    const gate = course.gates[this.nextIndex];
    const local = gateLocal(boat, gate);
    if (this.prevAlong === null) {
      this.prevAlong = local.along;
      return null;
    }
    const within = Math.abs(local.across) <= gate.halfWidth * 1.05;
    const crossed = this.prevAlong < 0.4 && local.along >= 0.4 && within;
    this.prevAlong = local.along;
    if (!crossed) return null;
    const cleared = gate;
    const index = this.nextIndex;
    this.nextIndex += 1;
    if (this.nextIndex < course.gates.length) {
      this.prevAlong = gateLocal(boat, course.gates[this.nextIndex]).along;
    }
    return { cleared, index };
  },
};

const startGate = course.gates[0];
const boat = { x: startGate.x, z: startGate.z + 20 };
marks.reset(boat);
assert(gateLocal(boat, startGate).along < 0, 'boat should start behind start gate');

// Miss laterally — should not clear.
boat.x = startGate.x + startGate.halfWidth + 8;
boat.z = startGate.z + 10;
marks.prevAlong = gateLocal(boat, startGate).along;
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

console.log('check-gates: ok');
