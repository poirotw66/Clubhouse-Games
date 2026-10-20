/**
 * Hand-authored letter grids. Each distinct letter is one connected polyomino;
 * the grid itself is a known solution, so every level is solvable.
 *
 * Packs unlock sequentially. Daily calm uses DAILY_POOL keyed by local date.
 */

/** @typedef {{ id: string, name: string, pack: string, rows: string[] }} LevelDef */

/** @type {{ id: string, label: string, blurb: string }[]} */
export const PACKS = [
  {
    id: 'breath',
    label: 'Breath',
    blurb: 'Small boards. Soft shapes. Settle in.',
  },
  {
    id: 'garden',
    label: 'Garden',
    blurb: 'A little more room to wander.',
  },
  {
    id: 'hush',
    label: 'Hush',
    blurb: 'Wider quiet. Still no rush.',
  },
];

/** @type {LevelDef[]} */
export const CAMPAIGN = [
  // —— Breath ——
  {
    id: 'breath-01',
    name: 'A gentle beginning',
    pack: 'breath',
    rows: ['AABB', 'ACBD', 'ACCD', 'EEED'],
  },
  {
    id: 'breath-02',
    name: 'A little more room',
    pack: 'breath',
    rows: ['AABBC', 'ADBCC', 'ADDDE', 'FFFEE'],
  },
  {
    id: 'breath-03',
    name: 'Room to wonder',
    pack: 'breath',
    rows: ['AABBC', 'ADBCC', 'ADDDE', 'FFGEE', 'FGGGG'],
  },
  {
    id: 'breath-04',
    name: 'Soft corners',
    pack: 'breath',
    rows: ['AAAB', 'ACCB', 'DCCB', 'DEEE'],
  },
  {
    id: 'breath-05',
    name: 'Quiet terrace',
    pack: 'breath',
    rows: ['AABBC', 'ADBBC', 'ADDDC', 'EEEFF'],
  },
  {
    id: 'breath-06',
    name: 'Morning light',
    pack: 'breath',
    rows: ['AAAAB', 'CDDDB', 'CEEEB', 'CFFFF'],
  },

  // —— Garden ——
  {
    id: 'garden-01',
    name: 'Beautifully tangled',
    pack: 'garden',
    rows: ['AAABBC', 'DABBCC', 'DDDEEC', 'FGGEHH', 'FFGGHH'],
  },
  {
    id: 'garden-02',
    name: 'Stepping stones',
    pack: 'garden',
    rows: ['AABCDD', 'ABBCCD', 'EEFGHH', 'EFFGGH', 'IIJJJK'],
  },
  {
    id: 'garden-03',
    name: 'Winding path',
    pack: 'garden',
    rows: ['AAABCD', 'EEFBCD', 'EGGCCD', 'HHIIJJ', 'HKKIJJ'],
  },
  {
    id: 'garden-04',
    name: 'Leaf mosaic',
    pack: 'garden',
    rows: ['AABCCD', 'ABBCCD', 'EEFFGG', 'EHFFII', 'HHJJJI'],
  },
  {
    id: 'garden-05',
    name: 'Courtyard',
    pack: 'garden',
    rows: ['AAAABB', 'CDDDBB', 'CEEEFF', 'CGHHHF', 'GGIIII'],
  },
  {
    id: 'garden-06',
    name: 'Lantern row',
    pack: 'garden',
    rows: ['AABBCC', 'DABBEC', 'DDFFEC', 'GGFFHH', 'GIIIHH'],
  },
  {
    id: 'garden-07',
    name: 'Under the willow',
    pack: 'garden',
    rows: ['AABCDD', 'ABBCEE', 'FFGCHE', 'FIGGHH', 'IIJJJK'],
  },

  // —— Hush ——
  {
    id: 'hush-01',
    name: 'Everything, together',
    pack: 'hush',
    rows: ['AAABBC', 'DABBCC', 'DDDEEC', 'FGGEHH', 'FFGIHH', 'JJGIII'],
  },
  {
    id: 'hush-02',
    name: 'Deep porch',
    pack: 'hush',
    rows: ['AAABCD', 'EEFBCD', 'EGGCCD', 'HHIIJJ', 'HKKIJL', 'MMNNNL'],
  },
  {
    id: 'hush-03',
    name: 'Still water',
    pack: 'hush',
    rows: ['AABBCC', 'DABBEC', 'DDFFEC', 'GGFFHH', 'GIIIHH', 'JJJKKK'],
  },
  {
    id: 'hush-04',
    name: 'Long hallway',
    pack: 'hush',
    rows: ['AAAABB', 'CDDDBE', 'CFFFBE', 'CGHHII', 'GGHHJI', 'KKKKJJ'],
  },
  {
    id: 'hush-05',
    name: 'Moon garden',
    pack: 'hush',
    rows: ['AABCDD', 'ABBCEE', 'FFGCHE', 'FIGGHH', 'IIJJKK', 'LLLJMM'],
  },
  {
    id: 'hush-06',
    name: 'Midnight mosaic',
    pack: 'hush',
    rows: ['AABBCD', 'AEFBCD', 'EEFFGG', 'HHIIJG', 'HKKIJJ', 'LLLMMM'],
  },
  {
    id: 'hush-07',
    name: 'A quiet whole',
    pack: 'hush',
    rows: ['AAABCD', 'EEFBCD', 'EGGCCD', 'HHIIJJ', 'HKKIJL', 'MMNNNL', 'OOOPPP'],
  },
];

