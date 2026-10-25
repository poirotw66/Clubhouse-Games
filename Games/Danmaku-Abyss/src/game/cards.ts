/**
 * Spell cards and midway patterns. Every entry here is data: a list of emitter
 * parameter sets. Nothing in this file contains behaviour, and adding a new
 * pattern never means touching engine.ts — which is the whole reason the pool
 * can be this size.
 *
 * Difficulty is NOT authored per stage. Each card is written once at its
 * natural shape and the engine's `intensity` scalar tightens it: more bullets,
 * shorter gaps, faster, and odd fixed sprays start tracking the player. So a
 * stage-1 card met again at stage 5 is the same idea turned vicious.
 *
 * Each boss's final card also carries PHASES: emitters that switch on as its HP
 * falls. Without them a card is a loop — whatever it opens with is what it does
 * for its whole timer, and the only thing that changes is your patience. With
 * them, breaking a threshold is what makes the fight worse, so pushing damage
 * becomes a decision instead of a formality. Note that some emitters moved from
 * the base set INTO a phase rather than being added on top: the last two cards
 * already ran three emitters at once from the opening second, which was
 * pressure without shape.
 *
 * The first draft of this file broke that rule while claiming it: stage-1 rings
 * were authored at 10-14 bullets and stage-5 rings at 24-26, so hand-written
 * escalation multiplied the scalar's escalation. The balance harness measured
 * the result as a wall rather than a curve — survival ran 100/100/88/88/13%
 * across the five stages while peak bullets on screen jumped 720 to 1701 on the
 * last one. Counts are now kept in a similar band across every boss; cards
 * differ by SHAPE (waveform, aim, rotation, timing), and the scalar alone
 * supplies the escalation.
 */
import type { Emitter, SpellCard } from './constants';

/** A field-spanning wall with a walking gap. Escalates by closing the gap, not by adding bullets. */
function wall(e: Partial<Emitter>): Emitter {
  return em({ pattern: 'wall', count: 14, gap: 3, speed: 105, interval: 2.2, lifetime: 9, bulletR: 5, ...e });
}

function em(e: Partial<Emitter>): Emitter {
  return {
    count: 8,
    spread: Math.PI * 2,
    speed: 90,
    angularVel: 0,
    aim: 'fixed',
    waveform: 'linear',
    interval: 0.9,
    delay: 0,
    lifetime: 9,
    bulletR: 4,
    hue: 200,
    ...e,
  };
}

// ── Midway patterns ──────────────────────────────────────────────────────────

/**
 * Midway curtains lean into the cover palette (magenta / orange / cyan) with
 * triple-layer spirals and rings. Speeds stay modest and bullet radii modest so
 * denser beauty stays fair against the tiny focus hitbox.
 */
