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

const TRAINING_PLANS: {
  id: string;
  label: string;
  hint: string;
  cost: number;
  bonus: number;
  farmBoost: number;
  morale: number;
}[] = [
  { id: 'train-lean', label: '節流', hint: '不編訓練預算。省下錢，但戰力與士氣都掉。', cost: 0, bonus: -1, farmBoost: 0.9, morale: -2 },
  { id: 'train-balanced', label: '均衡強化', hint: '五個部門平均分配。', cost: 1200, bonus: 1.5, farmBoost: 1, morale: 0 },
  { id: 'train-offense', label: '打線優先', hint: '重壓打擊與體能，戰力提升最多。', cost: 1600, bonus: 2.2, farmBoost: 0.95, morale: 1 },
  { id: 'train-farm', label: '農場優先', hint: '把錢投到二軍。一軍沒有立即幫助，新秀成長加速。', cost: 1000, bonus: 0, farmBoost: 1.45, morale: 0 },
];

const BUDGET_PLANS: {
  id: string;
  label: string;
  hint: string;
  ticketPrice: number;
  marketing: number;
  scouting: number;
}[] = [
  { id: 'budget-cheap', label: '親民票價', hint: '票價 250 元、行銷 400 萬、球探 200 萬。看台會滿，收入單價低。', ticketPrice: 250, marketing: 400, scouting: 200 },
  { id: 'budget-standard', label: '標準營運', hint: '票價 350 元、行銷 800 萬、球探 500 萬。', ticketPrice: 350, marketing: 800, scouting: 500 },
  { id: 'budget-premium', label: '高單價路線', hint: '票價 500 元、行銷 1,200 萬、球探 500 萬。單價高但趕客。', ticketPrice: 500, marketing: 1200, scouting: 500 },
  { id: 'budget-scout', label: '押注球探', hint: '票價 350 元、行銷 400 萬、球探 1,000 萬。選秀看得最清楚。', ticketPrice: 350, marketing: 400, scouting: 1000 },
];

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

    case 'spring':
      return {
        phase: 'spring',
        title: `${state.year} 年 春訓`,
        prompt: `目前資金 ${formatMoney(state.finance.cash)}。今年的訓練預算怎麼編？`,
        options: TRAINING_PLANS.map((plan) => ({
          id: plan.id,
          label: plan.label,
          hint: plan.hint,
          cost: plan.cost,
          detail: [`費用 ${formatMoney(plan.cost)}`],
        })),
      };

    case 'block': {
      const best = farm(team).sort((a, b) => ability(b) - ability(a))[0];
      const options: Option[] = [
        { id: 'blk-hold', label: '維持現狀', hint: '不做調整，把陣容交給教練團。' },
        {
          id: 'blk-promote',
          label: best ? `把 ${best.name} 升上一軍` : '升上新秀',
          hint: best
            ? `二軍最好的一位（能力 ${Math.round(ability(best))}）。年輕球員上一軍會拖慢成長。`
            : '二軍沒有可升的人。',
          disabled: !best,
          disabledReason: '二軍沒有球員',
        },
        { id: 'blk-rest', label: '輪休主力', hint: '這個區塊戰力略降，換來士氣與健康。' },
        {
          id: 'blk-market',
          label: '加碼行銷',
          hint: `花 400 萬換球迷熱度 +5。目前熱度 ${state.heat}。`,
          cost: 400,
        },
      ];
      return {
        phase: 'block',
        title: `${state.year} 年 例行賽 第 ${state.block + 1}/${BLOCKS} 段`,
        prompt: `目前戰績 ${team.wins} 勝 ${team.losses} 敗，聯盟第 ${finishOf(state.teams, state.teamId)}。`,
        options,
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
      options.push({
        id: 'trade-shop',
        label: '再詢價一輪',
        hint: '花 300 萬請球團重新接觸其他隊，換一批提案。',
        cost: 300,
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

    case 'budget':
      return {
        phase: 'budget',
        title: `${state.year} 年 季後預算`,
        prompt: `為下個球季設定票價、行銷與球探。目前熱度 ${state.heat}、資金 ${formatMoney(state.finance.cash)}。`,
        options: BUDGET_PLANS.map((plan) => ({
          id: plan.id,
          label: plan.label,
          hint: plan.hint,
        })),
      };

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
  const plan = TRAINING_PLANS.find((p) => p.id === optionId) ?? TRAINING_PLANS[1];
  state.finance.training = plan.cost;
  state.finance.cash -= plan.cost;
  state.trainingBonus = plan.bonus;
  state.farmBoost = plan.farmBoost;
  state.morale = clamp(state.morale + plan.morale, -6, 6);
  report.lines.push(`訓練預算 ${formatMoney(plan.cost)}，戰力修正 ${plan.bonus >= 0 ? '+' : ''}${plan.bonus}。`);
  state.phase = 'block';
  state.block = 0;
}

function resolveBlock(state: GameState, optionId: string, report: Report): void {
  const team = humanTeam(state);
  let blockBonus = 0;

  if (optionId === 'blk-promote') {
    const best = farm(team).sort((a, b) => ability(b) - ability(a))[0];
    if (best) {
      best.level = 'major';
      // Rushing a young player costs development, exactly as the spec warns.
      if (best.age <= 21) state.farmBoost *= 0.5;
      rebalance(team);
      report.lines.push(`${best.name} 升上一軍。${best.age <= 21 ? '他還太年輕，這一年的成長會被拖慢。' : ''}`);
    }
  } else if (optionId === 'blk-rest') {
    blockBonus = -1;
    state.morale = clamp(state.morale + 2, -6, 6);
    report.lines.push('主力輪休，這一段戰力略降，但休息室的氣氛好了不少。');
  } else if (optionId === 'blk-market') {
    state.finance.cash -= 400;
    state.heat = clamp(state.heat + 5, 0, 100);
    report.lines.push('加碼行銷，球迷熱度上升。');
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
  const plan = BUDGET_PLANS.find((p) => p.id === optionId) ?? BUDGET_PLANS[1];
  state.finance.ticketPrice = plan.ticketPrice;
  state.finance.marketing = plan.marketing;
  state.finance.scouting = plan.scouting;
  report.lines.push(
    `下季票價 ${plan.ticketPrice} 元、行銷 ${formatMoney(plan.marketing)}、球探 ${formatMoney(plan.scouting)}（${scoutLabel(plan.scouting)}）。`,
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
