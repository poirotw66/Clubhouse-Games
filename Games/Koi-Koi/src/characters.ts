export interface AnimalCharacter {
  id: string;
  name: string;
  animal: string;
  description: string;
  prompt: string;
  imageFile: string;
}

const STYLE_SUFFIX =
  'Square 1:1 avatar icon for circular crop, tight head-and-shoulders portrait, face large and centered filling 70 percent of frame, no oval border or decorative frame, simple dark indigo gradient background, wafu vermillion gold cream palette, soft watercolor anime illustration, symmetrical composition, no text, no watermark, high quality game profile art';

export const ANIMAL_CHARACTERS: AnimalCharacter[] = [
  {
    id: 'kitsune',
    name: '白狐',
    animal: '狐狸',
    description: '狡黠聰明的狐仙，擅長察言觀色。',
    prompt: `Anthropomorphic white kitsune fox spirit with red facial markings and fluffy tail tip, silver-trimmed crimson kimono, one small golden fox mask accessory, serene mysterious smile. ${STYLE_SUFFIX}`,
    imageFile: 'kitsune.webp',
  },
  {
    id: 'tanuki',
    name: '狸太郎',
    animal: '狸貓',
    description: '樂天開朗的狸貓，牌運時好時壞。',
    prompt: `Anthropomorphic tanuki raccoon dog with big cheerful eyes and leaf on head, brown and olive green kimono with gold leaf patterns, playful warm grin. ${STYLE_SUFFIX}`,
    imageFile: 'tanuki.webp',
  },
  {
    id: 'neko',
    name: '三毛',
    animal: '貓',
    description: '優雅從容的貓妖，出牌總是不慌不忙。',
    prompt: `Anthropomorphic calico neko cat with amber eyes, black white and orange fur, lavender and cream kimono with bell collar, calm elegant expression. ${STYLE_SUFFIX}`,
    imageFile: 'neko.webp',
  },
  {
    id: 'tsuru',
    name: '鶴丸',
    animal: '鶴',
    description: '高貴的丹頂鶴，象徵吉祥與長壽。',
    prompt: `Anthropomorphic Japanese red-crowned crane tsuru with graceful long neck feathers, white and black plumage, pale blue and white formal kimono, dignified noble posture. ${STYLE_SUFFIX}`,
    imageFile: 'tsuru.webp',
  },
  {
    id: 'koi',
    name: '錦鯉',
    animal: '鯉',
    description: '逆流而上的錦鯉，寓意好運連連。',
    prompt: `Anthropomorphic koi fish spirit with orange white and gold scales on cheeks and hair-like fins, flowing indigo kimono with koi scale embroidery, determined bright eyes. ${STYLE_SUFFIX}`,
    imageFile: 'koi.webp',
  },
  {
    id: 'shika',
    name: '楓鹿',
    animal: '鹿',
    description: '溫馴的梅花鹿，喜歡收集光牌。',
    prompt: `Anthropomorphic gentle shika deer with small antlers and maple leaf accent, autumn brown and red kimono, soft kind expression with spotted fur details. ${STYLE_SUFFIX}`,
    imageFile: 'shika.webp',
  },
  {
    id: 'usagi',
    name: '月兔',
    animal: '兔',
    description: '月宮玉兔，靈巧敏捷的反應派玩家。',
    prompt: `Anthropomorphic white usagi rabbit with long ears tied with red ribbon, pale pink and white kimono with moon motif, cute alert energetic expression. ${STYLE_SUFFIX}`,
    imageFile: 'usagi.webp',
  },
  {
    id: 'fukurou',
    name: '梟翁',
    animal: '貓頭鷹',
    description: '博學的梟仙，記牌能力一流。',
    prompt: `Anthropomorphic fukurou horned owl with golden eyes and feathered brow, deep navy and gold scholar kimono, wise thoughtful composed expression. ${STYLE_SUFFIX}`,
    imageFile: 'fukurou.webp',
  },
  {
    id: 'inoshishi',
    name: '猪武',
    animal: '野豬',
    description: '豪邁的野豬武士，打法積極進取。',
    prompt: `Anthropomorphic inoshishi wild boar with small tusks and bristle hair topknot, dark red warrior kimono with gold boar crest, bold fierce but friendly grin. ${STYLE_SUFFIX}`,
    imageFile: 'inoshishi.webp',
  },
  {
    id: 'cho',
    name: '蝶姬',
    animal: '蝴蝶',
    description: '飄忽不定的蝶妖，擅長出奇制勝。',
    prompt: `Anthropomorphic cho butterfly fairy with iridescent purple and blue wing patterns as hair accessories, shimmering violet and gold kimono, ethereal graceful smile. ${STYLE_SUFFIX}`,
    imageFile: 'cho.webp',
  },
];

export const DEFAULT_CHARACTER_ID = 'kitsune';

export function getCharacterById(id: string): AnimalCharacter {
  return ANIMAL_CHARACTERS.find(c => c.id === id) ?? ANIMAL_CHARACTERS[0];
}

export function getCharacterImageUrl(character: AnimalCharacter): string {
  return `${import.meta.env.BASE_URL}avatars/characters/${character.imageFile}`;
}

export const CHARACTER_STORAGE_KEY = 'koi-koi-selected-character';
