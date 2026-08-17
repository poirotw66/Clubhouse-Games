import { ability, isStar } from './players';
import { available, farm } from './roster';
import type { GameState, Player, Team } from './types';

/**
 * What a regular-season block asks you.
 *
 * The first version of this game put the same four-option menu in front of the
 * player forty times a tenure — 40 of 100 decisions — and one of the four was
 * literally "維持現狀：不做調整". A choice whose safe answer is "do nothing",
 * asked forty times, is not a choice; it is a "next" button wearing a costume.
 *
 * So every situation here is drawn from the club's actual state, and **every
 * option costs something**. There is no free hold. Declining to spend money
 * costs morale or heat or the board's patience instead, and the self-checks
 * enforce it.
 */
export interface BlockEffects {
  cash?: number;
  heat?: number;
  trust?: number;
  morale?: number;
  farmLevel?: number;
  /** Strength swing applied to this block only. */
  blockBonus?: number;
  /** Multiplier folded into next offseason's farm development. */
  farmBoost?: number;
}

export type PlayerEffect = 'promote' | 'injure-star' | 'rest-star';

export interface SituationOption {
  id: string;
  label: string;
  hint: string;
  effects: BlockEffects;
  playerEffect?: PlayerEffect;
  /** Line written into the report after choosing this. */
  outcome: string;
}

export interface SituationContext {
  state: GameState;
  team: Team;
  standing: number;
  blocksLeft: number;
  star: Player | null;
  prospect: Player | null;
  veteran: Player | null;
}

export interface Situation {
  id: string;
  weight: number;
  condition?: (ctx: SituationContext) => boolean;
  build: (ctx: SituationContext) => { prompt: string; options: SituationOption[] };
}

const name = (player: Player | null, fallback = '隊上的主力') => player?.name ?? fallback;

const contending = (ctx: SituationContext) => ctx.standing <= 2;
const sinking = (ctx: SituationContext) => ctx.standing >= 4;
const hasProspect = (ctx: SituationContext) => ctx.prospect !== null;
const hasStar = (ctx: SituationContext) => ctx.star !== null;
const hasVeteran = (ctx: SituationContext) => ctx.veteran !== null;
const solvent = (ctx: SituationContext) => ctx.state.finance.cash > 1500;
const late = (ctx: SituationContext) => ctx.blocksLeft <= 1;

