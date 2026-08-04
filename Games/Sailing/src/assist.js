// Navigation assist for the easy mode.
//
// The hard part of this game isn't the steering, it's knowing *where to point*:
// when the next gate is upwind you can't sail at it, and a beginner has no way
// to work out which zig-zag leg to be on. This module answers that question —
// it returns the heading the boat should actually be steered to, and the HUD
// draws it as an arrow to follow.

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Best upwind VMG for this hull sits at ~60° off the true wind (measured off
// the force model in check-assist). Downwind the best VMG is dead at the mark,
// so only the beat needs laylines.
export const BEAT_TWA = (60 * Math.PI) / 180;
// Arcade easy: point closer to the mark so the zig-zag actually closes.
const ARCADE_BEAT_TWA = (48 * Math.PI) / 180;
const ARCADE_APPROACH = 80; // metres: abandon the beat and aim at the gate

// How far the mark must swing across the wind before the recommendation
// switches tack. Without this the arrow flip-flops when the mark is dead
// upwind and `sign(off)` chatters around zero.
const TACK_HYSTERESIS = BEAT_TWA * 0.3;

export function createAssist() {
  let tack = 1;

  return {
    get tack() {
      return tack;
    },

    /** Re-seed the favoured tack from where the boat is actually pointing. */
    reset(boat, wind) {
      tack = Math.sign(wrap(boat.heading - wind.from)) || 1;
    },

    /**
     * The heading that makes best progress toward `gate`.
     * → { heading, beating, tack, turn }, where `turn` is the signed error from
     *   the current heading (radians, +ve = steer right).
     * `arcade`: easy-mode path — softer beat, lean toward the mark, and aim
     * straight at the gate on final approach.
     */
    recommend(boat, wind, gate, arcade = false) {
      const bearing = Math.atan2(gate.x - boat.x, gate.z - boat.z);
      const dist = Math.hypot(gate.x - boat.x, gate.z - boat.z);
      const off = wrap(bearing - wind.from);
      const beatAngle = arcade ? ARCADE_BEAT_TWA : BEAT_TWA;
      const beating = Math.abs(off) < beatAngle;

      // Final approach: ignore the beat and drive at the posts.
      if (arcade && dist < ARCADE_APPROACH) {
        return {
          heading: bearing,
          beating: false,
          tack,
          turn: wrap(bearing - boat.heading),
          approach: true,
        };
      }

      let heading = bearing;
      if (beating) {
        const want = Math.sign(off || tack);
        const hyst = arcade ? beatAngle * 0.18 : TACK_HYSTERESIS;
        if (want !== tack && Math.abs(off) > hyst) tack = want;
        heading = wrap(wind.from + beatAngle * tack);
        if (arcade) {
          // Lean toward the mark so each leg actually closes distance.
          heading = wrap(heading + 0.45 * wrap(bearing - heading));
          const twa = wrap(heading - wind.from);
          const minTwa = (26 * Math.PI) / 180;
          if (Math.abs(twa) < minTwa) {
            heading = wrap(wind.from + minTwa * (Math.sign(twa) || tack));
          }
        }
      }

      return {
        heading,
        beating,
        tack,
        turn: wrap(heading - boat.heading),
        approach: false,
      };
    },

    /**
     * Heading on the other side of the wind, for the one-key tack. Mirrors the
     * current wind angle, but never lands inside the no-go zone — tacking out
     * of irons has to leave you somewhere the sail actually pulls.
     */
    otherTack(boat, wind) {
      const off = wrap(boat.heading - wind.from);
      const mag = Math.max(Math.abs(off), BEAT_TWA);
      tack = -(Math.sign(off) || 1);
      return wrap(wind.from + mag * tack);
    },
  };
}

/**
 * Rudder needed to settle on `target`, as a -1..1 input. Deliberately firm:
 * an assisted tack has to carry the bow through the wind rather than stalling
 * head to wind halfway round.
 */
export function steerTo(boat, target, gain = 2.2) {
  const err = wrap(target - boat.heading);
  return Math.max(-1, Math.min(1, err * gain));
}

export { wrap };