/**
 * Extra calm boards for the daily challenge (indexed by date hash).
 * Kept separate so campaign unlock order stays intentional.
 * @type {LevelDef[]}
 */
export const DAILY_POOL = [
  {
    id: 'daily-a',
    name: 'Today’s soft square',
    pack: 'daily',
    rows: ['AABB', 'ACCB', 'DEEB', 'DFFF'],
  },
  {
    id: 'daily-b',
    name: 'Today’s gentle curve',
    pack: 'daily',
    rows: ['AAABC', 'DDBBC', 'DEEEC', 'FFFFG'],
  },
  {
    id: 'daily-c',
    name: 'Today’s little orchard',
    pack: 'daily',
    rows: ['AABCD', 'ABBCD', 'EEFFG', 'EHFIG', 'HHHII'],
  },
  {
    id: 'daily-d',
    name: 'Today’s porch light',
    pack: 'daily',
    rows: ['AAABB', 'CDDBB', 'CEEFF', 'GGHHF', 'GIIII'],
  },
  {
    id: 'daily-e',
    name: 'Today’s stone path',
    pack: 'daily',
    rows: ['AABCDD', 'ABBCEE', 'FFGCHE', 'FIGGHH', 'IIJJJK'],
  },
  {
    id: 'daily-f',
    name: 'Today’s quiet lattice',
    pack: 'daily',
    rows: ['AABBCC', 'DABEEC', 'DDFFEC', 'GGFFHH', 'GIIIHH'],
  },
  {
    id: 'daily-g',
    name: 'Today’s evening hush',
    pack: 'daily',
    rows: ['AAABCD', 'EEFBCD', 'EGGCCD', 'HHIIJJ', 'HKKIJL', 'MMNNNL'],
  },
  {
    id: 'daily-h',
    name: 'Today’s woven mat',
    pack: 'daily',
    rows: ['AABCCD', 'ABBCCD', 'EEFFGG', 'EHFFII', 'HHJJJI'],
  },
  {
    id: 'daily-i',
    name: 'Today’s tide pool',
    pack: 'daily',
    rows: ['AAAAB', 'CDDDB', 'CEEEB', 'CFFFF'],
  },
  {
    id: 'daily-j',
    name: 'Today’s paper fold',
    pack: 'daily',
    rows: ['AABCD', 'ABBCD', 'EEFFG', 'EHFIG', 'HHHII'],
  },
  {
    id: 'daily-k',
    name: 'Today’s garden gate',
    pack: 'daily',
    rows: ['AABBCC', 'DABBEC', 'DDFFEC', 'GGFFHH', 'GIIIHH', 'JJJKKK'],
  },
  {
    id: 'daily-l',
    name: 'Today’s moon step',
    pack: 'daily',
    rows: ['AABCDD', 'ABBCEE', 'FFGCHE', 'FIGGHH', 'IIJJKK', 'LLLJMM'],
  },
  {
    id: 'daily-m',
    name: 'Today’s still pond',
    pack: 'daily',
    rows: ['AAABBC', 'DABBCC', 'DDDEEC', 'FGGEHH', 'FFGGHH'],
  },
  {
    id: 'daily-n',
    name: 'Today’s last light',
    pack: 'daily',
    rows: ['AABBCD', 'AEFBCD', 'EEFFGG', 'HHIIJG', 'HKKIJJ', 'LLLMMM'],
  },
];

export const CAMPAIGN_BY_ID = Object.fromEntries(CAMPAIGN.map((l) => [l.id, l]));

export function campaignIndex(id) {
  return CAMPAIGN.findIndex((l) => l.id === id);
}

export function levelsInPack(packId) {
  return CAMPAIGN.filter((l) => l.pack === packId);
}
