/**
 * M3 — named career chapters. The calendar still advances by turn/age, but
 * chapter intro/outro cards give the arc a ritual beat so a life reads like a
 * story rather than age++.
 */
import type { ChapterCard, ChapterId, GameState, Stage } from './types';

export interface ChapterDef {
  id: ChapterId;
  title: string;
  /** Short label shown in the status strip. */
  short: string;
  intro: { title: string; prompt: string; lines: string[] };
  outro: { title: string; prompt: string; lines: string[] };
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'hs-year1',
    title: '高一・球兒入部',
    short: '高一',
    intro: {
      title: '第一章　球兒入部',
      prompt: '制服還有點大。教練喊你的名字時，你第一次覺得自己真的站在棒球場上。',
      lines: ['練習會很硬，夏天會很熱。這三年，會決定你是誰。'],
    },
    outro: {
      title: '高一・收束',
      prompt: '一年過去。置物櫃裡多了貼布與球棒膠的味道。',
      lines: ['高二的號碼比較靠近先發名單了。'],
    },
  },
  {
    id: 'hs-year2',
    title: '高二・主力爭奪',
    short: '高二',
    intro: {
      title: '第二章　主力的位子',
      prompt: '學長畢業了。教練看著你的眼神，跟高一時不一樣。',
      lines: ['這一季不是「跟著練」，是「你要扛」。'],
    },
    outro: {
      title: '高二・收束',
      prompt: '黑豹旗與聯賽的灰塵還沾在球鞋上。',
      lines: ['最後一夏，已經排在日曆上。'],
    },
  },
  {
    id: 'hs-year3',
    title: '高三・最後一夏',
    short: '高三',
    intro: {
      title: '第三章　最後一夏',
      prompt: '高三的春天特別短。每個人都在數剩下幾次揮棒。',
      lines: ['畢業之後的路，會在這個夏天被寫進球探筆記。'],
    },
    outro: {
      title: '高中・落幕',
      prompt: '棒球部的門在身後關上。制服摺好，名字還留在成績冊上。',
      lines: ['選秀夜的燈，比練習場亮得多。'],
    },
  },
  {
    id: 'draft-night',
    title: '選秀之夜',
    short: '選秀',
    intro: {
      title: '間章　選秀之夜',
      prompt: '攝影機、名片、還沒拆封的西装。名字被念到之前，時間走得很慢。',
      lines: ['無論結果如何，這都是你棒球人生的分岔口。'],
    },
    outro: {
      title: '選秀・之後',
      prompt: '燈滅了。路上有人鼓掌，也有人安靜地走。',
      lines: ['下一章的隊名，已經寫在合約或拒絕信上。'],
    },
  },
  {
    id: 'amateur',
    title: '業餘磨練',
    short: '業餘',
    intro: {
      title: '第四章　業餘磨練',
      prompt: '沒有鎂光燈的早晨。你還是要練，還是要等下一次被點名。',
      lines: ['這條路比較長，但很多人在這裡才長出真正的球。'],
    },
    outro: {
      title: '業餘・收束',
      prompt: '再次走到選秀門口。這次口袋裡多了幾季的成績單。',
      lines: [],
    },
  },
  {
    id: 'pro-rookie',
    title: '一軍搶位',
    short: '新銳',
    intro: {
      title: '第五章　一軍搶位',
      prompt: '職業的休息室比較安靜。每個人都在搶同一個打擊序。',
      lines: ['教練說：先活過春天，再談夢想。'],
    },
    outro: {
      title: '新銳・站穩',
      prompt: '名單上的名字不再用鉛筆寫。',
      lines: ['球團開始用「主力」談論你。'],
    },
  },
  {
    id: 'pro-peak',
    title: '巅峰合同年',
    short: '巅峰',
    intro: {
      title: '第六章　巅峰',
      prompt: '廣告、訪答、FA 傳聞。你打得最好的那幾年，通常也最吵。',
      lines: ['宿敵還在對面。球迷記得你的每一次關鍵打席。'],
    },
    outro: {
      title: '巅峰・餘韻',
      prompt: '合同年過去。鏡子裡的揮棒還在，恢復日卻變長了。',
      lines: [],
    },
  },
  {
    id: 'pro-veteran',
    title: '老將角色',
    short: '老將',
    intro: {
      title: '終章　老將',
      prompt: '菜鳥叫你前輩。教練請你講話。你開始把經驗當成另一種武器。',
      lines: ['還能打多久，只有身體知道。'],
    },
    outro: {
      title: '生涯・謝幕',
      prompt: '球具收進袋子。場上的燈一盞一盞熄掉。',
      lines: ['故事寫完了——但名字會留在某一頁。'],
    },
  },
];

