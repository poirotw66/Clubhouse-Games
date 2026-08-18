/**
 * Balance measurement harness. Not a pass/fail test — it prints numbers.
 * Run: node --experimental-strip-types src/balance.mjs
 *
 * The whole point is to hold everything constant except ONE variable at a
 * time. Tower placement is therefore a fixed slot list for every run: the
 * only things that differ between rows are the tower *mix* and the overlap
 * policy. If placement were also policy-driven, a "mix A beats mix B" result
 * could just as easily be "policy A found better cells", and the comparison
 * would mean nothing.
 */
import { DIFFICULTIES, FIXED_DT, TOTAL_WAVES, TOWER_DEFS } from './game/constants.ts';
import { purchaseCost, upgradeCost, waveClearBonus } from './game/economy.ts';
import {
  createInitialState,
  placeTower,
  startNextWave,
  step,
  unresolvedCount,
  upgradeTower,
} from './game/engine.ts';

/**
 * Cells flanking the straight entrance-to-exit corridor on the open map, so
 * every tower in every run has line of sight on the path. Ordered so early
 * money lands in the middle of the map (where it covers the most travel)
 * rather than at one end.
 */
const SLOTS = [
  [4, 3], [4, 5], [6, 3], [6, 5], [2, 3], [2, 5], [8, 3], [8, 5],
  [3, 3], [3, 5], [5, 3], [5, 5], [7, 3], [7, 5], [9, 3], [9, 5],
];

/**
 * Spends whatever gold is on hand. Runs every tick, in both phases, because the
 * engine allows building mid-wave and a policy that only spent during prep was
 * unfair to overlap: an overlapping run rarely returns to prep, so it finished
 * a 20-wave attempt having built 3 towers against the non-overlapping run's 16.
 * That measured the harness, not the mechanic.
 *
 * Fills the slot list
 * first, then pour the rest into upgrades, cheapest upgrade first. Deliberately
 * dumb and identical across every row of the table.
 */
function spend(state, mix) {
  let s = state;
  let placedAny = true;
  while (placedAny) {
    placedAny = false;

    // 1) Place the next tower in the mix rotation, if a slot and the gold exist.
    const slotIndex = s.towers.length;
    if (slotIndex < SLOTS.length) {
      const type = mix[slotIndex % mix.length];
      if (s.gold >= purchaseCost(type)) {
        const [x, y] = SLOTS[slotIndex];
        const r = placeTower(s, x, y, type);
        if (r.ok) {
          s = r.state;
          placedAny = true;
          continue;
        }
      }
    }

    // 2) Otherwise upgrade the cheapest upgradable tower we can afford.
    const candidates = s.towers
      .filter((t) => t.level < 2)
      .map((t) => ({ t, cost: upgradeCost(t.type, t.level) }))
      .filter((c) => c.cost !== null && c.cost <= s.gold)
      .sort((a, b) => a.cost - b.cost || a.t.id - b.t.id);
    if (candidates.length > 0) {
      const r = upgradeTower(s, candidates[0].t.id);
      if (r.ok) {
        s = r.state;
        placedAny = true;
      }
    }
  }
  return s;
}

/** Plays one full run and reports where it ended plus where its gold came from. */
/**
 * `overlap` is the policy for 強行加壓 — stacking the next wave on top of the
 * running one:
 *   'never'  — always let a wave finish first.
 *   'always' — call the moment the phase allows it, taking the maximum bonus
 *              and the maximum risk. This is the policy that used to be free.
 *   'safe'   — call only while few enemies are still unresolved, i.e. take the
 *              small bonus when the board is nearly clear.
 */
