/**
 * Data-driven player storylines. Each kind fires at most once per tenure and
 * surfaces as a decision card with mechanical consequences (cash, heat, trust,
 * morale, ability, contracts). Triggers read real roster state — age, ability
 * deltas, contract years — rather than inventing fiction on a timer.
 */
import { applyTrust } from './board';
import { formatMoney } from './config';
import { ability } from './players';
import { rebalance } from './roster';
import type {
  ActiveStoryline,
  Decision,
  GameState,
  Option,
  Player,
  Report,
  StorylineKind,
  Team,
} from './types';

export interface StorylineEffects {
  cash?: number;
  heat?: number;
  trust?: number;
  morale?: number;
  abilityDelta?: number;
  potentialDelta?: number;
  salaryMul?: number;
  setYears?: number;
  promote?: boolean;
  demote?: boolean;
  release?: boolean;
  farmBoost?: number;
  close?: boolean;
  /** Advance to stage 1 and keep the arc open for a later follow-up. */
  advance?: boolean;
}

export interface StorylineOptionDef {
  id: string;
  label: string;
  hint: string;
  cost?: number;
  effects: StorylineEffects;
  outcome: string;
}

interface StorylineCard {
  title: string;
  prompt: string;
  options: StorylineOptionDef[];
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function findPlayer(team: Team, playerId: string): Player | undefined {
  return team.players.find((p) => p.id === playerId);
}

function majorStars(team: Team): Player[] {
  return team.players
    .filter((p) => p.level === 'major' && p.injuredSeasons <= 0)
    .sort((a, b) => ability(b) - ability(a));
}

function farmProspects(team: Team): Player[] {
  return team.players
    .filter((p) => p.level === 'farm' && p.age <= 22 && p.homegrown)
    .sort((a, b) => ability(b) - ability(a));
}

function kindLabel(kind: StorylineKind): string {
  switch (kind) {
    case 'rookie-breakout':
      return '新秀爆發';
    case 'slump-comeback':
      return '低潮與回歸';
    case 'veteran-last':
      return '老將最後一季';
    case 'contract-dispute':
      return '合約爭議';
  }
}

function cardFor(arc: ActiveStoryline, player: Player): StorylineCard {
  const ovr = Math.round(ability(player));

  if (arc.kind === 'rookie-breakout' && arc.stage === 0) {
    return {
      title: `球員物語・${kindLabel(arc.kind)}`,
      prompt: `二軍的 ${player.name}（${player.age} 歲・能力 ${ovr}）這季數據炸開，球探說「再不叫上來會被別隊盯上」。`,
      options: [
        {
          id: 'promote',
          label: '立刻升上一軍',
          hint: '補戰力，但過早拉拔會傷成長。',
          effects: { promote: true, morale: 1, heat: 3, farmBoost: 0.5, close: true },
          outcome: `${player.name} 登上二軍，球迷熱度上揚；農場計畫被打斷。`,
        },
        {
          id: 'develop',
          label: '再放二軍磨一年',
          hint: '保護成長曲線，士氣可能不滿。',
          effects: { potentialDelta: 3, morale: -1, close: true },
          outcome: `你按住 ${player.name}。潛力隱約上修，更衣室有人覺得你太保守。`,
        },
        {
          id: 'showcase',
          label: '當成交易籌碼展示',
          hint: '短期帳面好看，球員忠誠度下滑。',
          cost: 0,
          effects: { cash: 400, heat: -4, trust: 2, morale: -2, close: true },
          outcome: `展示會引來詢價，帳上多了 ${formatMoney(400)}，但 ${player.name} 開始動搖。`,
        },
      ],
    };
  }

  if (arc.kind === 'slump-comeback' && arc.stage === 0) {
    return {
      title: `球員物語・${kindLabel(arc.kind)}`,
      prompt: `當家 ${player.name}（能力從 ${Math.round(arc.abilityAtStart)} 掉到 ${ovr}）陷入低潮，媒體天天追問你要不要換人。`,
      options: [
        {
          id: 'rest',
          label: '下放調整、減壓',
          hint: '短期戰力下滑，換取回歸空間。',
          effects: { demote: true, morale: 1, heat: -2, advance: true },
          outcome: `${player.name} 暫時離開一軍燈光。你賭的是他還回得來。`,
        },
        {
          id: 'push',
          label: '繼續先發硬扛',
          hint: '士氣提振；低潮可能更長。',
          effects: { morale: 2, abilityDelta: -2, heat: 2, advance: true },
          outcome: `你公開力挺 ${player.name}。球迷鼓掌，球棒卻還沒醒。`,
        },
        {
          id: 'bench',
          label: '冷處理、縮短出賽',
          hint: '保護勝場，傷害信任關係。',
          effects: { morale: -2, trust: 1, heat: -3, advance: true },
          outcome: `${player.name} 被移出核心班底。董事會點頭，更衣室氣氛冷了。`,
        },
      ],
    };
  }

  if (arc.kind === 'slump-comeback' && arc.stage === 1) {
    const recovered = ability(player) >= arc.abilityAtStart - 1;
    if (recovered) {
      return {
        title: `球員物語・低潮回歸`,
        prompt: `${player.name} 回來了（能力 ${ovr}）。記者會上所有鏡頭都對準你——你要怎麼寫這段故事的結局？`,
        options: [
          {
            id: 'celebrate',
            label: '公開慶祝、加碼行銷',
            hint: '熱度大漲，花一筆行銷費。',
            cost: 500,
            effects: { cash: -500, heat: 8, morale: 2, close: true },
            outcome: `球團替 ${player.name} 辦回歸特輯，熱度暴衝。`,
          },
          {
            id: 'extension',
            label: '趁勢談提前續約',
            hint: '鎖住人，薪資上修。',
            effects: {
              salaryMul: 1.15,
              setYears: 3,
              trust: 3,
              morale: 1,
              close: true,
            },
            outcome: `${player.name} 簽下提前續約，董事會鬆了一口氣。`,
          },
          {
            id: 'quiet',
            label: '低調帶過',
            hint: '省下行銷費，但錯過熱度窗口。',
            effects: { morale: 1, heat: -2, close: true },
            outcome: `你讓 ${player.name} 自己消化這段路。故事停在球場裡，熱度少了一截。`,
          },
        ],
      };
    }
    return {
      title: `球員物語・低潮未解`,
      prompt: `${player.name} 仍未找回手感（能力 ${ovr}）。球季又過了一年，你必須做決定。`,
      options: [
        {
          id: 'cut-loss',
          label: '忍痛交易／放人',
          hint: '清空間，球迷反彈。',
          effects: { release: true, cash: 200, heat: -6, trust: 2, close: true },
          outcome: `${player.name} 離開了。帳上鬆一點，看台上噓聲也來了。`,
        },
        {
          id: 'keep-faith',
          label: '再給一年信任票',
          hint: '信任與士氣回穩，潛力微幅上修。',
          effects: { potentialDelta: 2, morale: 2, trust: -2, close: true },
          outcome: `你把籌碼押在 ${player.name} 身上。董事會不太開心。`,
        },
      ],
    };
  }

  if (arc.kind === 'veteran-last' && arc.stage === 0) {
    return {
      title: `球員物語・${kindLabel(arc.kind)}`,
      prompt: `${player.name}（${player.age} 歲・能力 ${ovr}）私下說：這大概是最後一季。球團要怎麼送他？`,
      options: [
        {
          id: 'ceremony',
          label: '舉辦致敬週',
          hint: '熱度與士氣大漲，花費不貲。',
          cost: 800,
          effects: { cash: -800, heat: 10, morale: 3, trust: 2, close: true },
          outcome: `全場起立鼓掌。${player.name} 的號碼暫時掛在休息室牆上。`,
        },
        {
          id: 'start',
          label: '保證先發到季末',
          hint: '戰力可能下滑，換忠誠與熱度。',
          effects: { morale: 2, heat: 4, abilityDelta: -1, close: true },
          outcome: `你答應 ${player.name} 會打滿這年。年輕後輩多坐了板凳。`,
        },
        {
          id: 'quiet-exit',
          label: '低調送行、省預算',
          hint: '不花錢；球迷覺得冷血。',
          effects: { heat: -5, trust: 1, morale: -1, close: true },
          outcome: `${player.name} 默默清了置物櫃。社群開始出現白布條草稿。`,
        },
      ],
    };
  }

  // contract-dispute
  return {
    title: `球員物語・${kindLabel(arc.kind)}`,
    prompt: `${player.name}（能力 ${ovr}・合約剩 ${player.years} 年）透過經紀人放話：不談加碼就要求交易。`,
    options: [
      {
        id: 'pay',
        label: '加碼續約安撫',
        hint: '鎖人，薪資明顯上修。',
        effects: {
          salaryMul: 1.35,
          setYears: Math.max(player.years, 3),
          morale: 2,
          heat: 2,
          close: true,
        },
        outcome: `${player.name} 收回交易要求，薪資表又重了一截。`,
      },
      {
        id: 'hold',
        label: '拒絕加碼、要求專注比賽',
        hint: '省錢；士氣與熱度受傷。',
        effects: { morale: -3, heat: -4, trust: 2, close: true },
        outcome: `你公開拒絕。${player.name} 沒走，但休息室氣氛降到冰點。`,
      },
      {
        id: 'trade-ok',
        label: '同意聽取交易提案',
        hint: '短期現金與彈性，失去戰力。',
        effects: { release: true, cash: 600, heat: -3, trust: 1, close: true },
        outcome: `${player.name} 打包離隊。你換到一點現金與薪資空間。`,
      },
    ],
  };
}

export function buildStorylineDecision(state: GameState, team: Team): Decision | null {
  const arc = state.storylines.find((s) => s.id === state.pendingStorylineId && !s.closed);
  if (!arc) return null;
  const player = findPlayer(team, arc.playerId);
  if (!player) {
    arc.closed = true;
    return null;
  }
  const card = cardFor(arc, player);
  const options: Option[] = card.options.map((option) => ({
    id: `story-${option.id}`,
    label: option.label,
    hint: option.hint,
    cost: option.cost ?? (option.effects.cash && option.effects.cash < 0 ? -option.effects.cash : undefined),
  }));
  return {
    phase: 'storyline',
    title: card.title,
    prompt: card.prompt,
    options,
    key: arc.id,
  };
}

export function storylineOptionDefs(arc: ActiveStoryline, player: Player): StorylineOptionDef[] {
  return cardFor(arc, player).options;
}

function bumpAttrs(player: Player, delta: number): void {
  if (delta === 0) return;
  const keys = Object.keys(player.attrs) as (keyof Player['attrs'])[];
  keys.forEach((key) => {
    player.attrs[key] = clamp(Math.round(player.attrs[key] + delta), 0, 99);
  });
}

/**
 * Applies the chosen storyline option. Mutates state/report; caller resumes
 * the stored phase afterwards.
 */
export function applyStorylineChoice(
  state: GameState,
  team: Team,
  optionId: string,
  report: Report,
): void {
  const arc = state.storylines.find((s) => s.id === state.pendingStorylineId && !s.closed);
  if (!arc) {
    report.lines.push('這則物語已經結束了。');
    return;
  }
  const player = findPlayer(team, arc.playerId);
  if (!player) {
    arc.closed = true;
    report.lines.push('當事人已不在名單上。');
    return;
  }

  const rawId = optionId.replace(/^story-/, '');
  const option = cardFor(arc, player).options.find((o) => o.id === rawId);
  if (!option) {
    report.lines.push('選項無效。');
    return;
  }

  const fx = option.effects;
  if (fx.cash) state.finance.cash += fx.cash;
  if (fx.heat) state.heat = clamp(state.heat + fx.heat, 0, 100);
  if (fx.trust) applyTrust(state, fx.trust);
  if (fx.morale) state.morale = clamp(state.morale + fx.morale, -6, 6);
  if (fx.farmBoost) state.farmBoost *= fx.farmBoost;
  if (fx.abilityDelta) bumpAttrs(player, fx.abilityDelta);
  if (fx.potentialDelta) player.potential = clamp(player.potential + fx.potentialDelta, 20, 99);
  if (fx.salaryMul) player.salary = Math.max(40, Math.round(player.salary * fx.salaryMul));
  if (fx.setYears !== undefined) player.years = fx.setYears;
  if (fx.promote) {
    player.level = 'major';
    if (player.age <= 21) state.farmBoost *= 0.5;
  }
  if (fx.demote) player.level = 'farm';
  if (fx.release) {
    team.players = team.players.filter((p) => p.id !== player.id);
  }

  rebalance(team);
  report.lines.push(option.outcome);
  report.tone =
    fx.release || (fx.heat !== undefined && fx.heat < 0) || (fx.morale !== undefined && fx.morale < 0)
      ? 'bad'
      : fx.heat && fx.heat > 0
        ? 'good'
        : 'normal';

  if (fx.advance) {
    arc.stage += 1;
    arc.closed = false;
  } else if (fx.close !== false) {
    arc.closed = true;
  }

  state.pendingStorylineId = null;
}

export interface StoryTrigger {
  kind: StorylineKind;
  player: Player;
  stage: number;
}

/**
 * Picks at most one new or follow-up storyline card. Kinds are unique per
 * tenure; follow-ups reuse the existing arc id.
 */
export function findStorylineTrigger(state: GameState, team: Team): StoryTrigger | null {
  // Follow-up for an open arc that is waiting on the next season.
  const open = state.storylines.find((s) => !s.closed && s.stage === 1 && s.kind === 'slump-comeback');
  if (open && state.year > open.yearStarted && !state.pendingStorylineId) {
    const player = findPlayer(team, open.playerId);
    if (player) return { kind: open.kind, player, stage: 1 };
  }

  if (state.pendingStorylineId) return null;

  const seen = new Set(state.seenStorylineKinds);
  const memory = state.playerAbilityMemory;

  if (!seen.has('rookie-breakout')) {
    const prospect = farmProspects(team).find((p) => {
      const prev = memory[p.id];
      const now = ability(p);
      return now >= 48 || (prev !== undefined && now - prev >= 5);
    });
    if (prospect) return { kind: 'rookie-breakout', player: prospect, stage: 0 };
  }

  if (!seen.has('slump-comeback')) {
    const star = majorStars(team).find((p) => {
      const prev = memory[p.id];
      if (prev === undefined || prev < 62) return false;
      return ability(p) <= prev - 5;
    });
    if (star) return { kind: 'slump-comeback', player: star, stage: 0 };
  }

  if (!seen.has('veteran-last')) {
    const vet = majorStars(team).find((p) => p.age >= 35 && ability(p) >= 50);
    if (vet) return { kind: 'veteran-last', player: vet, stage: 0 };
  }

  if (!seen.has('contract-dispute')) {
    const diva = majorStars(team).find(
      (p) => ability(p) >= 68 && p.years <= 1 && p.age >= 26 && p.age <= 33,
    );
    if (diva) return { kind: 'contract-dispute', player: diva, stage: 0 };
  }

  return null;
}

export function openStoryline(state: GameState, trigger: StoryTrigger): ActiveStoryline {
  if (trigger.stage > 0) {
    const existing = state.storylines.find(
      (s) => s.kind === trigger.kind && s.playerId === trigger.player.id && !s.closed,
    );
    if (existing) {
      state.pendingStorylineId = existing.id;
      return existing;
    }
  }

  const arc: ActiveStoryline = {
    id: `story-${trigger.kind}-${state.year}-${trigger.player.id}`,
    kind: trigger.kind,
    playerId: trigger.player.id,
    playerName: trigger.player.name,
    stage: trigger.stage,
    yearStarted: state.year,
    abilityAtStart: ability(trigger.player),
    closed: false,
  };
  state.storylines.push(arc);
  if (!state.seenStorylineKinds.includes(trigger.kind)) {
    state.seenStorylineKinds.push(trigger.kind);
  }
  state.pendingStorylineId = arc.id;
  return arc;
}

/** Snapshot current abilities so next year can detect breakouts / slumps. */
export function refreshAbilityMemory(state: GameState, team: Team): void {
  const next: Record<string, number> = { ...state.playerAbilityMemory };
  team.players.forEach((player) => {
    next[player.id] = ability(player);
  });
  // Drop ids that left the roster so the map does not grow without bound.
  const living = new Set(team.players.map((p) => p.id));
  Object.keys(next).forEach((id) => {
    if (!living.has(id)) delete next[id];
  });
  state.playerAbilityMemory = next;
}

/** Every storyline option must cost something — cash, heat, trust, morale, or growth. */
export function storylineHasCost(effects: StorylineEffects): boolean {
  if (effects.cash && effects.cash < 0) return true;
  if (effects.heat && effects.heat < 0) return true;
  if (effects.trust && effects.trust < 0) return true;
  if (effects.morale && effects.morale < 0) return true;
  if (effects.farmBoost !== undefined && effects.farmBoost < 1) return true;
  if (effects.abilityDelta && effects.abilityDelta < 0) return true;
  if (effects.release) return true;
  if (effects.demote) return true;
  if (effects.salaryMul && effects.salaryMul > 1) return true;
  if (effects.promote) return true; // early call-up tax is the growth hit
  if (effects.potentialDelta && effects.potentialDelta > 0 && (effects.morale ?? 0) < 0) return true;
  // "Quiet" / develop paths that only spend morale or trust count too.
  if ((effects.morale ?? 0) !== 0 || (effects.trust ?? 0) !== 0 || (effects.heat ?? 0) !== 0) {
    return true;
  }
  if (effects.cash && effects.cash !== 0) return true;
  return false;
}
