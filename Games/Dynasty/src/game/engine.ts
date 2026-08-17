import {
  BLOCKS,
  BANKRUPTCY,
  CLUBS,
  EXPECTATIONS,
  GAMES,
  SALARY_CAP,
  SCOUT_TIERS,
  formatMoney,
} from './config';
import { applyTrust, defaultExpectation, negotiable, review, shouldFire } from './board';
import { pickEvent } from './events';
import { buildContext, pickSituation, situationById } from './situations';
import {
  budgetScenarioById,
  buildBudgetContext,
  buildTrainingContext,
  pickBudgetScenario,
  pickTrainingScenario,
  trainingScenarioById,
} from './plans';
import { nextHeat, settle } from './finance';
import { ability, agePlayer, generatePlayer, marketSalary, resetIds, tradeValue } from './players';
import { pick, randInt, seedFromCode, streamRng } from './rng';
import { farm, payroll, rebalance, starCount } from './roster';
import { buildDraftClass, describeProspect } from './scouting';
import { finishOf, playBlock, playPostseason, resetRecords, standings } from './season';
import { buildOffers, executeTrade } from './trades';
import type { TradeOffer } from './trades';
import type {
  Decision,
  Expectation,
  GameState,
  LogEntry,
  Option,
  Player,
  Report,
  SeasonRecord,
  Summary,
  Team,
} from './types';
import { TENURE } from './types';

const START_YEAR = 2026;

/** Re-shops allowed per trade deadline. Without a cap the phase never ends. */
const DEADLINE_SHOPS = 2;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function rng(state: GameState, purpose: string): () => number {
  // Year, phase, block and decision count pin the stream to this exact moment,
  // so replaying the same decisions replays the same numbers.
  return streamRng(
    state.seed,
    `${purpose}:${state.year}:${state.phase}:${state.block}:${state.decisions.length}`,
  );
}

function pushLog(state: GameState, label: string, text: string, tone: LogEntry['tone']): void {
  state.log.push({ id: state.log.length, label, text, tone });
}

function humanTeam(state: GameState): Team {
  return state.teams.find((t) => t.id === state.teamId) ?? state.teams[0];
}

// ---------------------------------------------------------------------------
// League construction
// ---------------------------------------------------------------------------

function buildRoster(r: () => number, teamId: string, strengthOffset: number): Player[] {
  const players: Player[] = [];
  // Twenty-six on the active roster and twelve in the system, with ages spread
  // so every club already has a past, a present and a future to trade away.
  for (let i = 0; i < 26; i++) {
    const age = randInt(r, 22, 36);
    // Wide enough that every club has a genuine star or two at the top and
    // replacement bodies at the bottom. A narrower spread produced a league
    // where nobody ever cleared 70, so merchandise income was always zero and
    // no roster ever felt worth building around.
    const base = 50 + strengthOffset + randInt(r, -12, 22) - Math.max(0, age - 31) * 2;
    players.push(
      generatePlayer({ r, teamId, age, ability: clamp(base, 25, 90), level: 'major' }),
    );
  }
  for (let i = 0; i < 12; i++) {
    const age = randInt(r, 18, 23);
    players.push(
      generatePlayer({
        r,
        teamId,
        age,
        ability: clamp(28 + strengthOffset + randInt(r, -6, 12), 20, 60),
        level: 'farm',
        homegrown: true,
      }),
    );
  }
  return players;
}

export interface CreateInput {
  seedCode: string;
  gmName: string;
  teamId: string;
}

