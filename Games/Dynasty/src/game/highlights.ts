/**
 * Game highlights (比賽精華): deterministic text play-by-play for key games.
 *
 * The season sim only rolls block W/L and series outcomes — it never walks
 * plate appearances. Highlights are a presentation layer: they re-enact the
 * decisive moments from a dedicated RNG stream so the existing block /
 * postseason streams stay untouched and tenure determinism is preserved.
 */
import { pick, randInt } from './rng';
import { ability } from './players';
import type {
  GameHighlight,
  HighlightBeat,
  HighlightKind,
  Player,
  Team,
} from './types';

export interface HighlightContext {
  kind: HighlightKind;
  year: number;
  human: Team;
  opponent: Team;
  /** True when the human club won the featured game / series. */
  humanWon: boolean;
  /** Optional series line for playoffs, e.g. 「4 勝 2 敗」. */
  seriesLine?: string;
  /** Milestone flavour when kind === 'milestone'. */
  milestoneLabel?: string;
  rng: () => number;
}

const MOMENTS = ['一局上', '三局下', '五局上', '七局下', '八局上', '九局下'] as const;

const SETUP: string[] = [
  '先發投手進場暖身，內野手相互傳球對位。',
  '主場球迷敲起加油棒，客隊牛棚開始熱身。',
  '兩隊教練在本壘附近交換打擊順序表。',
];

const CONTACT: string[] = [
  '外角直球，打者強襲一壘方向——游擊手橫撲刺殺。',
  '高飛犧牲打，跑者從三壘踏壘得分。',
  '二壘安打貼著邊線滾進角落，打者站上二壘。',
  '滿壘時選到四壞球，擠回一分。',
  '打者揮空第三棒，三振收場。',
  '內野高彈跳，投手自己接殺出局。',
];

const CLIMAX_WIN: string[] = [
  '再見安打穿出中間方向，跑者從二壘奔回本壘！',
  '中堅手撲接失敗，球滾進牆角——超前分進帳。',
  '牛棚王牌連續三振，把領先守到最後一出局。',
  '代打掃出左外野深遠二壘安打，打回制勝分。',
];

const CLIMAX_LOSS: string[] = [
  '九局下兩出局，對手敲出再見安打，球場瞬間安靜。',
  '救援投手投出暴投，三壘跑者回來超前。',
  '外野漏接，對手攻下關鍵三分。',
  '滿壘時被選到保送，領先拱手讓出。',
];

function starNames(team: Team, count: number): string[] {
  return [...team.players]
    .filter((p) => p.level === 'major' && p.injuredSeasons <= 0)
    .sort((a, b) => ability(b) - ability(a))
    .slice(0, count)
    .map((p) => p.name);
}

function scorePair(rng: () => number, humanWon: boolean): { human: number; opp: number } {
  const low = randInt(rng, 1, 4);
  const high = low + randInt(rng, 1, 5);
  return humanWon ? { human: high, opp: low } : { human: low, opp: high };
}

function kindTitle(kind: HighlightKind, milestoneLabel?: string): string {
  if (kind === 'playoff') return '季後賽精華';
  if (kind === 'rivalry') return '對戰精華';
  return milestoneLabel ? `里程碑・${milestoneLabel}` : '里程碑精華';
}

/**
 * Builds a short, skippable play-by-play reel. Pure: same context + same rng
 * stream → identical beats.
 */
export function buildHighlight(ctx: HighlightContext): GameHighlight {
  const { rng, human, opponent, humanWon, kind } = ctx;
  const homeFirst = rng() < 0.55;
  const homeName = homeFirst ? human.name : opponent.name;
  const awayName = homeFirst ? opponent.name : human.name;
  const scores = scorePair(rng, humanWon);
  const ourStars = starNames(human, 3);
  const theirStars = starNames(opponent, 2);
  const hero = ourStars[0] ?? '先發打者';
  const villain = theirStars[0] ?? '對手打者';

  const beats: HighlightBeat[] = [];
  beats.push({
    moment: '賽前',
    text: pick(rng, SETUP),
    die: randInt(rng, 1, 6),
    tone: 'normal',
  });

  const midCount = 2 + randInt(rng, 0, 1);
  for (let i = 0; i < midCount; i++) {
    const moment = MOMENTS[Math.min(1 + i, MOMENTS.length - 2)];
    const who = rng() < 0.55 ? hero : villain;
    const line = pick(rng, CONTACT).replace('打者', who);
    beats.push({
      moment,
      text: line,
      die: randInt(rng, 1, 6),
      tone: who === hero ? 'good' : 'normal',
    });
  }

  const climaxPool = humanWon ? CLIMAX_WIN : CLIMAX_LOSS;
  beats.push({
    moment: pick(rng, ['九局下', '延長十局', '八局下']),
    text: `${hero}——${pick(rng, climaxPool)}`,
    die: randInt(rng, 1, 6),
    tone: humanWon ? 'great' : 'bad',
  });

  const finalScore = homeFirst
    ? `${human.name} ${scores.human}：${scores.opp} ${opponent.name}`
    : `${opponent.name} ${scores.opp}：${scores.human} ${human.name}`;

  const subtitleParts = [
    `${ctx.year} 年`,
    kind === 'playoff' ? '季後賽' : kind === 'rivalry' ? '對戰焦點' : '里程碑之戰',
  ];
  if (ctx.seriesLine) subtitleParts.push(ctx.seriesLine);

  return {
    kind,
    title: kindTitle(kind, ctx.milestoneLabel),
    subtitle: subtitleParts.join('・'),
    homeName,
    awayName,
    finalScore,
    beats,
  };
}