const MIDWAY: Emitter[][] = [
  // Cyan chip ring + magenta flower + amber needles.
  [
    em({ count: 12, spread: Math.PI * 2, speed: 58, angularVel: 1.35, aim: 'rotating', interval: 0.55, hue: 190, bulletR: 3.4 }),
    em({ count: 10, spread: Math.PI * 2, speed: 52, waveform: 'spiral', angularVel: 0.9, interval: 0.7, hue: 310, bulletR: 3.6 }),
    em({ count: 4, spread: 0.7, speed: 105, aim: 'aimed', interval: 1.15, delay: 0.2, hue: 28, bulletR: 3.1 }),
  ],
  // Cover-style dual spiral wings (pink + orange) with cyan chips.
  [
    em({ count: 14, spread: Math.PI * 2, speed: 54, waveform: 'spiral', angularVel: 1.05, interval: 0.48, hue: 300, bulletR: 3.5 }),
    em({ count: 12, spread: Math.PI * 2, speed: 60, angularVel: -1.55, aim: 'rotating', interval: 0.58, delay: 0.12, hue: 28, bulletR: 3.3 }),
    em({ count: 10, spread: Math.PI * 2, speed: 48, angularVel: 0.7, aim: 'rotating', interval: 0.85, delay: 0.28, hue: 185, bulletR: 3.2 }),
  ],
  // Orange accel bloom under a cyan curtain.
  [
    em({ count: 13, spread: Math.PI * 2, speed: 56, angularVel: 1.8, aim: 'rotating', interval: 0.52, hue: 185, bulletR: 3.4 }),
    em({ count: 11, spread: Math.PI * 2, speed: 50, waveform: 'accel', interval: 0.75, hue: 22, bulletR: 3.5 }),
    em({ count: 4, spread: 0.45, speed: 118, aim: 'aimed', interval: 1.0, delay: 0.18, hue: 320, bulletR: 3.1 }),
  ],
  // Magenta accel flower + amber ring.
  [
    em({ count: 14, spread: Math.PI * 2, speed: 50, waveform: 'accel', interval: 0.62, hue: 320, bulletR: 3.6 }),
    em({ count: 10, spread: Math.PI * 2, speed: 58, angularVel: -1.3, aim: 'rotating', interval: 0.7, delay: 0.2, hue: 40, bulletR: 3.3 }),
    em({ count: 8, spread: 1.8, speed: 88, waveform: 'reverse', interval: 1.1, delay: 0.35, hue: 200, bulletR: 3.2 }),
  ],
  // Counter-rotating cyan / pink / amber rings (dense weave).
  [
    em({ count: 13, spread: Math.PI * 2, speed: 58, angularVel: 2.2, aim: 'rotating', interval: 0.48, hue: 175, bulletR: 3.3 }),
    em({ count: 13, spread: Math.PI * 2, speed: 58, angularVel: -2.2, aim: 'rotating', interval: 0.48, delay: 0.16, hue: 305, bulletR: 3.3 }),
    em({ count: 9, spread: Math.PI * 2, speed: 46, waveform: 'spiral', angularVel: 0.8, interval: 0.8, delay: 0.3, hue: 30, bulletR: 3.4 }),
  ],
  // Reverse spray framed by dual rings.
  [
    em({ count: 10, spread: 1.8, speed: 88, waveform: 'reverse', interval: 0.95, hue: 45, lifetime: 7.5, bulletR: 3.3 }),
    em({ count: 12, spread: Math.PI * 2, speed: 55, angularVel: 1.4, aim: 'rotating', interval: 0.6, delay: 0.15, hue: 280, bulletR: 3.5 }),
    em({ count: 10, spread: Math.PI * 2, speed: 50, angularVel: -1.1, aim: 'rotating', interval: 0.72, delay: 0.35, hue: 190, bulletR: 3.2 }),
  ],
  // Teaching wall still readable (wide gap), dressed in a cover curtain.
  [
    wall({ speed: 74, interval: 2.5, gap: 4, hue: 200, bulletR: 4.2 }),
    em({ count: 12, spread: Math.PI * 2, speed: 48, angularVel: 1.15, aim: 'rotating', interval: 0.7, delay: 0.25, hue: 310, bulletR: 3.3 }),
    em({ count: 10, spread: Math.PI * 2, speed: 52, angularVel: -0.95, aim: 'rotating', interval: 0.85, delay: 0.45, hue: 30, bulletR: 3.2 }),
  ],
];

export function midwayCardFor(stage: number, salt: number): SpellCard {
  const emitters = MIDWAY[(stage + salt) % MIDWAY.length];
  return {
    id: `midway-${(stage + salt) % MIDWAY.length}`,
    name: '道中',
    timeLimit: 999,
    hp: 26 + stage * 14,
    emitters,
  };
}

// ── Bosses ───────────────────────────────────────────────────────────────────

export interface Boss {
  name: string;
  cards: SpellCard[];
}

function card(id: string, name: string, hp: number, timeLimit: number, emitters: Emitter[]): SpellCard {
  return { id, name, hp, timeLimit, emitters };
}