export const SITUATIONS: Situation[] = [
  {
    id: 'ace-elbow',
    weight: 10,
    condition: (ctx) => hasStar(ctx),
    build: (ctx) => ({
      prompt: `${name(ctx.star)}說手肘有點緊，但影像檢查看不出東西。醫療團隊建議停一個月觀察，教練團說現在停就別想拚了。`,
      options: [
        {
          id: 'shut-down',
          label: '直接停機一個月',
          hint: '這一段戰力明顯下降，但人保住了。',
          effects: { blockBonus: -2.5, morale: 1 },
          outcome: '你把他停下來。球團上下都知道你選了人。',
        },
        {
          id: 'pitch-through',
          label: '讓他繼續投',
          hint: '戰力維持，但有機會直接報銷。',
          effects: { blockBonus: 0.5, morale: -1 },
          playerEffect: 'injure-star',
          outcome: '他繼續上場。',
        },
        {
          id: 'second-opinion',
          label: '送去美國二次診斷',
          hint: '花 600 萬買一個確定的答案，這一段先按兵不動。',
          effects: { cash: -600, blockBonus: -1, trust: 1 },
          outcome: '報告回來說是疲勞性發炎，休兩週就好。錢花得值。',
        },
      ],
    }),
  },
  {
    id: 'rookie-knocking',
    weight: 10,
    condition: hasProspect,
    build: (ctx) => ({
      prompt: `二軍的 ${name(ctx.prospect, '新秀')}（${ctx.prospect?.age} 歲）連續三週打爆二軍投手。媒體開始問你為什麼不升他上來。`,
      options: [
        {
          id: 'call-up',
          label: '升上一軍',
          hint: '即戰力與話題性，但太早上來會拖慢成長。',
          effects: { heat: 4, blockBonus: 0.8, farmBoost: 0.6 },
          playerEffect: 'promote',
          outcome: '他上來了。球迷很興奮，育成教練不太高興。',
        },
        {
          id: 'keep-cooking',
          label: '壓在二軍練滿',
          hint: '對他好，但你要自己扛輿論。',
          effects: { heat: -4, farmBoost: 1.25, trust: -1 },
          outcome: '你頂住了。叩應節目說你不懂球。',
        },
      ],
    }),
  },
  {
    id: 'clubhouse-rift',
    weight: 9,
    condition: (ctx) => hasVeteran(ctx) && hasStar(ctx),
    build: (ctx) => ({
      prompt: `${name(ctx.veteran, '老將')}和 ${name(ctx.star)}在休息室吵了起來，起因是守備位置。記者已經聞到味道。`,
      options: [
        {
          id: 'back-veteran',
          label: '力挺老將',
          hint: '穩住更衣室的輩分秩序，年輕主力會不爽。',
          effects: { morale: 1, blockBonus: -0.8 },
          outcome: '你站在老將那邊。秩序保住了，戰力沒有。',
        },
        {
          id: 'back-star',
          label: '力挺主力',
          hint: '戰力優先，但老將會在媒體上講話。',
          effects: { morale: -2, blockBonus: 1.2, heat: -2 },
          outcome: '你選了戰力。老將接受專訪時笑得很勉強。',
        },
        {
          id: 'lock-door',
          label: '關門開會，誰都不准對外講',
          hint: '花 200 萬做危機處理，兩邊都不滿意。',
          effects: { cash: -200, morale: -1, trust: 1 },
          outcome: '消息壓下來了。兩個人在場上還是不太傳球。',
        },
      ],
    }),
  },
  {
    id: 'sponsor-window',
    weight: 9,
    build: (ctx) => ({
      prompt: `一家手搖飲品牌想掛冠名，條件是這一段主場全部辦主題日、球員要配合拍廣告。行銷部說很划算，教練團說很吵。`,
      options: [
        {
          id: 'take-deal',
          label: '接下來',
          hint: `進帳 1200 萬與熱度，但球員被拉去跑活動。`,
          effects: { cash: 1200, heat: 6, blockBonus: -1, morale: -1 },
          outcome: '合約簽了。球員在廣告裡笑得很專業。',
        },
        {
          id: 'decline-deal',
          label: '婉拒，讓球員專心',
          hint: '戰力不受干擾，但董事會會問你錢的事。',
          effects: { trust: -2, blockBonus: 0.5 },
          outcome: '你回絕了。財務長在會議上把數字投影了兩次。',
        },
      ],
    }),
  },
  {
    id: 'ticket-slump',
    weight: 8,
    condition: (ctx) => ctx.state.heat < 55,
    build: () => ({
      prompt: '主場觀眾少得難看，轉播鏡頭一直帶到空位。',
      options: [
        {
          id: 'promo-blitz',
          label: '砸錢辦活動',
          hint: '花 500 萬換一波熱度。',
          effects: { cash: -500, heat: 9 },
          outcome: '煙火、玩偶、簽名會全上。看台終於有人了。',
        },
        {
          id: 'cut-price',
          label: '降票價衝人數',
          hint: '人進來了，但單場收入變薄。',
          effects: { cash: -300, heat: 6, trust: -1 },
          outcome: '票價砍下去，人潮回來了一些。',
        },
        {
          id: 'ride-it',
          label: '不管它，成績才是解藥',
          hint: '不花錢，但熱度會繼續掉。',
          effects: { heat: -5 },
          outcome: '你決定用戰績說話。這一段看台依然很空。',
        },
      ],
    }),
  },
  {
    id: 'trade-whisper',
    weight: 8,
    condition: (ctx) => sinking(ctx) && hasStar(ctx),
    build: (ctx) => ({
      prompt: `戰績掉到第 ${ctx.standing}，有球團私下問 ${name(ctx.star)}賣不賣。消息不知怎麼流出去了。`,
      options: [
        {
          id: 'deny',
          label: '公開否認，把人留住',
          hint: '更衣室安心，但你等於把話說死。',
          effects: { morale: 2, trust: -1 },
          outcome: '你在記者會上說他不賣。他當晚打了一支三分砲。',
        },
        {
          id: 'listen',
          label: '保持沉默，繼續聽價',
          hint: '保留彈性，但全隊都在看你。',
          effects: { morale: -2, trust: 1, heat: -3 },
          outcome: '你什麼都沒說。休息室安靜了好幾天。',
        },
      ],
    }),
  },
  {
    id: 'farm-flood',
    weight: 7,
    build: () => ({
      prompt: '二軍球場排水系統壞了，一場雨就泡在水裡。整修要停用六週。',
      options: [
        {
          id: 'fix-now',
          label: '立刻整修',
          hint: '花 900 萬，育成環境長期受益。',
          effects: { cash: -900, farmLevel: 1 },
          outcome: '工程隊進場。二軍教練第一次主動跟你握手。',
        },
        {
          id: 'patch',
          label: '先鋪防水布撐過去',
          hint: '省錢，但育成會受影響。',
          effects: { cash: -100, farmBoost: 0.8 },
          outcome: '藍白帆布蓋上去。看起來就是一個會被拍到的畫面。',
        },
      ],
    }),
  },
  {
    id: 'umpire-storm',
    weight: 7,
    build: () => ({
      prompt: '一次爭議判決之後，總教練衝出去被驅逐出場，球迷在社群炸鍋。',
      options: [
        {
          id: 'defend-coach',
          label: '公開挺總教練',
          hint: '更衣室凝聚，但聯盟會找你喝茶。',
          effects: { morale: 2, heat: 5, cash: -200, trust: -1 },
          outcome: '你站出去挺他。罰款單三天後寄到。',
        },
        {
          id: 'apologise',
          label: '代表球團道歉',
          hint: '跟聯盟關係修好，教練團會記住這件事。',
          effects: { trust: 2, morale: -2 },
          outcome: '你鞠了躬。總教練那天沒跟你講話。',
        },
      ],
    }),
  },
  {
    id: 'hot-streak',
    weight: 8,
    condition: contending,
    build: (ctx) => ({
      prompt: `球隊連勝，暫居第 ${ctx.standing}。球迷開始喊總冠軍，但主力這一段幾乎沒休息過。`,
      options: [
        {
          id: 'push',
          label: '趁勢追擊，主力全上',
          hint: '這一段戰力拉滿，代價在後面。',
          effects: { blockBonus: 2, morale: -2, heat: 4 },
          outcome: '主力全上。這一段打得很兇。',
        },
        {
          id: 'rotate',
          label: '輪休，把體力留給後半季',
          hint: '這一段略降，但人是新的。',
          effects: { blockBonus: -1.2, morale: 2 },
          outcome: '你開始輪休。球迷在社群上問你是不是放棄了。',
        },
      ],
    }),
  },
  {
    id: 'losing-spiral',
    weight: 8,
    condition: sinking,
    build: (ctx) => ({
      prompt: `連敗中，聯盟第 ${ctx.standing}。總教練在記者會上說「責任在我」，但大家都在看你會不會換人。`,
      options: [
        {
          id: 'fire-coach',
          label: '換總教練',
          hint: '花 800 萬解約金，短期會反彈。',
          effects: { cash: -800, blockBonus: 1, morale: -2, heat: 5 },
          outcome: '你換了人。新教練第一場就贏了，但沒人知道能撐多久。',
        },
        {
          id: 'keep-coach',
          label: '留任，公開背書',
          hint: '教練團感激，但董事會會記帳。',
          effects: { morale: 2, trust: -2 },
          outcome: '你說了「我完全信任他」。這句話會被剪成新聞標題。',
        },
        {
          id: 'blame-self',
          label: '自己出來扛',
          hint: '保住所有人，代價全記在你頭上。',
          effects: { trust: -3, morale: 3, heat: 2 },
          outcome: '你在記者會上說是自己補強不力。更衣室氣氛好轉。',
        },
      ],
    }),
  },
  {
    id: 'gambling-rumour',
    weight: 6,
    build: () => ({
      prompt: '有匿名爆料說隊上某人跟不該接觸的人吃飯。沒有證據，但媒體已經在問了。',
      options: [
        {
          id: 'internal-probe',
          label: '啟動內部調查',
          hint: '花 700 萬與一段時間的低氣壓，但查清楚。',
          effects: { cash: -700, morale: -3, trust: 3 },
          outcome: '查完是誤會。過程中沒有人好過。',
        },
        {
          id: 'stonewall',
          label: '對外否認，內部不動',
          hint: '風波快過去，但如果是真的就麻煩了。',
          effects: { heat: -4, trust: -2, morale: 1 },
          outcome: '新聞兩天後就沒了。你不確定自己賭對沒有。',
        },
      ],
    }),
  },
  {
    id: 'veteran-benched',
    weight: 7,
    condition: hasVeteran,
    build: (ctx) => ({
      prompt: `${name(ctx.veteran, '老將')}（${ctx.veteran?.age} 歲）狀態明顯下滑，但他是隊上待最久的人，球迷買他的球衣。`,
      options: [
        {
          id: 'bench-him',
          label: '拉下先發',
          hint: '戰力誠實，感情不誠實。',
          effects: { blockBonus: 1, morale: -2, heat: -4 },
          outcome: '你把他放板凳。他什麼都沒說，那更難受。',
        },
        {
          id: 'keep-starting',
          label: '繼續讓他先發',
          hint: '球迷與更衣室都領情，成績不領情。',
          effects: { blockBonus: -1.2, morale: 2, heat: 3 },
          outcome: '他繼續站在那裡。有幾球他真的接不到了。',
        },
      ],
    }),
  },
  {
    id: 'foreign-import',
    weight: 8,
    condition: solvent,
    build: () => ({
      prompt: '仲介推薦一位剛被大聯盟釋出的洋投，開價不低，但立刻能用。',
      options: [
        {
          id: 'sign-import',
          label: '簽下來',
          hint: '花 1400 萬換立即戰力。',
          effects: { cash: -1400, blockBonus: 2.2, heat: 3 },
          outcome: '洋投報到，第一場先發就飆到 155。',
        },
        {
          id: 'cheap-import',
          label: '找便宜一點的',
          hint: '花 500 萬，效果不確定。',
          effects: { cash: -500, blockBonus: 0.6 },
          outcome: '找了個便宜的。控球比想像中好，球速比想像中慢。',
        },
        {
          id: 'no-import',
          label: '不補，用本土',
          hint: '省錢，但這一段要自己撐。',
          effects: { blockBonus: -0.8, morale: 1, trust: -1 },
          outcome: '你決定用本土投手撐完。年輕人多了不少上場機會。',
        },
      ],
    }),
  },
  {
    id: 'weather-cancel',
    weight: 6,
    build: () => ({
      prompt: '連日豪雨，這一段有五場比賽要重新安排。密集賽程對誰都不好。',
      options: [
        {
          id: 'doubleheader',
          label: '排雙重賽消化',
          hint: '賽程清乾淨，但球員會累垮。',
          effects: { blockBonus: -1.5, cash: 400, morale: -2 },
          outcome: '雙重賽排下去。牛棚在第二場明顯沒力。',
        },
        {
          id: 'push-back',
          label: '往後延，擠到季末',
          hint: '現在輕鬆，季末會很擠。',
          effects: { cash: -300, morale: 1 },
          outcome: '延賽了。季末的賽程表看起來很可怕。',
        },
      ],
    }),
  },
  {
    id: 'youth-camp',
    weight: 7,
    build: () => ({
      prompt: '基層教練來談合作，想在南部辦長期的青棒訓練營。看不到短期效益。',
      options: [
        {
          id: 'fund-camp',
          label: '出錢辦',
          hint: '花 600 萬，育成體系長期受益。',
          effects: { cash: -600, farmLevel: 1, heat: 2 },
          outcome: '訓練營掛牌。三年後你才會知道值不值得。',
        },
        {
          id: 'lend-name',
          label: '只掛名不出錢',
          hint: '有形象，沒有實質。',
          effects: { heat: 1, trust: -1 },
          outcome: '你掛了名。基層教練的表情很有禮貌。',
        },
      ],
    }),
  },
  {
    id: 'star-contract-leak',
    weight: 7,
    condition: hasStar,
    build: (ctx) => ({
      prompt: `${name(ctx.star)}的經紀人放話說「還沒收到球團的誠意」。距離約滿還有一段時間，但這話是說給別隊聽的。`,
      options: [
        {
          id: 'early-extend',
          label: '提前談延長約',
          hint: '花 1000 萬定金鎖住人。',
          effects: { cash: -1000, morale: 2, trust: 1 },
          outcome: '延長約談成了。經紀人在記者會上稱讚球團有遠見。',
        },
        {
          id: 'wait-it-out',
          label: '照原訂時程，不加碼',
          hint: '守住薪資結構，但人心會浮動。',
          effects: { morale: -2, heat: -2 },
          outcome: '你沒有加碼。他在場上還是很拚，只是不再受訪。',
        },
      ],
    }),
  },
  {
    id: 'analytics-hire',
    weight: 7,
    build: () => ({
      prompt: '一位做運動科學的博士想加入球團，要求建一個數據部門。教練團明顯排斥。',
      options: [
        {
          id: 'build-dept',
          label: '成立數據部門',
          hint: '花 800 萬，育成與調度長期改善。',
          effects: { cash: -800, farmLevel: 1, morale: -1, trust: 1 },
          outcome: '部門成立了。第一份報告就跟總教練的直覺打架。',
        },
        {
          id: 'consultant',
          label: '先用顧問形式試試',
          hint: '花 250 萬，小規模驗證。',
          effects: { cash: -250, farmBoost: 1.1 },
          outcome: '他以顧問身分進來。教練團客氣但保持距離。',
        },
        {
          id: 'pass-analytics',
          label: '不需要',
          hint: '省錢，但你會在別隊身上看到成果。',
          effects: { trust: -1, farmBoost: 0.95 },
          outcome: '你婉拒了。半年後他去了別隊。',
        },
      ],
    }),
  },
  {
    id: 'fan-protest',
    weight: 6,
    condition: (ctx) => sinking(ctx) && ctx.state.heat < 45,
    build: () => ({
      prompt: '死忠球迷在球場外拉白布條，要求球團給說法。人不多，但照片很有力。',
      options: [
        {
          id: 'meet-fans',
          label: '親自出去談',
          hint: '風險很高，但誠意是真的。',
          effects: { heat: 6, morale: 1, trust: -1 },
          outcome: '你走出去站了四十分鐘。有人罵，也有人握手。',
        },
        {
          id: 'statement',
          label: '發新聞稿',
          hint: '安全，但沒有人會被說服。',
          effects: { heat: -2, trust: 1 },
          outcome: '新聞稿發出去了。留言區沒有一句好話。',
        },
      ],
    }),
  },
  {
    id: 'prospect-injury',
    weight: 7,
    condition: hasProspect,
    build: (ctx) => ({
      prompt: `${name(ctx.prospect, '新秀')}在二軍練習時扭到腳踝。不嚴重，但要決定怎麼處理。`,
      options: [
        {
          id: 'full-rehab',
          label: '完整復健，寧可慢',
          hint: '花 300 萬，把底子養好。',
          effects: { cash: -300, farmBoost: 1.2 },
          outcome: '他進了復健療程。復出時體能反而更好。',
        },
        {
          id: 'rush-back',
          label: '趕快回來練',
          hint: '省時間，但有後遺症的風險。',
          effects: { farmBoost: 0.75, morale: -1 },
          outcome: '他兩週後就回到場上。腳踝纏得很緊。',
        },
      ],
    }),
  },
  {
    id: 'rival-signing',
    weight: 7,
    build: () => ({
      prompt: '同區對手砸重金補了一個大物，媒體開始比較兩隊的補強力度。',
      options: [
        {
          id: 'match-move',
          label: '也去市場上找人',
          hint: '花 1100 萬回應，不然氣勢會被壓過去。',
          effects: { cash: -1100, blockBonus: 1.5, heat: 4 },
          outcome: '你也補了一個。媒體說這是軍備競賽。',
        },
        {
          id: 'stay-course',
          label: '按自己的節奏走',
          hint: '守住預算，但要承受比較。',
          effects: { heat: -3, trust: 1 },
          outcome: '你什麼都沒做。專欄標題是「沉默的球團」。',
        },
      ],
    }),
  },
  {
    id: 'bullpen-burnout',
    weight: 8,
    build: () => ({
      prompt: '牛棚這一段被操得很兇，後援投手的球速掉了三公里。',
      options: [
        {
          id: 'call-arms',
          label: '從二軍調投手上來擋',
          hint: '有人擋刀，但那些人還沒準備好。',
          effects: { blockBonus: -0.5, farmBoost: 0.85 },
          outcome: '二軍投手上來擋了幾局。有的撐住，有的沒有。',
        },
        {
          id: 'ride-bullpen',
          label: '繼續用，撐過這一段',
          hint: '短期戰力保住，代價是後面。',
          effects: { blockBonus: 1, morale: -2 },
          outcome: '牛棚繼續上。訓練員的臉色越來越差。',
        },
        {
          id: 'six-man',
          label: '改六人先發輪值',
          hint: '花 200 萬調整編制，牛棚喘口氣。',
          effects: { cash: -200, blockBonus: -0.6, morale: 2 },
          outcome: '改成六人輪值。牛棚終於有人能連兩天不上場。',
        },
      ],
    }),
  },
  {
    id: 'broadcast-deal',
    weight: 7,
    build: () => ({
      prompt: '轉播單位想加購你們的主場包，但要求把幾場比賽挪到平日晚上的冷門時段。',
      options: [
        {
          id: 'take-broadcast',
          label: '接受',
          hint: '進帳 900 萬，現場觀眾會變少。',
          effects: { cash: 900, heat: -4 },
          outcome: '轉播合約加簽。平日晚上的看台很空。',
        },
        {
          id: 'refuse-broadcast',
          label: '拒絕，保住主場氣氛',
          hint: '不賺這筆，董事會會問。',
          effects: { heat: 3, trust: -1 },
          outcome: '你拒絕了。主場的氣氛確實比較像回事。',
        },
      ],
    }),
  },
  {
    id: 'title-push',
    weight: 9,
    condition: (ctx) => contending(ctx) && late(ctx),
    build: (ctx) => ({
      prompt: `剩最後一段，你們排在第 ${ctx.standing}。要不要把明年的資源壓進今年？`,
      options: [
        {
          id: 'all-in',
          label: '全押今年',
          hint: '花 1600 萬買戰力，明年的事明年再說。',
          effects: { cash: -1600, blockBonus: 3, heat: 6, farmBoost: 0.8 },
          outcome: '你把能動的都動了。這是你的一年。',
        },
        {
          id: 'balanced-push',
          label: '小幅補強',
          hint: '花 500 萬，不傷根基。',
          effects: { cash: -500, blockBonus: 1 },
          outcome: '你補了一點。不多，但夠用。',
        },
        {
          id: 'no-push',
          label: '什麼都不加',
          hint: '省下所有資源，但球迷與更衣室都在等你表態。',
          effects: { morale: -2, heat: -5 },
          outcome: '你按兵不動。更衣室裡沒有人問你為什麼。',
        },
      ],
    }),
  },
  {
    id: 'tank-question',
    weight: 8,
    condition: (ctx) => sinking(ctx) && late(ctx),
    build: () => ({
      prompt: 'season 已經沒救了。有人建議把主力收起來，好拿到更前面的選秀順位。',
      options: [
        {
          id: 'tank',
          label: '收起來，拚選秀順位',
          hint: '這一段直接放掉，換未來。',
          effects: { blockBonus: -3, farmBoost: 1.3, heat: -6, morale: -2 },
          outcome: '主力一個個「休息」。看得懂的人都看懂了。',
        },
        {
          id: 'play-straight',
          label: '照常打完',
          hint: '對得起買票的人，順位就算了。',
          effects: { heat: 3, morale: 2, trust: 1 },
          outcome: '你讓他們照常打完。最後一場還是滿場。',
        },
      ],
    }),
  },
  {
    id: 'equipment-upgrade',
    weight: 6,
    build: () => ({
      prompt: '重訓室的器材是十年前的，體能教練遞了一份採購清單上來。',
      options: [
        {
          id: 'buy-gear',
          label: '照單全買',
          hint: '花 700 萬，訓練品質提升。',
          effects: { cash: -700, farmBoost: 1.15, morale: 1 },
          outcome: '新器材裝好那天，球員自己留下來多練了一小時。',
        },
        {
          id: 'partial-gear',
          label: '只買最必要的',
          hint: '花 250 萬，先擋著。',
          effects: { cash: -250 },
          outcome: '買了一半。清單上剩下的被貼在牆上。',
        },
        {
          id: 'no-gear',
          label: '明年再說',
          hint: '省錢，體能教練會很有意見。',
          effects: { morale: -2, trust: 1 },
          outcome: '你把清單收進抽屜。體能教練沒有再提第二次。',
        },
      ],
    }),
  },
  {
    id: 'charity-game',
    weight: 6,
    build: () => ({
      prompt: '地方政府邀請球團辦一場公益義賽，沒有出場費，但市長會到。',
      options: [
        {
          id: 'play-charity',
          label: '接下來',
          hint: '形象與地方關係，代價是球員的休息日。',
          effects: { heat: 5, morale: -1, trust: 1, cash: -150 },
          outcome: '義賽辦得很成功。球員笑得有點累。',
        },
        {
          id: 'skip-charity',
          label: '婉拒',
          hint: '球員有假放，地方關係會冷掉。',
          effects: { morale: 2, heat: -3, trust: -1 },
          outcome: '你婉拒了。市長辦公室沒有再打電話來。',
        },
      ],
    }),
  },
  {
    id: 'scout-tip',
    weight: 7,
    build: () => ({
      prompt: '球探回報，有個高中投手被其他隊漏看了，但要多派人去追蹤才確定。',
      options: [
        {
          id: 'chase-tip',
          label: '加派球探追',
          hint: '花 400 萬，選秀時的資訊會更準。',
          effects: { cash: -400, farmLevel: 1 },
          outcome: '球探組跟了他兩個月。那份報告很厚。',
        },
        {
          id: 'ignore-tip',
          label: '資源留給別的事',
          hint: '省錢，但選秀時你就是在賭。',
          effects: { farmBoost: 0.95, trust: 1 },
          outcome: '你沒有追。選秀那天他在第二輪被別隊挑走。',
        },
      ],
    }),
  },
  {
    id: 'star-slump',
    weight: 8,
    condition: hasStar,
    build: (ctx) => ({
      prompt: `${name(ctx.star)}陷入低潮，打擊率掉了快一成。他自己說沒事，但每次揮空後都會盯著球棒看很久。`,
      options: [
        {
          id: 'rest-star',
          label: '讓他坐幾天',
          hint: '這一段少一個主力，但腦袋可以清一下。',
          effects: { blockBonus: -1.5, morale: 2 },
          playerEffect: 'rest-star',
          outcome: '他坐了幾天板凳。回來第一打席就打了安打。',
        },
        {
          id: 'play-through-slump',
          label: '讓他自己打出來',
          hint: '相信他，但低潮可能拖更久。',
          effects: { blockBonus: -0.5, morale: -1 },
          outcome: '你讓他繼續站上打擊區。有幾場真的很難看。',
        },
        {
          id: 'hire-hitting-coach',
          label: '外聘打擊指導',
          hint: '花 350 萬找人專門帶他。',
          effects: { cash: -350, blockBonus: 0.5, morale: 1 },
          outcome: '外聘的教練陪他加練了兩週。動作看起來順了。',
        },
      ],
    }),
  },
  {
    id: 'stadium-lease',
    weight: 6,
    build: () => ({
      prompt: '球場的租約要重談，市府想調漲，但也願意談長約。',
      options: [
        {
          id: 'long-lease',
          label: '簽長約鎖成本',
          hint: '先付 1000 萬，換未來的穩定。',
          effects: { cash: -1000, trust: 2 },
          outcome: '長約簽了十年。財務長終於可以做預測了。',
        },
        {
          id: 'short-lease',
          label: '簽短約保彈性',
          hint: '現在便宜，以後再說。',
          effects: { cash: -200, trust: -1 },
          outcome: '你簽了短約。這件事三年後會再回來找你。',
        },
      ],
    }),
  },
  {
    id: 'merch-boom',
    weight: 6,
    condition: (ctx) => ctx.state.heat > 65,
    build: () => ({
      prompt: '球隊人氣正旺，週邊商品供不應求。要不要加開產線？',
      options: [
        {
          id: 'expand-merch',
          label: '加開產線',
          hint: '賺到最多，但滿街都是球衣之後就不稀奇了。',
          effects: { cash: 1400, heat: -4 },
          outcome: '補貨上架三小時完售。一個月後夜市也在賣。',
        },
        {
          id: 'keep-scarce',
          label: '維持限量',
          hint: '話題性拉高，但等於把錢留在桌上。',
          effects: { cash: 300, heat: 4, trust: -1 },
          outcome: '限量策略奏效，二手價炒到三倍。財務長把銷售預估投影了兩次。',
        },
      ],
    }),
  },
];