export function createGame(input: CreateInput): GameState {
  const seed = seedFromCode(input.seedCode);
  resetIds();

  const teams: Team[] = CLUBS.map((club) => {
    const r = streamRng(seed, `roster:${club.id}`);
    return {
      id: club.id,
      name: club.name,
      aiMode: club.strength >= 3 ? 'contend' : club.strength <= -2 ? 'rebuild' : 'balanced',
      players: buildRoster(r, club.id, club.strength),
      wins: 0,
      losses: 0,
    };
  });
  teams.forEach(rebalance);

  const club = CLUBS.find((c) => c.id === input.teamId) ?? CLUBS[0];

  const state: GameState = {
    seedCode: input.seedCode,
    seed,
    gmName: input.gmName.trim() || '無名總管',
    teamId: club.id,
    year: START_YEAR,
    seasonIndex: 0,
    phase: 'board',
    block: 0,
    teams,
    board: { expectation: 'hold', trust: 60, dangerYears: 0 },
    finance: { cash: club.cash, ticketPrice: 350, marketing: 800, scouting: 200, training: 0 },
    heat: 50,
    farmLevel: 2,
    morale: 0,
    trainingBonus: 0,
    farmBoost: 1,
    draftPool: [],
    history: [],
    ledgers: [],
    log: [],
    decisions: [],
    seenEvents: [],
    seenSituations: [],
    blockSituation: null,
    deadlineShops: 0,
    seenTrainingScenarios: [],
    trainingScenario: null,
    seenBudgetScenarios: [],
    budgetScenario: null,
    decision: null,
    report: null,
    over: false,
    summary: null,
  };

  pushLog(state, '就任', `${state.gmName} 接下 ${club.name} 的總管職務，任期十年。`, 'normal');
  state.decision = buildDecision(state);
  return state;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

function scoutLabel(spend: number): string {
  let label = SCOUT_TIERS[0].label;
  for (const tier of SCOUT_TIERS) if (spend >= tier.spend) label = tier.label;
  return label;
}

/**
 * "一軍主力" for the purposes of the rebuilding mandate. The bar is a regular,
 * not a star — asking a rebuilding club for three homegrown stars inside three
 * years made the mandate unmeetable, and a mandate you cannot meet is just a
 * slower firing.
 */
function homegrownRegulars(team: Team): number {
  return team.players.filter((p) => p.level === 'major' && p.homegrown && ability(p) >= 50).length;
}

function buildDecision(state: GameState): Decision {
  const team = humanTeam(state);

  switch (state.phase) {
    case 'board': {
      const base = defaultExpectation(state, team);
      const options: Option[] = negotiable(base).map((entry) => {
        const info = EXPECTATIONS[entry.expectation];
        const delta =
          entry.trustDelta === 0
            ? '（董事會原本的期望）'
            : entry.trustDelta > 0
              ? `信任 +${entry.trustDelta}`
              : `信任 ${entry.trustDelta}`;
        return {
          id: `exp-${entry.expectation}`,
          label: `${info.label}：${info.demand}`,
          hint: `達成 信任 +${info.reward}${info.bonus > 0 ? `、獎金 ${formatMoney(info.bonus)}` : ''}／未達成 信任 ${info.penalty}　${delta}`,
        };
      });
      return {
        phase: 'board',
        title: `${state.year} 年 季前董事會`,
        prompt: `任期第 ${state.seasonIndex + 1} 年。董事會想聽你對今年的說法。`,
        options,
      };
    }

    case 'spring': {
      // Drawn from the club's actual state, the same way a block situation is
      // — a title defence, a relegation scare, an empty bank account and a
      // stacked farm system do not get the same four lines every year.
      const ctx = buildTrainingContext(state, team);
      const scenario = pickTrainingScenario(
        ctx,
        state.seenTrainingScenarios,
        streamRng(state.seed, `training:${state.year}`),
      );
      state.trainingScenario = scenario.id;
      const built = scenario.build(ctx);

      return {
        phase: 'spring',
        title: `${state.year} 年 春訓`,
        prompt: `目前資金 ${formatMoney(state.finance.cash)}。${built.prompt}`,
        options: built.options.map((option) => ({
          id: option.id,
          label: option.label,
          hint: option.hint,
          cost: option.effects.cost,
          detail: [`費用 ${formatMoney(option.effects.cost)}`],
        })),
      };
    }

    case 'block': {
      // Every block is a situation drawn from the club's actual state rather
      // than the same four-option menu forty times a tenure. Seeded on year and
      // block only — not on `decisions.length`, which differs between building
      // the decision and resolving it.
      const ctx = buildContext(state, team, finishOf(state.teams, state.teamId), BLOCKS - state.block - 1);
      const situation = pickSituation(
        ctx,
        state.seenSituations,
        streamRng(state.seed, `situation:${state.year}:${state.block}`),
      );
      state.blockSituation = situation.id;
      const built = situation.build(ctx);

      return {
        phase: 'block',
        title: `${state.year} 年 例行賽 第 ${state.block + 1}/${BLOCKS} 段`,
        prompt: `${team.wins} 勝 ${team.losses} 敗，聯盟第 ${ctx.standing}。${built.prompt}`,
        options: built.options.map((option) => ({
          id: option.id,
          label: option.label,
          hint: option.hint,
          cost: option.effects.cash && option.effects.cash < 0 ? -option.effects.cash : undefined,
        })),
      };
    }

    case 'deadline': {
      const offers = offersFor(state, state.decisions.length);
      const options: Option[] = offers.map((offer, index) => ({
        id: `trade-${index}`,
        label: `${offer.partnerName}（${offer.motive}）`,
        hint: offer.summary,
        detail: [
          `送出：${offer.out.map((p) => `${p.name} ${p.age}歲 能力${Math.round(ability(p))}`).join('、')}`,
          `得到：${offer.in.map((p) => `${p.name} ${p.age}歲 能力${Math.round(ability(p))}${p.age <= 22 ? `（潛力 ${p.band.low}–${p.band.high}）` : ''}`).join('、')}`,
        ],
      }));
      // Capped, and unavailable when the money is not there.
      //
      // Re-shopping deliberately stays on the deadline phase so a fresh batch of
      // offers can be built. With no cap that made the deadline an unbounded
      // loop: a player could keep paying 300 萬 forever without the game ever
      // advancing, and since bankruptcy is only tested at season end, cash could
      // run arbitrarily negative — a max-spend policy reached −113,450 inside
      // the first year and the tenure never finished at all.
      const shopsLeft = DEADLINE_SHOPS - state.deadlineShops;
      options.push({
        id: 'trade-shop',
        label: `再詢價一輪（還可 ${Math.max(0, shopsLeft)} 次）`,
        hint: '花 300 萬請球團重新接觸其他隊，換一批提案。',
        cost: 300,
        disabled: shopsLeft <= 0 || state.finance.cash < 300,
        disabledReason: shopsLeft <= 0 ? '今年詢價次數用完了' : '資金不足',
      });
      options.push({ id: 'trade-pass', label: '不交易', hint: '維持現有陣容。' });
      return {
        phase: 'deadline',
        title: `${state.year} 年 交易截止日`,
        prompt: '其他球團遞來的提案。你的球探報告是唯一的資訊優勢。',
        options,
      };
    }

    case 'draft': {
      const options: Option[] = state.draftPool.map((prospect, index) => ({
        id: `draft-${index}`,
        label: `${prospect.name}　${prospect.position === 'P' ? '投手' : prospect.position === 'C' ? '捕手' : prospect.position === 'IF' ? '內野手' : '外野手'}`,
        hint: `球探等級：${scoutLabel(state.finance.scouting)}`,
        detail: describeProspect(prospect),
      }));
      return {
        phase: 'draft',
        title: `${state.year} 年 選秀會`,
        prompt: '報告只給區間，不給數字。多花的球探預算就是你的資訊優勢。',
        options,
      };
    }

    case 'contracts': {
      const expiring = expiringPlayers(team);
      if (expiring.length === 0) {
        return {
          phase: 'contracts',
          title: `${state.year} 年 續約`,
          prompt: '今年沒有到期的重要合約。',
          options: [{ id: 'con-none', label: '繼續', hint: '進入下一步。' }],
        };
      }
      const target = expiring[0];
      const market = marketSalary(ability(target), target.age + 1);
      return {
        phase: 'contracts',
        title: `${state.year} 年 續約`,
        prompt: `${target.name}（${target.age} 歲・能力 ${Math.round(ability(target))}）合約到期，市場行情 ${formatMoney(market)}。`,
        options: [
          {
            id: 'con-market',
            label: `依行情續約 ${formatMoney(market)}`,
            hint: '三年約。確定留人，但吃掉薪資空間。',
            cost: 0,
          },
          {
            id: 'con-lowball',
            label: `壓價續約 ${formatMoney(Math.round(market * 0.7))}`,
            hint: '省錢，但有機會談崩，人就走了。',
          },
          { id: 'con-let-go', label: '放他走', hint: '空出薪資空間；能力夠好的話可拿到補償籤。' },
        ],
      };
    }

    case 'budget': {
      // Same treatment as spring training: a champion cashing in on the
      // afterglow, a relegated club trying to win fans back, a broke club and
      // a rebuilding one each see a different, contextual menu.
      const ctx = buildBudgetContext(state, team);
      const scenario = pickBudgetScenario(
        ctx,
        state.seenBudgetScenarios,
        streamRng(state.seed, `budget:${state.year}`),
      );
      state.budgetScenario = scenario.id;
      const built = scenario.build(ctx);

      return {
        phase: 'budget',
        title: `${state.year} 年 季後預算`,
        prompt: built.prompt,
        options: built.options.map((option) => ({
          id: option.id,
          label: option.label,
          hint: option.hint,
        })),
      };
    }

    default:
      return { phase: 'over', title: '任期結束', prompt: '', options: [] };
  }
}

/**
 * Offers must be identical when the decision is built and when it is resolved,
 * so the stream is keyed on an explicit decision count rather than on whatever
 * `state.decisions.length` happens to be at the call site — resolve() has
 * already pushed by then.
 */
function offersFor(state: GameState, decisionCount: number): TradeOffer[] {
  return buildOffers(
    state,
    streamRng(state.seed, `offers:${state.year}:${state.block}:${decisionCount}`),
  );
}

function expiringPlayers(team: Team): Player[] {
  return team.players
    .filter((p) => p.level === 'major' && p.years <= 1)
    .sort((a, b) => tradeValue(b) - tradeValue(a));
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export function resolve(state: GameState, optionId: string): GameState {
  const next: GameState = structuredClone(state);
  const decision = next.decision;
  if (!decision || next.over) return next;
  const option = decision.options.find((o) => o.id === optionId);
  if (!option || option.disabled) return next;

  next.decisions.push(optionId);
  const report: Report = {
    label: decision.title,
    headline: option.label,
    lines: [],
    ledger: null,
    standings: null,
    tone: 'normal',
  };

  switch (decision.phase) {
    case 'board':
      resolveBoard(next, optionId, report);
      break;
    case 'spring':
      resolveSpring(next, optionId, report);
      break;
    case 'block':
      resolveBlock(next, optionId, report);
      break;
    case 'deadline':
      resolveDeadline(next, optionId, report);
      break;
    case 'draft':
      resolveDraft(next, optionId, report);
      break;
    case 'contracts':
      resolveContracts(next, optionId, report);
      break;
    case 'budget':
      resolveBudget(next, optionId, report);
      break;
    default:
      break;
  }

  pushLog(next, report.label, `${report.headline}：${report.lines.join(' ')}`, report.tone);
  next.report = report;
  next.decision = next.over ? { phase: 'over', title: '任期結束', prompt: '', options: [] } : buildDecision(next);
  return next;
}

function resolveBoard(state: GameState, optionId: string, report: Report): void {
  const chosen = optionId.replace('exp-', '') as Expectation;
  const base = defaultExpectation(state, humanTeam(state));
  const entry = negotiable(base).find((e) => e.expectation === chosen);
  state.board.expectation = chosen;
  if (entry && entry.trustDelta !== 0) {
    applyTrust(state, entry.trustDelta);
    report.lines.push(
      entry.trustDelta < 0
        ? '你說服董事會把期望調低，代價是先扣掉一些信任。'
        : '你主動把目標拉高，董事會很受用。',
    );
  }
  report.lines.push(`今年的期望是「${EXPECTATIONS[chosen].label}」：${EXPECTATIONS[chosen].demand}`);
  state.phase = 'spring';
}

function resolveSpring(state: GameState, optionId: string, report: Report): void {
  const team = humanTeam(state);
  const scenario = state.trainingScenario ? trainingScenarioById(state.trainingScenario) : undefined;
  // Rebuild with the same context the decision was built from, the way
  // resolveBlock rebuilds its situation — the rng that picked the scenario is
  // keyed on the year alone, so this reproduces exactly.
  const ctx = buildTrainingContext(state, team);
  const option = scenario?.build(ctx).options.find((o) => o.id === optionId);
  const effects = option?.effects ?? { cost: 1200, bonus: 1.5, farmBoost: 1, morale: 0 };

  if (scenario && !state.seenTrainingScenarios.includes(scenario.id)) {
    state.seenTrainingScenarios.push(scenario.id);
  }

  state.finance.training = effects.cost;
  state.finance.cash -= effects.cost;
  state.trainingBonus = effects.bonus;
  state.farmBoost = effects.farmBoost;
  state.morale = clamp(state.morale + effects.morale, -6, 6);
  report.lines.push(
    `訓練預算 ${formatMoney(effects.cost)}，戰力修正 ${effects.bonus >= 0 ? '+' : ''}${effects.bonus}。`,
  );
  state.phase = 'block';
  state.block = 0;
}

function resolveBlock(state: GameState, optionId: string, report: Report): void {
  const team = humanTeam(state);
  let blockBonus = 0;

  const situation = state.blockSituation ? situationById(state.blockSituation) : undefined;
  if (situation) {
    if (!state.seenSituations.includes(situation.id)) state.seenSituations.push(situation.id);

    // Rebuild with the same context the decision was built from; the situation
    // rng is keyed on year and block, so this reproduces exactly.
    const ctx = buildContext(state, team, finishOf(state.teams, state.teamId), BLOCKS - state.block - 1);
    const chosen = situation.build(ctx).options.find((o) => o.id === optionId);

    if (chosen) {
      const fx = chosen.effects;
      if (fx.cash) state.finance.cash += fx.cash;
      if (fx.heat) state.heat = clamp(state.heat + fx.heat, 0, 100);
      if (fx.trust) applyTrust(state, fx.trust);
      if (fx.morale) state.morale = clamp(state.morale + fx.morale, -6, 6);
      if (fx.farmLevel) state.farmLevel = clamp(state.farmLevel + fx.farmLevel, 1, 5);
      if (fx.farmBoost) state.farmBoost *= fx.farmBoost;
      if (fx.blockBonus) blockBonus += fx.blockBonus;

      if (chosen.playerEffect === 'promote' && ctx.prospect) {
        const player = team.players.find((p) => p.id === ctx.prospect!.id);
        if (player) {
          player.level = 'major';
          if (player.age <= 21) state.farmBoost *= 0.5;
          rebalance(team);
        }
      } else if (chosen.playerEffect === 'injure-star' && ctx.star) {
        // The gamble the option advertised: a real chance of losing him.
        const roll = streamRng(state.seed, `gamble:${state.year}:${state.block}`)();
        const player = team.players.find((p) => p.id === ctx.star!.id);
        if (player && roll < 0.4) {
          player.injuredSeasons = Math.max(player.injuredSeasons, 1);
          rebalance(team);
          report.lines.push(`${player.name} 的手肘撐不住了，本季報銷。`);
          report.tone = 'bad';
        } else {
          report.lines.push('他撐過去了，這一次。');
        }
      }

      report.lines.push(chosen.outcome);
    }
  }

  playBlock({
    teams: state.teams,
    humanTeamId: state.teamId,
    humanBonus: state.trainingBonus + state.morale * 0.4 + blockBonus,
    rng: rng(state, 'block'),
  });

  report.lines.push(`本段結束：${team.wins} 勝 ${team.losses} 敗，聯盟第 ${finishOf(state.teams, state.teamId)}。`);
  report.standings = standings(state.teams).map((t) => ({
    teamId: t.id,
    name: t.name,
    wins: t.wins,
    losses: t.losses,
  }));

  fireEvent(state, report);

  state.block += 1;
  // The deadline sits after the third block, with one block still to play.
  if (state.block === BLOCKS - 1) state.phase = 'deadline';
  else if (state.block >= BLOCKS) endSeason(state, report);
}

function resolveDeadline(state: GameState, optionId: string, report: Report): void {
  if (optionId === 'trade-shop') {
    state.deadlineShops += 1;
    state.finance.cash -= 300;
    report.lines.push('球團重新接觸了一輪，桌上換了一批提案。');
    // Staying on the deadline phase re-runs buildDecision with a fresh stream,
    // because the decision count has moved on.
    return;
  }
  if (optionId.startsWith('trade-') && optionId !== 'trade-pass') {
    const index = Number(optionId.replace('trade-', ''));
    // −1 because resolve() already recorded this decision.
    const offer = offersFor(state, state.decisions.length - 1)[index];
    if (offer) {
      executeTrade(state, offer);
      state.teams.forEach(rebalance);
      report.lines.push(
        `與 ${offer.partnerName} 完成交易。送出 ${offer.out.map((p) => p.name).join('、')}，得到 ${offer.in.map((p) => p.name).join('、')}。`,
      );
      report.tone = 'good';
    }
  } else {
    report.lines.push('截止日安靜地過去了。');
  }
  state.phase = 'block';
}

function resolveDraft(state: GameState, optionId: string, report: Report): void {
  const index = Number(optionId.replace('draft-', ''));
  const prospect = state.draftPool[index];
  const team = humanTeam(state);
  if (prospect) {
    prospect.teamId = team.id;
    prospect.level = 'farm';
    prospect.homegrown = true;
    team.players.push(prospect);
    report.lines.push(
      `指名 ${prospect.name}（${prospect.age} 歲）。球探報告說潛力 ${prospect.band.low}–${prospect.band.high}——真相要幾年後才知道。`,
    );
    report.tone = 'good';
  }
  state.draftPool = [];
  state.phase = 'contracts';
}

function resolveContracts(state: GameState, optionId: string, report: Report): void {
  const team = humanTeam(state);
  const expiring = expiringPlayers(team);
  const target = expiring[0];

  if (target) {
    const market = marketSalary(ability(target), target.age + 1);
    if (optionId === 'con-market') {
      target.salary = market;
      target.years = 3;
      report.lines.push(`${target.name} 續約三年，年薪 ${formatMoney(market)}。`);
    } else if (optionId === 'con-lowball') {
      const r = rng(state, 'lowball');
      if (r() < 0.45) {
        target.salary = Math.round(market * 0.7);
        target.years = 3;
        report.lines.push(`${target.name} 接受了低於行情的約。`);
        report.tone = 'good';
      } else {
        releasePlayer(state, team, target);
        report.lines.push(`${target.name} 拒絕了報價，轉往其他球隊。`);
        report.tone = 'bad';
      }
    } else {
      releasePlayer(state, team, target);
      report.lines.push(`${target.name} 離隊。`);
    }
  }

  // Everyone else who is out of contract simply renews at market rate if the
  // club can afford it, and walks if it cannot.
  expiring.slice(1).forEach((player) => {
    const market = marketSalary(ability(player), player.age + 1);
    if (payroll(team) + market <= SALARY_CAP * 1.25) {
      player.salary = market;
      player.years = randInt(rng(state, `renew:${player.id}`), 2, 4);
    } else {
      releasePlayer(state, team, player);
      report.lines.push(`${player.name} 因薪資空間不足離隊。`);
    }
  });

  rebalance(team);
  state.phase = 'budget';
}

function releasePlayer(state: GameState, team: Team, player: Player): void {
  team.players = team.players.filter((p) => p.id !== player.id);
  const suitor = pick(rng(state, `suitor:${player.id}`), state.teams.filter((t) => t.id !== team.id));
  player.teamId = suitor.id;
  player.homegrown = false;
  player.years = 3;
  suitor.players.push(player);
  rebalance(suitor);
}

function resolveBudget(state: GameState, optionId: string, report: Report): void {
  const team = humanTeam(state);
  const scenario = state.budgetScenario ? budgetScenarioById(state.budgetScenario) : undefined;
  // Same rebuild-from-id pattern as spring training: the scenario rng is
  // keyed on the year alone, so this reproduces the exact menu shown.
  const ctx = buildBudgetContext(state, team);
  const option = scenario?.build(ctx).options.find((o) => o.id === optionId);
  const effects = option?.effects ?? { ticketPrice: 350, marketing: 800, scouting: 500 };

  if (scenario && !state.seenBudgetScenarios.includes(scenario.id)) {
    state.seenBudgetScenarios.push(scenario.id);
  }

  state.finance.ticketPrice = effects.ticketPrice;
  state.finance.marketing = effects.marketing;
  state.finance.scouting = effects.scouting;
  report.lines.push(
    `下季票價 ${effects.ticketPrice} 元、行銷 ${formatMoney(effects.marketing)}、球探 ${formatMoney(effects.scouting)}（${scoutLabel(effects.scouting)}）。`,
  );
  advanceYear(state, report);
}

// ---------------------------------------------------------------------------
// Season roll-up
// ---------------------------------------------------------------------------

function fireEvent(state: GameState, report: Report): void {
  const r = rng(state, 'event');
  const event = pickEvent(state, r);
  if (!event || r() >= 0.45) return;
  state.seenEvents.push(event.id);
  report.lines.push(event.text);
  const effects = event.effects ?? {};
  if (effects.cash) state.finance.cash += effects.cash;
  if (effects.heat) state.heat = clamp(state.heat + effects.heat, 0, 100);
  if (effects.trust) applyTrust(state, effects.trust);
  if (effects.farmLevel) state.farmLevel = clamp(state.farmLevel + effects.farmLevel, 1, 5);
  if (effects.morale) state.morale = clamp(state.morale + effects.morale, -6, 6);
  if (event.tone && event.tone !== 'normal') report.tone = event.tone;
}

function endSeason(state: GameState, report: Report): void {
  const team = humanTeam(state);
  const finish = finishOf(state.teams, state.teamId);
  const outcome = playPostseason(state.teams, state.teamId, rng(state, 'postseason'));
  outcome.lines.forEach((line) => report.lines.push(line));

  const madePlayoffs = outcome.humanResult !== '未晉級';
  const wonTitle = outcome.humanResult === '總冠軍';

  // Settle first, because the board grades the year's finances too and cannot
  // do that before the books are closed. The bonus is then folded back in as
  // income, which is what it is.
  const ledger = settle({
    state,
    team,
    wins: team.wins,
    madePlayoffs,
    wonTitle,
    boardBonus: 0,
  });

  const boardReview = review({
    expectation: state.board.expectation,
    wins: team.wins,
    games: GAMES,
    madePlayoffs,
    wonTitle,
    homegrownRegulars: homegrownRegulars(team),
    net: ledger.net,
    heat: state.heat,
  });

  ledger.net += boardReview.bonus;
  state.finance.cash += ledger.net;
  state.ledgers.push(ledger);
  report.ledger = ledger;

  applyTrust(state, boardReview.trustDelta);
  report.lines.push(boardReview.note);
  if (boardReview.bonus > 0) report.lines.push(`達成期望，董事會撥下 ${formatMoney(boardReview.bonus)} 獎金。`);

  state.heat = nextHeat(state.heat, team.wins, GAMES, madePlayoffs, wonTitle, state.finance.ticketPrice);

  const record: SeasonRecord = {
    year: state.year,
    wins: team.wins,
    losses: team.losses,
    finish,
    playoffResult: outcome.humanResult,
    expectation: state.board.expectation,
    met: boardReview.met,
    net: ledger.net,
    heat: state.heat,
    trust: state.board.trust,
  };
  state.history.push(record);

  report.lines.push(
    `球季結束：${team.wins} 勝 ${team.losses} 敗，聯盟第 ${finish}，${outcome.humanResult}。收支 ${formatMoney(ledger.net)}。`,
  );
  if (wonTitle) report.tone = 'great';
  else if (!boardReview.met) report.tone = 'bad';

  if (state.finance.cash <= BANKRUPTCY) {
    finishTenure(state, report, true, '資金缺口過大，董事會當場解除你的職務。');
    return;
  }
  if (shouldFire(state)) {
    finishTenure(state, report, true, '連續兩年不被信任。董事會請你交出識別證。');
    return;
  }

  state.draftPool = buildDraftClass(state, state.finance.scouting);
  state.phase = 'draft';
}

function advanceYear(state: GameState, report: Report): void {
  state.seasonIndex += 1;
  if (state.seasonIndex >= TENURE) {
    finishTenure(state, report, false, '十年任期屆滿。');
    return;
  }

  state.year += 1;
  state.block = 0;
  state.deadlineShops = 0;
  state.morale = 0;
  state.trainingBonus = 0;
  resetRecords(state.teams);

  // Everyone ages: the human club's farm benefits from this year's programme,
  // the AI clubs develop on the league default.
  const growthRng = rng(state, 'growth');
  const farmBoost = 1 + (state.farmLevel - 2) * 0.12;
  state.teams.forEach((team) => {
    const boost = team.id === state.teamId ? state.farmBoost * farmBoost : 1;
    team.players.forEach((player) => agePlayer(player, growthRng, boost));
    team.players = team.players.filter((p) => p.age <= 40 && ability(p) >= 18);
    refillRoster(state, team, growthRng);
    rebalance(team);
  });
  state.farmBoost = 1;

  state.phase = 'board';
}

/** Keeps AI clubs viable so the league does not decay into six empty rosters. */
function refillRoster(state: GameState, team: Team, r: () => number): void {
  const target = team.id === state.teamId ? 30 : 36;
  while (team.players.length < target) {
    const age = randInt(r, 19, 27);
    const base = team.aiMode === 'contend' ? randInt(r, 44, 62) : randInt(r, 30, 52);
    team.players.push(
      generatePlayer({ r, teamId: team.id, age, ability: base, level: 'farm' }),
    );
  }
}

function finishTenure(state: GameState, report: Report, fired: boolean, reason: string): void {
  state.over = true;
  state.phase = 'over';
  state.summary = buildSummary(state, fired);
  report.lines.push(reason, state.summary.epitaph);
  pushLog(state, '任期結束', `${reason} ${state.summary.epitaph}`, fired ? 'bad' : 'normal');
}

export function buildSummary(state: GameState, fired: boolean): Summary {
  const titles = state.history.filter((h) => h.playoffResult === '總冠軍').length;
  const playoffs = state.history.filter((h) => h.playoffResult !== '未晉級').length;
  const totalNet = state.ledgers.reduce((sum, l) => sum + l.net, 0);
  const team = humanTeam(state);
  const homegrownStars = team.players.filter((p) => p.homegrown && ability(p) >= 70).length;

  // Money divided by 150, not 40: a profitable decade is worth something, but a
  // club that banked a fortune and never won anything must not out-score one
  // that won three titles. Trophies are the point.
  const score = Math.max(
    0,
    Math.round(
      titles * 350 + playoffs * 90 + totalNet / 150 + homegrownStars * 60 + state.heat * 3,
    ),
  );

  let verdict: string;
  let epitaph: string;
  if (fired) {
    verdict = '中途下車';
    epitaph = '你在球團史上留下的是一行任期紀錄，和幾份沒人記得的計畫書。';
  } else if (score >= 2800) {
    verdict = '王朝締造者';
    epitaph = '很多年以後，人們談起這支球隊的黃金年代，講的都是你的十年。';
  } else if (score >= 1900) {
    verdict = '名總管';
    epitaph = '你把一支球隊交到比你接手時更好的地方。';
  } else if (score >= 1100) {
    verdict = '稱職的經營者';
    epitaph = '沒有王朝，但也沒有災難。球團在你手上活得好好的。';
  } else if (score >= 500) {
    verdict = '平淡的十年';
    epitaph = '十年過去，球隊還在，你也還在。就這樣。';
  } else {
    verdict = '被時代淘汰';
    epitaph = '你熬完了任期，但沒有人替你辦歡送會。';
  }

  return {
    score,
    verdict,
    epitaph,
    titles,
    playoffs,
    totalNet,
    homegrownStars,
    seasonsServed: state.history.length,
    fired,
  };
}

export function acknowledge(state: GameState): GameState {
  const next: GameState = structuredClone(state);
  next.report = null;
  return next;
}

export { humanTeam, starCount };