function run({ mix, overlap = 'never', difficulty = 'standard', endless = false, waveCap = Infinity }) {
  let state = createInitialState(difficulty, 'open', endless);
  let overlapGold = 0;
  let clearGold = 0;
  let killGold = 0;
  let spentGold = 0;
  let guard = 0;
  // Endless runs are only bounded by the tick guard, and a run that hits the
  // guard looks exactly like a loss in `state.wave` — which is how the first
  // version of this harness reported "every mix dies at wave 100" when what
  // actually happened was the guard tripping. waveCap makes the stopping
  // condition explicit and `ranAway` reports it, so the two never get confused.
  const GUARD_TICKS = 4_000_000;

  while (state.phase !== 'lost' && state.phase !== 'won' && state.wave <= waveCap && guard < GUARD_TICKS) {
    const beforeSpend = state.gold;
    state = spend(state, mix);
    spentGold += beforeSpend - state.gold;

    if (state.phase === 'prep') {
      const r = startNextWave(state);
      if (!r.ok) break;
      state = r.state;
    } else {
      // Overlap decision, taken before the tick so the bonus is read off the
      // same board the player would be looking at.
      // The engine only allows the call once the wave has fully spawned, so
      // this reads the same board a player would be deciding from.
      const callable = state.pendingSpawns.length === 0;
      const unresolved = unresolvedCount(state);
      const wantsOverlap =
        callable &&
        ((overlap === 'always' && unresolved > 0) || (overlap === 'safe' && unresolved > 0 && unresolved <= 4));
      if (wantsOverlap && (endless || state.wave < TOTAL_WAVES)) {
        const beforeCall = state.gold;
        const r = startNextWave(state);
        if (r.ok) {
          overlapGold += r.state.gold - beforeCall;
          state = r.state;
        }
      }

      const before = state.gold;
      const beforePhase = state.phase;
      state = step(state, FIXED_DT);
      // Kill gold and the wave-clear bonus both land during the wave phase, and
      // they can land on the *same* tick — the last enemy of a wave dying is
      // what triggers the clear. So attribution can't be guessed from the tick;
      // the clear bonus is computed from the formula and kill gold is the
      // remainder.
      const gained = state.gold - before;
      if (beforePhase === 'wave' && state.phase !== 'wave') {
        const bonus = waveClearBonus(state.wave);
        clearGold += bonus;
        killGold += gained - bonus;
      } else {
        killGold += gained;
      }
    }
    guard += 1;
  }

  return {
    reached: state.phase === 'won' ? TOTAL_WAVES : state.wave,
    won: state.phase === 'won',
    lives: state.lives,
    gold: state.gold,
    score: Math.round(state.score),
    kills: state.kills,
    towers: state.towers.length,
    lost: state.phase === 'lost',
    income: { start: DIFFICULTIES[difficulty].startingGold, overlapGold, clearGold, killGold, spentGold },
    hitCap: state.wave > waveCap,
    ranAway: guard >= GUARD_TICKS,
  };
}

function pct(a, b) {
  return b === 0 ? '—' : `${((a / b) * 100).toFixed(0)}%`;
}

const MIXES = {
  '弩台單一': ['crossbow'],
  '磨盤單一': ['grinder'],
  '冰霜單一': ['frost'],
  '線圈單一': ['coil'],
  '弩台+線圈': ['crossbow', 'coil'],
  '四種輪流': ['crossbow', 'grinder', 'frost', 'coil'],
};

/**
 * The single-type table above mostly measures "does this mix have any answer to
 * flying enemies" — only the coil targets air, so ground-only mixes are doomed
 * by kite chip damage no matter how good their DPS is. These mixes all carry
 * one coil per four towers, so air is covered everywhere and what's left to
 * compare is ground damage per gold.
 */
const AIR_COVERED = {
  '全線圈': ['coil'],
  '線圈+弩台×3': ['coil', 'crossbow', 'crossbow', 'crossbow'],
  '線圈+磨盤×3': ['coil', 'grinder', 'grinder', 'grinder'],
  '線圈+冰霜×3': ['coil', 'frost', 'frost', 'frost'],
  '線圈+弩台+冰霜': ['coil', 'crossbow', 'frost'],
  '線圈+磨盤+冰霜': ['coil', 'grinder', 'frost'],
};

const OVERLAP_LABEL = { never: '不加壓', safe: '保守加壓', always: '全力加壓' };

console.log('=== 20 波挑戰（標準難度、開闊地圖、固定塔位）===\n');
console.log('組合           加壓策略 | 到達波次  存活  結局    分數     擊殺');
for (const [name, mix] of Object.entries(MIXES)) {
  for (const overlap of ['never', 'always']) {
    const r = run({ mix, overlap });
    const label = OVERLAP_LABEL[overlap];
    console.log(
      `${name.padEnd(12, '　')} ${label.padEnd(5, '　')} | ` +
        `${String(r.reached).padStart(4)} / ${TOTAL_WAVES}  ${String(r.lives).padStart(3)}  ` +
        `${(r.won ? '通關' : '失守').padEnd(4)}  ${String(r.score).padStart(6)}  ${String(r.kills).padStart(5)}`,
    );
  }
}