const BOSSES: Boss[] = [
  {
    name: '燈守',
    cards: [
      card('lamp-1', '燈符「環巡」', 900, 30, [
        em({ count: 14, spread: Math.PI * 2, speed: 68, angularVel: 1.55, aim: 'rotating', interval: 0.42, hue: 195 }),
        em({ count: 12, spread: Math.PI * 2, speed: 58, waveform: 'spiral', angularVel: 0.85, interval: 0.55, delay: 0.2, hue: 310 }),
        em({ count: 4, spread: 0.55, speed: 118, aim: 'aimed', interval: 1.35, delay: 2.2, hue: 40 }),
      ]),
      card('lamp-2', '灯符「夜盲」', 1200, 34, [
        em({ count: 14, spread: Math.PI * 2, speed: 62, waveform: 'spiral', angularVel: 1.05, interval: 0.52, hue: 265 }),
        em({ count: 12, spread: Math.PI * 2, speed: 70, angularVel: -1.6, aim: 'rotating', interval: 0.5, delay: 0.15, hue: 30 }),
        em({ count: 5, spread: 1.2, speed: 110, aim: 'aimed', interval: 1.2, delay: 1.8, hue: 190 }),
      ]),
      // Stage 1 used to stop at two cards while every other stage had three,
      // which made the opening stage noticeably shorter than the rest for no
      // designed reason.
      {
        ...card('lamp-3', '灼符「殘照」', 1450, 36, [
          em({ count: 13, spread: Math.PI * 2, speed: 72, angularVel: 2.0, aim: 'rotating', interval: 0.48, hue: 35 }),
          em({ count: 11, spread: Math.PI * 2, speed: 60, waveform: 'accel', interval: 0.7, delay: 0.2, hue: 320 }),
          em({ count: 4, spread: 0.7, speed: 130, aim: 'aimed', interval: 1.1, delay: 2.2, hue: 200 }),
        ]),
        phases: [{ belowHpFrac: 0.5, emitters: [em({ count: 8, spread: 1.4, speed: 105, waveform: 'accel', interval: 0.95, hue: 300 })] }],
      },
      // Beacon + walking gap: teach reading a safe lane under a slow rotating ring.
      {
        ...card('lamp-4', '灯符「導標」', 1350, 34, [
          em({ count: 13, spread: Math.PI * 2, speed: 66, angularVel: 1.35, aim: 'rotating', interval: 0.5, hue: 200 }),
          em({ count: 10, spread: Math.PI * 2, speed: 55, waveform: 'spiral', angularVel: -0.9, interval: 0.7, delay: 0.25, hue: 310 }),
          wall({ speed: 84, interval: 2.5, gap: 4, hue: 45 }),
        ]),
        phases: [
          {
            belowHpFrac: 0.45,
            emitters: [em({ count: 5, spread: 0.55, speed: 140, aim: 'aimed', interval: 1.05, hue: 30, bulletR: 3.3 })],
          },
        ],
      },
    ],
  },
  {
    name: '潮鳴',
    cards: [
      card('tide-1', '潮符「引汐」', 1100, 30, [
        em({ count: 12, spread: 2.4, speed: 86, waveform: 'reverse', interval: 0.85, hue: 200, lifetime: 8 }),
        em({ count: 11, spread: Math.PI * 2, speed: 62, angularVel: 1.4, aim: 'rotating', interval: 0.55, delay: 0.2, hue: 310 }),
        em({ count: 4, spread: 0.8, speed: 132, aim: 'aimed', interval: 1.3, delay: 2.0, hue: 30 }),
      ]),
      card('tide-2', '波符「碎浪」', 1400, 34, [
        em({ count: 14, spread: Math.PI * 2, speed: 74, angularVel: -1.95, aim: 'rotating', interval: 0.4, hue: 170 }),
        em({ count: 11, spread: Math.PI * 2, speed: 58, waveform: 'accel', interval: 0.7, delay: 0.2, hue: 30 }),
        em({ count: 5, spread: 1.4, speed: 118, aim: 'aimed', interval: 1.15, delay: 2.2, hue: 320 }),
      ]),
      {
        ...card('tide-3', '深符「暗流」', 1700, 38, [
          em({ count: 14, spread: Math.PI * 2, speed: 66, waveform: 'spiral', angularVel: 1.45, interval: 0.48, hue: 245 }),
          em({ count: 11, spread: Math.PI * 2, speed: 70, angularVel: -1.7, aim: 'rotating', interval: 0.55, delay: 0.18, hue: 190 }),
          em({ count: 4, spread: 0.34, speed: 160, aim: 'aimed', interval: 0.9, delay: 1.3, hue: 15, bulletR: 3.2 }),
        ]),
        phases: [
          { belowHpFrac: 0.6, emitters: [em({ count: 9, spread: 2.0, speed: 92, waveform: 'reverse', interval: 1.1, hue: 190 })] },
          { belowHpFrac: 0.3, emitters: [em({ count: 12, spread: Math.PI * 2, speed: 80, angularVel: -2.4, aim: 'rotating', interval: 0.65, hue: 330 })] },
        ],
      },
      // Cross-current: reverse spray intersecting a slow spiral — read both clocks.
      {
        ...card('tide-4', '潮符「交錯」', 1600, 36, [
          em({ count: 12, spread: 2.2, speed: 92, waveform: 'reverse', interval: 0.9, hue: 185, lifetime: 8 }),
          em({ count: 13, spread: Math.PI * 2, speed: 68, waveform: 'spiral', angularVel: 1.25, interval: 0.55, hue: 220 }),
          em({ count: 10, spread: Math.PI * 2, speed: 60, angularVel: -1.5, aim: 'rotating', interval: 0.65, delay: 0.2, hue: 40 }),
        ]),
        phases: [
          {
            belowHpFrac: 0.4,
            emitters: [em({ count: 5, spread: 0.7, speed: 150, aim: 'aimed', interval: 0.95, hue: 320, bulletR: 3.3 })],
          },
        ],
      },
    ],
  },
  {
    name: '刃霜',
    cards: [
      card('frost-1', '霜符「銀線」', 1500, 32, [
        em({ count: 7, spread: 0.9, speed: 138, aim: 'aimed', interval: 0.9, hue: 185, bulletR: 3.3 }),
        em({ count: 13, spread: Math.PI * 2, speed: 70, angularVel: 2.5, aim: 'rotating', interval: 0.45, hue: 300 }),
        em({ count: 11, spread: Math.PI * 2, speed: 58, waveform: 'spiral', angularVel: -1.1, interval: 0.6, delay: 0.2, hue: 40 }),
      ]),
      card('frost-2', '刃符「割雪」', 1800, 36, [
        em({ count: 14, spread: Math.PI * 2, speed: 76, waveform: 'spiral', angularVel: -1.75, interval: 0.42, hue: 210 }),
        em({ count: 12, spread: Math.PI * 2, speed: 68, angularVel: 2.0, aim: 'rotating', interval: 0.5, delay: 0.15, hue: 310 }),
        em({ count: 6, spread: 1.0, speed: 118, waveform: 'reverse', interval: 1.05, delay: 1.6, hue: 50 }),
      ]),
      {
        ...card('frost-3', '凍符「靜止的雨」', 2100, 40, [
          em({ count: 14, spread: Math.PI * 2, speed: 58, waveform: 'reverse', interval: 1.15, hue: 195, lifetime: 10 }),
          em({ count: 12, spread: Math.PI * 2, speed: 64, angularVel: 1.6, aim: 'rotating', interval: 0.55, delay: 0.2, hue: 280 }),
          em({ count: 5, spread: 0.6, speed: 155, aim: 'aimed', interval: 0.8, delay: 0.9, hue: 350 }),
        ]),
        phases: [
          { belowHpFrac: 0.55, emitters: [wall({ speed: 88, interval: 2.3, gap: 3, hue: 195 })] },
          { belowHpFrac: 0.25, emitters: [em({ count: 6, spread: 0.8, speed: 145, aim: 'aimed', interval: 0.85, hue: 20, bulletR: 3.2 })] },
        ],
      },
      // Twin counter-rotating rings that force a weave, not a hold.
      {
        ...card('frost-4', '霜符「雙弦」', 2000, 38, [
          em({ count: 13, spread: Math.PI * 2, speed: 76, angularVel: 2.7, aim: 'rotating', interval: 0.42, hue: 185 }),
          em({ count: 13, spread: Math.PI * 2, speed: 76, angularVel: -2.7, aim: 'rotating', interval: 0.42, delay: 0.22, hue: 310 }),
          em({ count: 10, spread: Math.PI * 2, speed: 55, waveform: 'spiral', angularVel: 0.9, interval: 0.7, delay: 0.35, hue: 40 }),
        ]),
        phases: [
          {
            belowHpFrac: 0.45,
            emitters: [em({ count: 5, spread: 0.55, speed: 155, aim: 'aimed', interval: 0.95, hue: 40, bulletR: 3.3 })],
          },
        ],
      },
    ],
  },
  {
    name: '燼裔',
    cards: [
      card('ember-1', '燼符「餘火」', 1900, 32, [
        em({ count: 14, spread: Math.PI * 2, speed: 78, waveform: 'accel', interval: 0.55, hue: 20 }),
        em({ count: 12, spread: Math.PI * 2, speed: 66, angularVel: 1.8, aim: 'rotating', interval: 0.5, delay: 0.15, hue: 300 }),
        em({ count: 6, spread: 1.3, speed: 115, aim: 'aimed', interval: 1.05, delay: 1.6, hue: 45 }),
      ]),
      card('ember-2', '炎符「捲舌」', 2200, 36, [
        em({ count: 14, spread: Math.PI * 2, speed: 74, angularVel: 3.1, aim: 'rotating', interval: 0.36, hue: 12 }),
        em({ count: 12, spread: 2.0, speed: 88, waveform: 'spiral', angularVel: 1.25, interval: 0.65, delay: 0.2, hue: 300 }),
        em({ count: 8, spread: Math.PI * 2, speed: 60, angularVel: -1.5, aim: 'rotating', interval: 0.7, delay: 1.8, hue: 40 }),
      ]),
      {
        ...card('ember-3', '滅符「回燒」', 2600, 40, [
          em({ count: 12, spread: 1.8, speed: 122, waveform: 'reverse', interval: 0.75, hue: 35, lifetime: 9 }),
          em({ count: 14, spread: Math.PI * 2, speed: 66, waveform: 'spiral', angularVel: -2.15, interval: 0.48, delay: 0.25, hue: 265 }),
          em({ count: 10, spread: Math.PI * 2, speed: 72, angularVel: 2.0, aim: 'rotating', interval: 0.55, delay: 1.2, hue: 20 }),
        ]),
        phases: [
          { belowHpFrac: 0.5, emitters: [wall({ speed: 98, interval: 2.0, gap: 3, hue: 35 })] },
          { belowHpFrac: 0.2, emitters: [em({ count: 11, spread: Math.PI * 2, speed: 88, angularVel: 3.3, aim: 'rotating', interval: 0.48, hue: 45 })] },
        ],
      },
      // Ember bloom: accel ring that opens soft then snaps — punish standing still.
      {
        ...card('ember-4', '燼符「花開」', 2400, 38, [
          em({ count: 14, spread: Math.PI * 2, speed: 60, waveform: 'accel', interval: 0.62, hue: 18 }),
          em({ count: 12, spread: Math.PI * 2, speed: 70, angularVel: 2.2, aim: 'rotating', interval: 0.5, delay: 0.18, hue: 300 }),
          em({ count: 6, spread: 1.4, speed: 112, aim: 'aimed', interval: 1.05, delay: 1.5, hue: 40 }),
        ]),
        phases: [
          {
            belowHpFrac: 0.5,
            emitters: [
              em({ count: 12, spread: Math.PI * 2, speed: 82, angularVel: 2.9, aim: 'rotating', interval: 0.45, hue: 8 }),
            ],
          },
          {
            belowHpFrac: 0.22,
            emitters: [wall({ speed: 102, interval: 1.9, gap: 3, hue: 25 })],
          },
        ],
      },
    ],
  },
  {
    name: '深淵',
    cards: [
      card('abyss-1', '淵符「無底」', 2400, 34, [
        em({ count: 14, spread: Math.PI * 2, speed: 70, waveform: 'spiral', angularVel: 1.65, interval: 0.34, hue: 250 }),
        em({ count: 13, spread: Math.PI * 2, speed: 62, angularVel: -1.8, aim: 'rotating', interval: 0.4, delay: 0.12, hue: 30 }),
        em({ count: 5, spread: 0.9, speed: 145, aim: 'aimed', interval: 0.82, delay: 1.4, hue: 190 }),
      ]),
      card('abyss-2', '闇符「不返」', 2800, 38, [
        em({ count: 14, spread: 2.6, speed: 100, waveform: 'reverse', interval: 0.58, hue: 275, lifetime: 9 }),
        em({ count: 14, spread: Math.PI * 2, speed: 76, angularVel: -2.7, aim: 'rotating', interval: 0.34, hue: 210 }),
        em({ count: 12, spread: Math.PI * 2, speed: 58, waveform: 'spiral', angularVel: 1.2, interval: 0.45, delay: 0.15, hue: 320 }),
      ]),
      {
        ...card('abyss-3', '終符「深淵回望」', 3400, 45, [
          em({ count: 14, spread: Math.PI * 2, speed: 72, waveform: 'spiral', angularVel: 2.35, interval: 0.32, hue: 265 }),
          em({ count: 13, spread: 2.2, speed: 108, waveform: 'accel', interval: 0.52, delay: 0.2, hue: 320 }),
          em({ count: 12, spread: Math.PI * 2, speed: 66, angularVel: -2.0, aim: 'rotating', interval: 0.42, delay: 1.2, hue: 40 }),
        ]),
        phases: [
          { belowHpFrac: 0.66, emitters: [em({ count: 5, spread: 0.42, speed: 175, aim: 'aimed', interval: 0.6, hue: 0, bulletR: 3.2 })] },
          {
            belowHpFrac: 0.33,
            emitters: [
              em({ count: 13, spread: Math.PI * 2, speed: 82, angularVel: -2.9, aim: 'rotating', interval: 0.42, hue: 175 }),
              wall({ speed: 108, interval: 1.7, gap: 3, hue: 265 }),
            ],
          },
        ],
      },
      // Walking walls + ring + reverse spray — deny lanes, then punish the dodge.
      // Density kept in the same band as sibling abyss cards so stage-average pressure
      // (used by the balance self-check) does not dilute when the card is added.
      {
        ...card('abyss-4', '淵符「裂壁」', 3000, 42, [
          wall({ speed: 98, interval: 1.5, gap: 3, hue: 255 }),
          em({ count: 14, spread: Math.PI * 2, speed: 74, angularVel: 2.5, aim: 'rotating', interval: 0.34, hue: 270 }),
          em({ count: 12, spread: 2.0, speed: 100, waveform: 'reverse', interval: 0.65, delay: 0.55, hue: 290, lifetime: 8 }),
        ]),
        phases: [
          {
            belowHpFrac: 0.5,
            emitters: [
              wall({ speed: 108, interval: 1.45, gap: 3, hue: 210 }),
              em({ count: 6, spread: 0.7, speed: 160, aim: 'aimed', interval: 0.78, hue: 15, bulletR: 3.2 }),
            ],
          },
        ],
      },
    ],
  },
];

export function bossFor(stage: number): Boss {
  return BOSSES[Math.min(BOSSES.length - 1, Math.max(0, stage - 1))];
}

export const ALL_BOSSES = BOSSES;

/** Every authored spell card, for the self-check's coverage assertions. */
export function allCards(): SpellCard[] {
  return BOSSES.flatMap((b) => b.cards);
}