export function chapterById(id: ChapterId): ChapterDef | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

export function chapterShort(id: ChapterId | null | undefined): string {
  if (!id) return '';
  return chapterById(id)?.short ?? id;
}

/** Which chapter the calendar *should* be in right now (before ritual cards). */
export function inferChapterId(state: GameState): ChapterId {
  if (state.stage === 'highschool') {
    if (state.turnIndex >= HS_YEAR3_START) return 'hs-year3';
    if (state.turnIndex >= HS_YEAR2_START) return 'hs-year2';
    return 'hs-year1';
  }
  if (state.stage === 'amateur') return 'amateur';
  // Pro arc by age / fame — peak when the contract years matter most.
  if (state.age >= 33) return 'pro-veteran';
  if (state.age >= 27 || (state.meta.fame >= 62 && state.age >= 25)) return 'pro-peak';
  return 'pro-rookie';
}

const HS_YEAR2_START = 5;
const HS_YEAR3_START = 10;

/**
 * After a turn advances stage/age, queue intro (and optional outro of the
 * previous chapter) so the player sees a ritual card before the next menu.
 */
export function syncChapterCards(state: GameState): void {
  if (state.pendingChapter) return;
  // Draft night is forced around the graduation path decision.
  if (
    state.stage === 'highschool' &&
    state.turnIndex >= 15 &&
    !state.chaptersSeen.includes('draft-night')
  ) {
    queueIntro(state, 'draft-night');
    return;
  }

  const target = inferChapterId(state);
  if (state.chapterId === target && state.chaptersSeen.includes(target)) return;

  // Leaving a chapter: show outro once, then intro of the next.
  if (
    state.chapterId &&
    state.chapterId !== target &&
    !state.chaptersSeen.includes(`${state.chapterId}:outro`)
  ) {
    const prev = chapterById(state.chapterId);
    if (prev) {
      state.pendingChapter = {
        chapterId: state.chapterId,
        phase: 'outro',
        title: prev.outro.title,
        prompt: prev.outro.prompt,
        lines: [...prev.outro.lines],
      };
      return;
    }
  }

  if (!state.chaptersSeen.includes(target)) {
    queueIntro(state, target);
  } else {
    state.chapterId = target;
  }
}

function queueIntro(state: GameState, id: ChapterId): void {
  const def = chapterById(id);
  if (!def) return;
  state.pendingChapter = {
    chapterId: id,
    phase: 'intro',
    title: def.intro.title,
    prompt: def.intro.prompt,
    lines: [...def.intro.lines],
  };
}

/** Apply the continue choice on a chapter card. */
export function resolveChapterCard(state: GameState): {
  headline: string;
  lines: string[];
  tone: 'normal' | 'good' | 'great';
} {
  const card = state.pendingChapter;
  if (!card) return { headline: '', lines: [], tone: 'normal' };
  const def = chapterById(card.chapterId);
  const lines = [...card.lines];
  if (card.phase === 'intro') {
    state.chapterId = card.chapterId;
    if (!state.chaptersSeen.includes(card.chapterId)) {
      state.chaptersSeen.push(card.chapterId);
    }
    state.chapterHistory.push({
      id: card.chapterId,
      title: def?.title ?? card.chapterId,
      year: state.year,
      age: state.age,
    });
    // Entering a new stage chapter: nudge motivation so the ritual matters.
    if (card.chapterId === 'pro-rookie' || card.chapterId === 'hs-year3') {
      state.meta.motivation = Math.min(100, state.meta.motivation + 4);
    }
  } else {
    const key = `${card.chapterId}:outro`;
    if (!state.chaptersSeen.includes(key)) state.chaptersSeen.push(key);
  }
  state.pendingChapter = null;
  return {
    headline: card.title,
    lines: lines.length ? lines : [card.prompt],
    tone: card.phase === 'intro' ? 'good' : 'normal',
  };
}

export function chapterDecisionOptions(card: ChapterCard): { id: string; label: string; hint: string }[] {
  if (card.phase === 'intro') {
    return [{ id: 'chapter-continue', label: '翻開下一頁', hint: '進入這個章節' }];
  }
  return [{ id: 'chapter-continue', label: '繼續前行', hint: '章節落幕' }];
}

/** Used by save migration / tests. */
export function defaultChapterState(stage: Stage): {
  chapterId: ChapterId;
  chaptersSeen: string[];
  chapterHistory: GameState['chapterHistory'];
  pendingChapter: ChapterCard | null;
} {
  const chapterId: ChapterId =
    stage === 'highschool' ? 'hs-year1' : stage === 'amateur' ? 'amateur' : 'pro-rookie';
  return {
    chapterId,
    chaptersSeen: [],
    chapterHistory: [],
    pendingChapter: null,
  };
}