/** Best available player on the major-league roster. */
function bestStar(team: Team): Player | null {
  const pool = available(team).filter((p) => p.level === 'major');
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => ability(b) - ability(a))[0];
}

function bestProspect(team: Team): Player | null {
  const pool = farm(team);
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => ability(b) - ability(a))[0];
}

function oldestRegular(team: Team): Player | null {
  const pool = available(team).filter((p) => p.level === 'major' && p.age >= 32);
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => b.age - a.age)[0];
}

export function buildContext(
  state: GameState,
  team: Team,
  standing: number,
  blocksLeft: number,
): SituationContext {
  return {
    state,
    team,
    standing,
    blocksLeft,
    star: bestStar(team),
    prospect: bestProspect(team),
    veteran: oldestRegular(team),
  };
}

/**
 * Choose the situation for this block, unseen ones first.
 *
 * Forty blocks a tenure against thirty situations means a run sees most of them
 * once and a handful twice — enough that the regular season stops being a
 * button you press.
 */
export function pickSituation(
  ctx: SituationContext,
  seen: string[],
  rng: () => number,
): Situation {
  const eligible = SITUATIONS.filter((s) => !s.condition || s.condition(ctx));
  const pool = eligible.length > 0 ? eligible : SITUATIONS;
  const unseen = pool.filter((s) => !seen.includes(s.id));
  const from = unseen.length > 0 ? unseen : pool;

  const total = from.reduce((sum, s) => sum + s.weight, 0);
  let roll = rng() * total;
  for (const situation of from) {
    roll -= situation.weight;
    if (roll <= 0) return situation;
  }
  return from[from.length - 1];
}

export function situationById(id: string): Situation | undefined {
  return SITUATIONS.find((s) => s.id === id);
}

export { isStar };