console.log('\n=== 對空已覆蓋後，純比地面效率（標準、全力加壓）===\n');
console.log('組合                | 到達波次  存活  結局    分數     擊殺');
for (const [name, mix] of Object.entries(AIR_COVERED)) {
  const r = run({ mix, overlap: 'always' });
  console.log(
    `${name.padEnd(18, '　')} | ${String(r.reached).padStart(4)} / ${TOTAL_WAVES}  ` +
      `${String(r.lives).padStart(3)}  ${(r.won ? '通關' : '失守').padEnd(4)}  ` +
      `${String(r.score).padStart(6)}  ${String(r.kills).padStart(5)}`,
  );
}

console.log('\n=== 無盡模式：撐到第幾波（標準、全力加壓，上限 60 波）===\n');
for (const [name, mix] of Object.entries(AIR_COVERED)) {
  const r = run({ mix, overlap: 'always', endless: true, waveCap: 60 });
  const ending = r.lost ? `第 ${r.reached} 波陣亡` : r.hitCap ? '撐過 60 波（量測上限）' : `停在第 ${r.reached} 波`;
  console.log(
    `${name.padEnd(18, '　')} ${ending.padEnd(14, '　')} 剩命 ${String(r.lives).padStart(2)}/20  ` +
      `擊殺 ${r.kills}${r.ranAway ? '  ⚠ 撞到 tick 上限' : ''}`,
  );
}

console.log('\n=== 金幣來源拆解（四種輪流、標準）===\n');
for (const overlap of ['never', 'safe', 'always']) {
  const r = run({ mix: MIXES['四種輪流'], overlap });
  const { start, overlapGold, clearGold, killGold } = r.income;
  const total = start + overlapGold + clearGold + killGold;
  console.log(`${OVERLAP_LABEL[overlap]}   （到達第 ${r.reached} 波，${r.won ? '通關' : '失守'}，剩命 ${r.lives}）`);
  console.log(`  起始金幣      ${String(start).padStart(6)}  ${pct(start, total)}`);
  console.log(`  強行加壓      ${String(overlapGold).padStart(6)}  ${pct(overlapGold, total)}`);
  console.log(`  波次結算      ${String(clearGold).padStart(6)}  ${pct(clearGold, total)}`);
  console.log(`  擊殺獎勵      ${String(killGold).padStart(6)}  ${pct(killGold, total)}`);
  console.log(`  總收入        ${String(total).padStart(6)}`);
  console.log(`  已投入塔上    ${String(r.income.spentGold).padStart(6)}   蓋了 ${r.towers} 座\n`);
}

console.log('=== 難度三檔（四種輪流、全力加壓）===\n');
for (const difficulty of ['relaxed', 'standard', 'harsh']) {
  const r = run({ mix: MIXES['四種輪流'], overlap: 'always', difficulty });
  console.log(
    `${difficulty.padEnd(9)} 到達 ${String(r.reached).padStart(2)}/${TOTAL_WAVES}  ` +
      `存活 ${String(r.lives).padStart(2)}/${DIFFICULTIES[difficulty].startingLives}  ` +
      `${r.won ? '通關' : '失守'}  分數 ${r.score}`,
  );
}

console.log('\n=== 塔的傷害對上護甲（每發實際傷害）===\n');
const ARMORS = [
  ['步兵/疾走鼠/紙鳶', 0],
  ['鐵皮兵', 6],
  ['首領', 10],
];
console.log('塔            等級 |  ' + ARMORS.map(([n]) => n).join('  '));
for (const [type, def] of Object.entries(TOWER_DEFS)) {
  for (let lvl = 0; lvl < 3; lvl++) {
    const dmg = def.levels[lvl].damage;
    const cells = ARMORS.map(([, armor]) => String(Math.max(0, dmg - armor)).padStart(String(ARMORS[0][0]).length));
    console.log(`${def.name.padEnd(6, '　')} L${lvl + 1}   | ${cells.join('  ')}   (${type})`);
  }
}