/** Prefer the current first-place club, else the strongest non-human roster. */
export function pickRival(teams: Team[], humanTeamId: string): Team {
  const others = teams.filter((t) => t.id !== humanTeamId);
  const byStandings = [...others].sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses,
  );
  if (byStandings[0] && byStandings[0].wins > 0) return byStandings[0];
  return [...others].sort((a, b) => {
    const topA = Math.max(...a.players.map((p) => ability(p)), 0);
    const topB = Math.max(...b.players.map((p) => ability(p)), 0);
    return topB - topA;
  })[0] ?? others[0];
}

export interface BlockHighlightInput {
  year: number;
  block: number;
  human: Team;
  teams: Team[];
  /** Wins added this block (after playBlock). */
  blockWins: number;
  blockGames: number;
  finishBefore: number;
  finishAfter: number;
  /** Prior career titles in this tenure. */
  priorTitles: number;
  rng: () => number;
}

/**
 * Decides whether a regular-season block earns a highlight, and which kind.
 * Returns null for ordinary blocks so the UI stays quiet most of the time.
 */
export function highlightForBlock(input: BlockHighlightInput): GameHighlight | null {
  const { human, teams, rng, blockWins, blockGames, finishBefore, finishAfter } = input;
  const rival = pickRival(teams, human.id);
  const winRate = blockWins / Math.max(1, blockGames);
  const clinchedRace = finishBefore > 4 && finishAfter <= 4;
  const dominant = winRate >= 0.7;
  const collapse = winRate <= 0.3;
  const tightRace =
    Math.abs(human.wins - rival.wins) <= 3 &&
    human.wins + human.losses >= 30 &&
    rival.id !== human.id;

  let kind: HighlightKind | null = null;
  let milestoneLabel: string | undefined;
  let humanWon = blockWins >= blockGames / 2;

  if (clinchedRace) {
    kind = 'milestone';
    milestoneLabel = '卡住季後賽席次';
    humanWon = true;
  } else if (dominant || collapse) {
    kind = 'milestone';
    milestoneLabel = dominant ? '區塊碾壓' : '區塊崩盤';
    humanWon = dominant;
  } else if (tightRace && input.block >= 1) {
    kind = 'rivalry';
    humanWon = human.wins >= rival.wins;
  }

  if (!kind) return null;

  return buildHighlight({
    kind,
    year: input.year,
    human,
    opponent: rival,
    humanWon,
    milestoneLabel,
    rng,
  });
}

export interface PostseasonHighlightInput {
  year: number;
  human: Team;
  teams: Team[];
  humanResult: '未晉級' | '準決賽敗' | '總冠軍賽敗' | '總冠軍';
  championId: string;
  priorTitles: number;
  rng: () => number;
}

/** Playoff (or first-title milestone) reel when the human club was involved. */
export function highlightForPostseason(input: PostseasonHighlightInput): GameHighlight | null {
  if (input.humanResult === '未晉級') return null;

  const champion =
    input.teams.find((t) => t.id === input.championId) ??
    pickRival(input.teams, input.human.id);
  const opponent =
    champion.id === input.human.id
      ? pickRival(input.teams, input.human.id)
      : champion;

  const humanWon = input.humanResult === '總冠軍';
  const seriesLine =
    input.humanResult === '總冠軍'
      ? '總冠軍賽勝出'
      : input.humanResult === '總冠軍賽敗'
        ? '總冠軍賽落敗'
        : '準決賽止步';

  const kind: HighlightKind =
    humanWon && input.priorTitles === 0 ? 'milestone' : 'playoff';
  const milestoneLabel = kind === 'milestone' ? '任內首冠' : undefined;

  return buildHighlight({
    kind,
    year: input.year,
    human: input.human,
    opponent,
    humanWon,
    seriesLine,
    milestoneLabel,
    rng: input.rng,
  });
}

/** Stars named in a highlight beat — exported for tests. */
export function featuredNames(players: Player[], n: number): string[] {
  return [...players]
    .sort((a, b) => ability(b) - ability(a))
    .slice(0, n)
    .map((p) => p.name);
}
