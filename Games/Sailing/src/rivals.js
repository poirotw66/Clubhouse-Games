// CPU rival helms with distinct skill — not just one bot with a mistake slider.

import { createBoatState, stepSailing } from './sailing.js';
import { createAssist, steerTo, wrap } from './assist.js';

/**
 * @typedef {object} RivalProfile
 * @property {string} id
 * @property {string} name
 * @property {number} skill 0..1 — heading accuracy / tack timing
 * @property {number} reaction delay before following a new recommendation (s)
 * @property {number} noise heading noise amplitude (rad)
 * @property {number} speedScale multiplies retained surge
 * @property {number[]} tint RGB 0..1 hull tint
 */

/** @type {RivalProfile[]} */
export const RIVAL_ROSTER = [
  {
    id: 'breeze',
    name: '微風',
    skill: 0.42,
    reaction: 0.55,
    noise: 0.28,
    speedScale: 0.88,
    tint: [0.55, 0.72, 0.95],
  },
  {
    id: 'reach',
    name: '橫風手',
    skill: 0.68,
    reaction: 0.32,
    noise: 0.16,
    speedScale: 0.96,
    tint: [0.95, 0.78, 0.35],
  },
  {
    id: 'gale',
    name: '烈風',
    skill: 0.9,
    reaction: 0.14,
    noise: 0.07,
    speedScale: 1.02,
    tint: [0.92, 0.42, 0.38],
  },
];

/**
 * @param {RivalProfile} profile
 * @param {{ x: number, z: number, heading: number }} start
 * @param {ReturnType<import('./marks.js').createMarkTracker>} tracker
 * @param {number} laneOffset lateral start offset (m)
 */
export function createRival(profile, start, tracker, laneOffset = 0) {
  const assist = createAssist();
  const boat = createBoatState(start.heading);
  placeAt(boat, start, laneOffset);

  let targetHeading = start.heading;
  let reactTimer = 0;
  let finished = false;
  let finishTime = null;
  /** @type {{ name: string, time: number }[]} */
  const splits = [];

  return {
    profile,
    boat,
    tracker,
    get finished() {
      return finished;
    },
    get finishTime() {
      return finishTime;
    },
    get splits() {
      return splits;
    },
    get nextIndex() {
      return tracker.nextIndex;
    },

    reset(courseStart, wind) {
      placeAt(boat, courseStart, laneOffset);
      boat.surge = 8.2 * profile.speedScale;
      boat.sway = 0;
      boat.yawRate = 0;
      boat.heel = 0;
      boat.trim = (45 * Math.PI) / 180;
      targetHeading = courseStart.heading;
      reactTimer = 0;
      finished = false;
      finishTime = null;
      splits.length = 0;
      tracker.reset(boat);
      assist.reset(boat, wind);
    },

    /**
     * @param {object} wind
     * @param {number} dt
     * @param {number} time
     * @param {number} waveAmp
     * @param {number} raceTime
     * @param {boolean} arcade
     * @param {number} gateCount
     */
    step(wind, dt, time, waveAmp, raceTime, arcade, gateCount) {
      if (finished) {
        stepSailing(
          boat,
          wind,
          { rudder: 0, trimDelta: 0, autoTrim: true },
          dt,
          time,
          waveAmp,
          arcade
        );
        return null;
      }

      const nextGate = tracker.nextGate;
      if (nextGate) {
        const rec = assist.recommend(boat, wind, nextGate, arcade);
        reactTimer -= dt;
        if (reactTimer <= 0) {
          const miss = (1 - profile.skill) * profile.noise;
          const jitter = (Math.sin(time * 3.1 + profile.skill * 9) * 0.5
            + Math.sin(time * 1.7 + laneOffset) * 0.5) * miss;
          let heading = rec.heading;
          if (rec.beating && profile.skill < 0.75) {
            const cling = (0.75 - profile.skill) * 0.35;
            heading = wrap(heading + cling * wrap(boat.heading - heading));
          }
          targetHeading = wrap(heading + jitter);
          reactTimer = profile.reaction * (0.7 + 0.6 * (1 - profile.skill));
        }
      }

      const rudder = steerTo(boat, targetHeading, 1.6 + profile.skill);
      const holdCourse = arcade && Math.abs(wrap(targetHeading - boat.heading)) < 0.35;
      stepSailing(
        boat,
        wind,
        { rudder, trimDelta: 0, autoTrim: true, holdCourse },
        dt,
        time,
        waveAmp,
        arcade
      );

      if (profile.speedScale !== 1) {
        boat.surge *= 1 + (profile.speedScale - 1) * dt * 0.35;
      }

      const cleared = tracker.tryClear(boat);
      if (!cleared) return null;

      splits.push({ name: cleared.cleared.name, time: raceTime });
      if (cleared.cleared.isFinish || tracker.nextIndex >= gateCount) {
        finished = true;
        finishTime = raceTime;
      }
      return cleared;
    },
  };
}

function placeAt(boat, start, laneOffset) {
  const rightX = Math.cos(start.heading);
  const rightZ = -Math.sin(start.heading);
  boat.x = start.x + rightX * laneOffset;
  boat.z = start.z + rightZ * laneOffset;
  boat.heading = start.heading;
}

/**
 * @param {number} seed
 * @returns {RivalProfile[]}
 */
export function pickRaceRivals(seed = 1) {
  // Always field the soft and hard skippers so skill contrast is obvious.
  return [RIVAL_ROSTER[0], RIVAL_ROSTER[2]];
}
