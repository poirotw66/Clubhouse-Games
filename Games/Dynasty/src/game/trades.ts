import { ability, tradeValue } from './players';
import { pick } from './rng';
import type { GameState, Player, Team } from './types';

export interface TradeOffer {
  id: string;
  partnerId: string;
  partnerName: string;
  motive: '爭冠' | '重建' | '清薪資';
  /** Players leaving the human club. */
  out: Player[];
  /** Players arriving. */
  in: Player[];
  /** Positive means the human club receives value. */
  edge: number;
  summary: string;
}

function byValue(players: Player[]): Player[] {
  return [...players].sort((a, b) => tradeValue(b) - tradeValue(a));
}

function youngest(players: Player[]): Player[] {
  return [...players].sort((a, b) => a.age - b.age);
}

/**
 * Offers rather than a free-form trade builder. A builder costs several times
 * the UI work for roughly the same decision, and a curated offer also lets the
 * partner's motive be stated out loud, which is the information the player
 * actually reasons about.
 *
 * Every offer is priced with a partner-favouring margin: the AI is not trying
 * to be fair. The player's edge comes from scouting — knowing which prospect
 * in the deal is really worth something.
 */
export function buildOffers(state: GameState, rng: () => number): TradeOffer[] {
  const human = state.teams.find((t) => t.id === state.teamId);
  if (!human) return [];
  const partners = state.teams.filter((t) => t.id !== state.teamId);
  const offers: TradeOffer[] = [];

  const myVeterans = byValue(human.players.filter((p) => p.age >= 29 && p.level === 'major'));
  const myProspects = youngest(human.players.filter((p) => p.age <= 23));
  const myBest = byValue(human.players.filter((p) => p.level === 'major'));

  for (let i = 0; i < 3; i++) {
    const partner = pick(rng, partners);
    const kind = i === 0 ? 'buy' : i === 1 ? 'sell' : 'salary';

    if (kind === 'buy' && myProspects.length > 0) {
      const target = byValue(
        partner.players.filter((p) => p.level === 'major' && ability(p) >= 60),
      )[0];
      const cost = myProspects.slice(0, 2);
      if (!target || cost.length === 0) continue;
      offers.push(makeOffer(`buy${i}`, partner, '爭冠', cost, [target],
        `${partner.name} 願意送出即戰力 ${target.name}，要你的兩名新秀。`));
    } else if (kind === 'sell' && myVeterans.length > 0) {
      const give = myVeterans[0];
      const back = youngest(partner.players.filter((p) => p.age <= 22)).slice(0, 2);
      if (back.length === 0) continue;
      offers.push(makeOffer(`sell${i}`, partner, '重建', [give], back,
        `${partner.name} 想要 ${give.name} 衝一波，用兩名年輕球員來換。`));
    } else if (myBest.length > 2) {
      const give = myBest.find((p) => p.salary >= 900) ?? myBest[0];
      const back = byValue(partner.players.filter((p) => p.salary <= 400)).slice(0, 1);
      if (back.length === 0) continue;
      offers.push(makeOffer(`salary${i}`, partner, '清薪資', [give], back,
        `把 ${give.name} 的合約送走，換回一名便宜的替補。`));
    }
  }

  return offers;
}

function makeOffer(
  id: string,
  partner: Team,
  motive: TradeOffer['motive'],
  out: Player[],
  incoming: Player[],
  summary: string,
): TradeOffer {
  const outValue = out.reduce((sum, p) => sum + tradeValue(p), 0);
  const inValue = incoming.reduce((sum, p) => sum + tradeValue(p), 0);
  return {
    id,
    partnerId: partner.id,
    partnerName: partner.name,
    motive,
    out,
    in: incoming,
    edge: inValue - outValue,
    summary,
  };
}

/** Moves the named players between clubs and fixes up both rosters. */
export function executeTrade(state: GameState, offer: TradeOffer): void {
  const human = state.teams.find((t) => t.id === state.teamId);
  const partner = state.teams.find((t) => t.id === offer.partnerId);
  if (!human || !partner) return;

  const outIds = new Set(offer.out.map((p) => p.id));
  const inIds = new Set(offer.in.map((p) => p.id));

  human.players = human.players.filter((p) => !outIds.has(p.id));
  partner.players = partner.players.filter((p) => !inIds.has(p.id));

  offer.out.forEach((player) => {
    player.teamId = partner.id;
    player.homegrown = false;
    partner.players.push(player);
  });
  offer.in.forEach((player) => {
    player.teamId = human.id;
    // Acquired players are not homegrown, however young they are.
    player.homegrown = false;
    human.players.push(player);
  });
}
