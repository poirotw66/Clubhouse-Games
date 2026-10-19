// Multi-course catalogue for 海灣帆航.
// Each course has distinct wind conditions and mark geometry so line choice,
// tacking, and gust timing matter differently.

/** @typedef {'gate'|'round'} MarkKind */
/** @typedef {'port'|'starboard'} LeaveTo */

/**
 * @typedef {object} CourseMark
 * @property {number} id
 * @property {string} name
 * @property {MarkKind} [kind] default 'gate'
 * @property {number} x
 * @property {number} z
 * @property {number} [facing] gate: sail-through direction
 * @property {number} [halfWidth] gate half-span (m)
 * @property {number} [radius] round mark clear radius (m)
 * @property {LeaveTo} [leaveTo] round mark leave-to side
 * @property {boolean} [isStart]
 * @property {boolean} [isFinish]
 */

/**
 * @typedef {object} WindProfile
 * @property {number} baseFrom
 * @property {number} baseSpeed
 * @property {number} shiftAmp
 * @property {number} shiftRate
 * @property {number} gustAmp
 * @property {number} gustRate
 * @property {number} stepPeriod  seconds between discrete shifts (0 = none)
 * @property {number} stepAmp
 */

/**
 * @typedef {object} CourseDef
 * @property {string} id
 * @property {string} name
 * @property {string} blurb
 * @property {string|null} unlockAfter  course id that must be finished once
 * @property {WindProfile} wind
 * @property {{ x: number, z: number, heading: number }} start
 * @property {CourseMark[]} gates
 */

const D = (deg) => (deg * Math.PI) / 180;

/** @type {CourseDef[]} */
export const COURSES = [
  {
    id: 'harbor',
    name: '海灣環線',
    blurb: '順風起航，穿門練習；風向緩移，適合熱身。',
    unlockAfter: null,
    wind: {
      baseFrom: D(80),
      baseSpeed: 7.0,
      shiftAmp: 0.18,
      shiftRate: 0.055,
      gustAmp: 1.1,
      gustRate: 0.13,
      stepPeriod: 18,
      stepAmp: 0.22,
    },
    start: { x: 22, z: 48, heading: D(-100) },
    gates: [
      { id: 0, name: '起航門', kind: 'gate', x: 0, z: 40, facing: Math.PI, halfWidth: 16, isStart: true },
      { id: 1, name: '檢查點 1', kind: 'gate', x: -55, z: 5, facing: -Math.PI * 0.7, halfWidth: 16 },
      { id: 2, name: '檢查點 2', kind: 'gate', x: -35, z: -70, facing: -Math.PI * 0.2, halfWidth: 16 },
      { id: 3, name: '檢查點 3', kind: 'gate', x: 40, z: -95, facing: Math.PI * 0.35, halfWidth: 16 },
      { id: 4, name: '檢查點 4', kind: 'gate', x: 70, z: -25, facing: Math.PI * 0.75, halfWidth: 16 },
      { id: 5, name: '終點門', kind: 'gate', x: 0, z: 40, facing: 0, halfWidth: 16, isFinish: true },
    ],
  },
  {
    id: 'beat',
    name: '迎風折返',
    blurb: '搶風上頂標、左舷繞標，再順風回航——換舷與航線決勝。',
    unlockAfter: 'harbor',
    wind: {
      // Wind from +Z (south); windward mark sits upwind at −Z.
      baseFrom: Math.PI,
      baseSpeed: 7.6,
      shiftAmp: 0.28,
      shiftRate: 0.048,
      gustAmp: 1.55,
      gustRate: 0.11,
      stepPeriod: 14,
      stepAmp: 0.38,
    },
    // Start on starboard tack-ish, not dead upwind — first decision is when to tack.
    start: { x: 28, z: 55, heading: D(-145) },
    gates: [
      { id: 0, name: '起航門', kind: 'gate', x: 0, z: 42, facing: Math.PI, halfWidth: 18, isStart: true },
      {
        id: 1,
        name: '頂標（左舷繞）',
        kind: 'round',
        x: 0,
        z: -95,
        radius: 10,
        leaveTo: 'port',
      },
      { id: 2, name: '尾標門', kind: 'gate', x: 0, z: 48, facing: 0, halfWidth: 18 },
      { id: 3, name: '終點門', kind: 'gate', x: 0, z: 42, facing: Math.PI, halfWidth: 16, isFinish: true },
    ],
  },
  {
    id: 'island',
    name: '繞島三角',
    blurb: '三角航線＋強陣風；橫風腿拉開差距，繞標不可切角。',
    unlockAfter: 'beat',
    wind: {
      baseFrom: D(210),
      baseSpeed: 8.2,
      shiftAmp: 0.34,
      shiftRate: 0.062,
      gustAmp: 2.1,
      gustRate: 0.16,
      stepPeriod: 11,
      stepAmp: 0.45,
    },
    start: { x: -10, z: 70, heading: D(-20) },
    gates: [
      { id: 0, name: '起航門', kind: 'gate', x: 0, z: 55, facing: Math.PI, halfWidth: 15, isStart: true },
      {
        id: 1,
        name: '東島標',
        kind: 'round',
        x: 85,
        z: 10,
        radius: 9,
        leaveTo: 'port',
      },
      {
        id: 2,
        name: '南島標',
        kind: 'round',
        x: 10,
        z: -90,
        radius: 9,
        leaveTo: 'port',
      },
      {
        id: 3,
        name: '西島標',
        kind: 'round',
        x: -75,
        z: -5,
        radius: 9,
        leaveTo: 'port',
      },
      { id: 4, name: '終點門', kind: 'gate', x: 0, z: 55, facing: 0, halfWidth: 15, isFinish: true },
    ],
  },
];

export const COURSE_BY_ID = Object.fromEntries(COURSES.map((c) => [c.id, c]));

export function listCourses() {
  return COURSES.slice();
}

/** Deep-ish copy so race code can widen gates without mutating the catalogue. */
export function createCourse(courseId = 'harbor') {
  const def = COURSE_BY_ID[courseId] || COURSE_BY_ID.harbor;
  return {
    id: def.id,
    name: def.name,
    blurb: def.blurb,
    unlockAfter: def.unlockAfter,
    wind: { ...def.wind },
    start: { ...def.start },
    gates: def.gates.map((g) => ({ ...g })),
  };
}

/** True wind angle at course start (0 = head to wind, π = run). */
export function startTrueWindAngle(course) {
  const off = Math.atan2(
    Math.sin(course.start.heading - course.wind.baseFrom),
    Math.cos(course.start.heading - course.wind.baseFrom)
  );
  return Math.abs(off);
}

export function courseRequiresBeat(course) {
  return startTrueWindAngle(course) < (75 * Math.PI) / 180;
}
